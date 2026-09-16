import { Request, Response, NextFunction } from 'express';
import { Batch } from '../models/Batch.js';
import { BatchStatus } from '../types/enums.js';
import { ok } from '../utils/errors.js';
import { batchProgressPercent } from '../workflow/batchStateMachine.js';

const ACTIVE_EXCLUSIONS = [
  BatchStatus.DISPATCHED,
  BatchStatus.CANCELLED,
  BatchStatus.ARCHIVED,
  BatchStatus.REJECTED,
];

const PENDING_QC = [
  BatchStatus.RAW_MATERIAL_QC,
  BatchStatus.IN_PROCESS_QC,
  BatchStatus.VISUAL_INSPECTION,
  BatchStatus.STERILITY_TEST,
  BatchStatus.BET_TEST,
];

export async function dashboardSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      activeBatches,
      pendingQc,
      readyFg,
      pendingApprovals,
      sterilization,
      dispatchReady,
    ] = await Promise.all([
      Batch.countDocuments({ status: { $nin: ACTIVE_EXCLUSIONS } }),
      Batch.countDocuments({ status: { $in: PENDING_QC } }),
      Batch.countDocuments({
        status: { $in: [BatchStatus.FINISHED_GOODS, BatchStatus.RELEASED] },
      }),
      Batch.countDocuments({ status: BatchStatus.QA_REVIEW }),
      Batch.countDocuments({ status: BatchStatus.STERILIZATION }),
      Batch.countDocuments({ status: BatchStatus.FINISHED_GOODS }),
    ]);

    res.json(
      ok({
        activeBatches,
        pendingQc,
        readyFg,
        pendingApprovals,
        sterilization,
        dispatch: dispatchReady,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function recentBatches(_req: Request, res: Response, next: NextFunction) {
  try {
    const batches = await Batch.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('batchNo productName status manufacturingDate updatedAt');

    res.json(
      ok(
        batches.map((b) => ({
          id: b.id,
          batchNo: b.batchNo,
          productName: b.productName,
          status: b.status,
          stage: b.status,
          progressPercent: batchProgressPercent(b.status),
          manufacturingDate: b.manufacturingDate,
          updatedAt: b.updatedAt,
        })),
      ),
    );
  } catch (err) {
    next(err);
  }
}
