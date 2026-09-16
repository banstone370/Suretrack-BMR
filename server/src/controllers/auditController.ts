import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { AppError, ok } from '../utils/errors.js';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      batchId,
      action,
      entityType,
      actor,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query;

    const filter: Record<string, unknown> = {};
    if (batchId && Types.ObjectId.isValid(String(batchId))) {
      filter.batchId = batchId;
    }
    if (action) filter.action = new RegExp(String(action), 'i');
    if (entityType) filter.entityType = String(entityType);
    if (actor) {
      filter.$or = [
        { actorName: new RegExp(String(actor), 'i') },
        { actorEmployeeId: new RegExp(String(actor), 'i') },
      ];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) (filter.createdAt as Record<string, Date>).$gte = new Date(String(from));
      if (to) (filter.createdAt as Record<string, Date>).$lte = new Date(String(to));
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      AuditLog.countDocuments(filter),
    ]);

    res.json(ok(items, { page: pageNum, limit: limitNum, total }));
  } catch (err) {
    next(err);
  }
}

export async function listBatchAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    if (!Types.ObjectId.isValid(batchId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid batch id');
    }
    const items = await AuditLog.find({ batchId }).sort({ createdAt: -1 }).limit(200);
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}
