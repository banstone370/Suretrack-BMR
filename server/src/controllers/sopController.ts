import { NextFunction, Request, Response } from 'express';
import { writeAudit } from '../audit/auditLogger.js';
import { Sop } from '../models/Sop.js';
import { AppError, ok } from '../utils/errors.js';

export async function listSops(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await Sop.find(filter).sort({ sopNo: 1, version: -1 });
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function createSop(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      sopNo: string;
      title: string;
      version: string;
      effectiveDate: string;
      documentUrl?: string;
      description?: string;
      status?: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
    };
    if (!body.sopNo?.trim() || !body.title?.trim() || !body.version?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'SOP no., title and version are required');
    }
    const sop = await Sop.create({
      sopNo: body.sopNo.trim().toUpperCase(),
      title: body.title.trim(),
      version: body.version.trim(),
      effectiveDate: new Date(body.effectiveDate || Date.now()),
      documentUrl: body.documentUrl,
      description: body.description,
      status: body.status ?? 'DRAFT',
      approvedBy: body.status === 'APPROVED' ? req.user!.id : undefined,
    });

    await writeAudit({
      actor: req.user,
      action: 'CREATE_SOP',
      entityType: 'Sop',
      entityId: sop.id,
      newValue: sop.toObject(),
      req,
    });

    res.status(201).json(ok(sop));
  } catch (err) {
    next(err);
  }
}

export async function updateSop(req: Request, res: Response, next: NextFunction) {
  try {
    const sop = await Sop.findById(req.params.id);
    if (!sop) throw new AppError(404, 'NOT_FOUND', 'SOP not found');

    const body = req.body as Partial<{
      title: string;
      effectiveDate: string;
      documentUrl: string;
      description: string;
      status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
    }>;

    const old = sop.toObject();
    if (body.title !== undefined) sop.title = body.title;
    if (body.effectiveDate) sop.effectiveDate = new Date(body.effectiveDate);
    if (body.documentUrl !== undefined) sop.documentUrl = body.documentUrl;
    if (body.description !== undefined) sop.description = body.description;
    if (body.status) {
      sop.status = body.status;
      if (body.status === 'APPROVED') sop.approvedBy = req.user!.id as unknown as typeof sop.approvedBy;
    }
    await sop.save();

    await writeAudit({
      actor: req.user,
      action: 'UPDATE_SOP',
      entityType: 'Sop',
      entityId: sop.id,
      oldValue: old,
      newValue: sop.toObject(),
      req,
    });

    res.json(ok(sop));
  } catch (err) {
    next(err);
  }
}
