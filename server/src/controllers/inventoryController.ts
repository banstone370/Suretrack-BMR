import { NextFunction, Request, Response } from 'express';
import { FinishedGood } from '../models/FinishedGood.js';
import { AppError, ok } from '../utils/errors.js';

export async function listFinishedGoods(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, batchNo } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (batchNo) filter.batchNo = new RegExp(String(batchNo), 'i');
    const items = await FinishedGood.find(filter).sort({ createdAt: -1 });
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function getFinishedGood(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Finished goods record not found');
    res.json(ok(item));
  } catch (err) {
    next(err);
  }
}
