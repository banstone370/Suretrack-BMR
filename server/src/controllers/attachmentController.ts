import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Attachment } from '../models/Attachment.js';
import { Sop } from '../models/Sop.js';
import { Batch } from '../models/Batch.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

export async function uploadBatchAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    const batchId = req.params.batchId;
    const stageSlug = String((req.body as { stageSlug?: string }).stageSlug ?? '');
    const batch = await Batch.findById(batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

    const att = await Attachment.create({
      batchId: new Types.ObjectId(batchId),
      stageSlug: stageSlug || undefined,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: new Types.ObjectId(req.user!.id),
    });

    await writeAudit({
      actor: req.user,
      action: 'UPLOAD_ATTACHMENT',
      entityType: 'Attachment',
      entityId: att.id,
      batchId,
      newValue: { name: att.originalName, stageSlug },
      req,
    });

    res.status(201).json(
      ok({
        ...att.toObject(),
        id: att.id,
        url: `/api/v1/attachments/${att.id}/download`,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function uploadSopDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'File is required');
    const sop = await Sop.findById(req.params.id);
    if (!sop) throw new AppError(404, 'NOT_FOUND', 'SOP not found');

    const att = await Attachment.create({
      sopId: sop._id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: new Types.ObjectId(req.user!.id),
    });

    sop.documentUrl = `/api/v1/attachments/${att.id}/download`;
    await sop.save();

    await writeAudit({
      actor: req.user,
      action: 'UPLOAD_SOP_DOCUMENT',
      entityType: 'Sop',
      entityId: sop.id,
      newValue: { attachmentId: att.id, name: att.originalName },
      req,
    });

    res.status(201).json(
      ok({
        sop,
        attachment: {
          ...att.toObject(),
          id: att.id,
          url: `/api/v1/attachments/${att.id}/download`,
        },
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function listBatchAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: Record<string, unknown> = { batchId: req.params.batchId };
    if (req.query.stageSlug) filter.stageSlug = String(req.query.stageSlug);
    const items = await Attachment.find(filter).sort({ createdAt: -1 });
    res.json(
      ok(
        items.map((a) => ({
          ...a.toObject(),
          id: a.id,
          url: `/api/v1/attachments/${a.id}/download`,
        })),
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const att = await Attachment.findById(req.params.id);
    if (!att) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
    const filePath = path.join(UPLOAD_ROOT, att.storedName);
    if (!fs.existsSync(filePath)) throw new AppError(404, 'NOT_FOUND', 'File missing on disk');
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${att.originalName.replace(/"/g, '')}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}
