import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { writeAudit } from '../audit/auditLogger.js';
import { Batch } from '../models/Batch.js';
import { batchProgressPercent, buildTimeline } from '../workflow/batchStateMachine.js';
import { BatchStatus } from '../types/enums.js';
import { AppError, ok } from '../utils/errors.js';
import { hasPermission } from '../workflow/permissions.js';
import { notifyStatusChange } from '../services/notificationService.js';
import {
  listCorrections,
  listStageOptions,
  requestCorrection,
  resolveCorrection,
} from '../services/correctionService.js';

function serializeBatch(batch: InstanceType<typeof Batch>) {
  const obj = batch.toObject();
  return {
    ...obj,
    id: batch.id,
    progressPercent: batchProgressPercent(batch.status),
    timeline: buildTimeline(batch.status),
  };
}

const NON_HOLDABLE: BatchStatus[] = [
  BatchStatus.DISPATCHED,
  BatchStatus.CANCELLED,
  BatchStatus.ARCHIVED,
  BatchStatus.REJECTED,
  BatchStatus.ON_HOLD,
];

export async function holdBatch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!hasPermission(req.user!.role, 'batch:hold')) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    const reason = String((req.body as { reason?: string }).reason ?? '').trim();
    if (!reason) throw new AppError(400, 'VALIDATION_ERROR', 'Hold reason is required');

    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (NON_HOLDABLE.includes(batch.status)) {
      throw new AppError(400, 'INVALID_STATE', `Cannot hold batch in status ${batch.status}`);
    }

    const previous = batch.status;
    batch.previousStatus = previous;
    batch.holdReason = reason;
    batch.status = BatchStatus.ON_HOLD;
    batch.statusHistory.push({
      status: BatchStatus.ON_HOLD,
      at: new Date(),
      by: new Types.ObjectId(req.user!.id),
      reason,
    });
    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'HOLD_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      oldValue: { status: previous },
      newValue: { status: BatchStatus.ON_HOLD },
      reason,
      req,
    });

    await notifyStatusChange({
      batchId: batch.id,
      batchNo: batch.batchNo,
      status: BatchStatus.ON_HOLD,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function resumeBatch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!hasPermission(req.user!.role, 'qa:release') && req.user!.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Only QA or Admin can resume batches');
    }
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (batch.status !== BatchStatus.ON_HOLD) {
      throw new AppError(400, 'INVALID_STATE', 'Batch is not on hold');
    }
    const nextStatus = batch.previousStatus;
    if (!nextStatus) {
      throw new AppError(400, 'INVALID_STATE', 'No previous status to resume');
    }

    batch.status = nextStatus;
    batch.holdReason = undefined;
    batch.previousStatus = undefined;
    batch.statusHistory.push({
      status: nextStatus,
      at: new Date(),
      by: new Types.ObjectId(req.user!.id),
      reason: 'Resumed from hold',
    });
    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'RESUME_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      newValue: { status: nextStatus },
      req,
    });

    await notifyStatusChange({
      batchId: batch.id,
      batchNo: batch.batchNo,
      status: nextStatus,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function cancelBatch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!hasPermission(req.user!.role, 'batch:cancel')) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    const reason = String((req.body as { reason?: string }).reason ?? '').trim();
    if (!reason) throw new AppError(400, 'VALIDATION_ERROR', 'Cancel reason is required');

    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (
      [BatchStatus.DISPATCHED, BatchStatus.CANCELLED, BatchStatus.ARCHIVED].includes(batch.status)
    ) {
      throw new AppError(400, 'INVALID_STATE', `Cannot cancel batch in status ${batch.status}`);
    }

    const previous = batch.status;
    batch.status = BatchStatus.CANCELLED;
    batch.rejectReason = reason;
    batch.statusHistory.push({
      status: BatchStatus.CANCELLED,
      at: new Date(),
      by: new Types.ObjectId(req.user!.id),
      reason,
    });
    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'CANCEL_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      oldValue: { status: previous },
      newValue: { status: BatchStatus.CANCELLED },
      reason,
      req,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function archiveBatch(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Only Admin can archive batches');
    }
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (![BatchStatus.REJECTED, BatchStatus.CANCELLED].includes(batch.status)) {
      throw new AppError(400, 'INVALID_STATE', 'Only REJECTED or CANCELLED batches can be archived');
    }

    const previous = batch.status;
    batch.status = BatchStatus.ARCHIVED;
    batch.statusHistory.push({
      status: BatchStatus.ARCHIVED,
      at: new Date(),
      by: new Types.ObjectId(req.user!.id),
      reason: 'Archived',
    });
    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'ARCHIVE_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      oldValue: { status: previous },
      newValue: { status: BatchStatus.ARCHIVED },
      req,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function createCorrection(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { stageSlug: string; reason: string };
    if (!body.stageSlug || !body.reason?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'stageSlug and reason are required');
    }
    const correction = await requestCorrection({
      batchId: req.params.batchId,
      stageSlug: body.stageSlug,
      reason: body.reason,
      user: req.user!,
      req,
    });
    res.status(201).json(ok(correction));
  } catch (err) {
    next(err);
  }
}

export async function resolveCorrectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { decision: 'APPROVE' | 'REJECT'; note?: string };
    if (!body.decision || !['APPROVE', 'REJECT'].includes(body.decision)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'decision must be APPROVE or REJECT');
    }
    const result = await resolveCorrection({
      batchId: req.params.batchId,
      correctionId: req.params.correctionId,
      decision: body.decision,
      note: body.note,
      user: req.user!,
      req,
    });
    res.json(
      ok({
        correction: result.correction,
        batch: serializeBatch(result.batch),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function listBatchCorrections(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listCorrections(req.params.batchId);
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function getCorrectionStages(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(listStageOptions()));
  } catch (err) {
    next(err);
  }
}
