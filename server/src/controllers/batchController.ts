import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Batch } from '../models/Batch.js';
import { Product } from '../models/Product.js';
import { ProcessTemplate } from '../models/ProcessTemplate.js';
import { writeAudit } from '../audit/auditLogger.js';
import { BatchStatus } from '../types/enums.js';
import { AppError, ok } from '../utils/errors.js';
import { addMonths, buildBatchNoPrefix, formatBatchNo } from '../utils/batchNo.js';
import { streamBmrPdf } from '../pdf/bmrGenerator.js';
import {
  batchProgressPercent,
  buildTimeline,
} from '../workflow/batchStateMachine.js';
import * as auditController from './auditController.js';

async function nextBatchNo(catalogueNo: string, manufacturingDate: Date): Promise<string> {
  const prefix = buildBatchNoPrefix(catalogueNo, manufacturingDate);
  const existing = await Batch.find({ batchNo: new RegExp(`^${prefix}`) })
    .select('batchNo')
    .lean();
  const maxSeq = existing.reduce((max, b) => {
    const seq = Number(b.batchNo.slice(prefix.length));
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return formatBatchNo(prefix, maxSeq + 1);
}

function serializeBatch(batch: InstanceType<typeof Batch>) {
  const obj = batch.toObject();
  return {
    ...obj,
    id: batch.id,
    progressPercent: batchProgressPercent(batch.status),
    timeline: buildTimeline(batch.status),
  };
}

export async function listBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      product,
      batchNo,
      status,
      from,
      to,
      page = '1',
      limit = '20',
    } = req.query;

    const filter: Record<string, unknown> = {};
    if (product) filter.productId = product;
    if (batchNo) filter.batchNo = new RegExp(String(batchNo), 'i');
    if (status) filter.status = status;
    if (from || to) {
      filter.manufacturingDate = {};
      if (from) (filter.manufacturingDate as Record<string, Date>).$gte = new Date(String(from));
      if (to) (filter.manufacturingDate as Record<string, Date>).$lte = new Date(String(to));
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Batch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Batch.countDocuments(filter),
    ]);

    res.json(
      ok(
        items.map((b) => ({
          id: b.id,
          batchNo: b.batchNo,
          productName: b.productName,
          catalogueNo: b.catalogueNo,
          batchSize: b.batchSize,
          manufacturingDate: b.manufacturingDate,
          expiryDate: b.expiryDate,
          status: b.status,
          progressPercent: batchProgressPercent(b.status),
          createdAt: b.createdAt,
        })),
        { page: pageNum, limit: limitNum, total },
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function getBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function createBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, batchNo, batchSize, manufacturingDate, expiryDate } = req.body as {
      productId: string;
      batchNo?: string;
      batchSize: number;
      manufacturingDate: string | Date;
      expiryDate?: string | Date;
    };

    if (!Types.ObjectId.isValid(productId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid productId');
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'Product not found');
    }
    if (!product.processTemplateId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Product has no process template');
    }

    const template = await ProcessTemplate.findById(product.processTemplateId);
    if (!template) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Process template missing');
    }

    const mfgDate = new Date(manufacturingDate);
    const expDate = expiryDate
      ? new Date(expiryDate)
      : addMonths(mfgDate, product.shelfLifeMonths);

    const resolvedBatchNo =
      batchNo?.trim() || (await nextBatchNo(product.catalogueNo, mfgDate));

    const exists = await Batch.findOne({ batchNo: resolvedBatchNo });
    if (exists) {
      throw new AppError(409, 'CONFLICT', 'Batch number already exists');
    }

    const batch = await Batch.create({
      batchNo: resolvedBatchNo,
      productId: product.id,
      productName: product.name,
      catalogueNo: product.catalogueNo,
      batchSize,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      status: BatchStatus.DRAFT,
      statusHistory: [
        {
          status: BatchStatus.DRAFT,
          at: new Date(),
          by: req.user!.id,
          reason: 'Batch created',
        },
      ],
      templateVersion: template.version,
      processParamsSnapshot: {
        sealingParams: template.sealingParams,
        sterilizationParams: template.sterilizationParams,
        sterilitySop: template.sterilitySop,
        betSop: template.betSop,
        storageCondition: template.storageCondition,
        rmQcChecks: template.rmQcChecks,
        ipqcChecks: template.ipqcChecks,
      },
      stages: {
        rawMaterialQc: {
          lockState: 'OPEN',
          checks: template.rmQcChecks.map((process) => ({
            process,
            result: null,
          })),
        },
        rawMaterialConsumption: { lockState: 'OPEN', lines: [] },
        manufacturing: {
          lockState: 'OPEN',
          process: 'The needles are made Ready for Sterilization.',
          status: 'NOT_STARTED',
        },
        inProcessQc: { lockState: 'OPEN' },
        visualInspection: { lockState: 'OPEN' },
        packing: { lockState: 'OPEN' },
        sealing: {
          lockState: 'OPEN',
          configuredTemperatureC: template.sealingParams.temperatureC,
          sopRef: template.sealingParams.sopRef,
        },
        sterilization: {
          lockState: 'OPEN',
          configuredTemperatureC: template.sterilizationParams.temperatureC,
          requiredDurationHours: template.sterilizationParams.durationHours,
          etoCartridgeGrams: template.sterilizationParams.etoCartridgeGrams,
          sopRef: template.sterilizationParams.sopRef,
          cycleStatus: 'NOT_STARTED',
        },
        labelling: { lockState: 'OPEN' },
        sterilityTest: {
          lockState: 'OPEN',
          sopRef: template.sterilitySop,
          result: 'PENDING',
        },
        betTest: {
          lockState: 'OPEN',
          sopRef: template.betSop,
          result: 'PENDING',
        },
        qaReview: { lockState: 'OPEN' },
        finishedGoods: {
          lockState: 'OPEN',
          storageCondition: template.storageCondition,
        },
      },
      createdBy: req.user!.id,
    });

    await writeAudit({
      actor: req.user,
      action: 'CREATE_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      newValue: { batchNo: batch.batchNo, status: batch.status },
      req,
    });

    res.status(201).json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function updateBatchDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (batch.status !== BatchStatus.DRAFT) {
      throw new AppError(400, 'INVALID_STATE', 'Only DRAFT batches can be edited');
    }

    const old = {
      batchSize: batch.batchSize,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
    };

    const body = req.body as {
      batchSize?: number;
      manufacturingDate?: string | Date;
      expiryDate?: string | Date;
    };

    if (body.batchSize !== undefined) batch.batchSize = body.batchSize;
    if (body.manufacturingDate) batch.manufacturingDate = new Date(body.manufacturingDate);
    if (body.expiryDate) batch.expiryDate = new Date(body.expiryDate);

    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'UPDATE_BATCH_DRAFT',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      oldValue: old,
      newValue: {
        batchSize: batch.batchSize,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
      },
      req,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function startBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (batch.status !== BatchStatus.DRAFT) {
      throw new AppError(400, 'INVALID_STATE', 'Batch must be DRAFT to start');
    }

    batch.status = BatchStatus.RAW_MATERIAL_QC;
    batch.statusHistory.push({
      status: BatchStatus.RAW_MATERIAL_QC,
      at: new Date(),
      by: new Types.ObjectId(req.user!.id),
      reason: 'Production started',
    });
    await batch.save();

    await writeAudit({
      actor: req.user,
      action: 'START_BATCH',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      oldValue: { status: BatchStatus.DRAFT },
      newValue: { status: BatchStatus.RAW_MATERIAL_QC },
      req,
    });

    const { notifyStatusChange } = await import('../services/notificationService.js');
    await notifyStatusChange({
      batchId: batch.id,
      batchNo: batch.batchNo,
      status: BatchStatus.RAW_MATERIAL_QC,
    });

    res.json(ok(serializeBatch(batch)));
  } catch (err) {
    next(err);
  }
}

export async function getBatchTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await Batch.findById(req.params.batchId).select('status batchNo');
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    res.json(
      ok({
        batchNo: batch.batchNo,
        status: batch.status,
        progressPercent: batchProgressPercent(batch.status),
        timeline: buildTimeline(batch.status),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getBatchPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

    await writeAudit({
      actor: req.user,
      action: 'GENERATE_BMR_PDF',
      entityType: 'Batch',
      entityId: batch.id,
      batchId: batch.id,
      req,
    });

    await streamBmrPdf(batch, res);
  } catch (err) {
    next(err);
  }
}

export const getBatchAudit = auditController.listBatchAudit;
