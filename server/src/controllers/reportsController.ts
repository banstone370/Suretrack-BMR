import { Request, Response, NextFunction } from 'express';
import { Batch } from '../models/Batch.js';
import { Dispatch } from '../models/Dispatch.js';
import { EtoCartridge } from '../models/EtoCartridge.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { BatchStatus } from '../types/enums.js';
import { AppError, ok } from '../utils/errors.js';

const COMPLETED_STATUSES = [
  BatchStatus.RELEASED,
  BatchStatus.FINISHED_GOODS,
  BatchStatus.DISPATCHED,
];

const QC_PENDING = [
  BatchStatus.RAW_MATERIAL_QC,
  BatchStatus.IN_PROCESS_QC,
  BatchStatus.VISUAL_INSPECTION,
  BatchStatus.STERILITY_TEST,
  BatchStatus.BET_TEST,
];

function dateFilter(from?: unknown, to?: unknown) {
  if (!from && !to) return undefined;
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(String(from));
  if (to) range.$lte = new Date(String(to));
  return range;
}

export async function productionReport(req: Request, res: Response, next: NextFunction) {
  try {
    const mfgRange = dateFilter(req.query.from, req.query.to);
    const match: Record<string, unknown> = {};
    if (mfgRange) match.manufacturingDate = mfgRange;

    const [created, completed, byStatus, quantityAgg, recent] = await Promise.all([
      Batch.countDocuments(match),
      Batch.countDocuments({ ...match, status: { $in: COMPLETED_STATUSES } }),
      Batch.aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        { $group: { _id: '$status', count: { $sum: 1 }, totalSize: { $sum: '$batchSize' } } },
        { $sort: { count: -1 } },
      ]),
      Batch.aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $group: {
            _id: null,
            totalBatchSize: { $sum: '$batchSize' },
            avgBatchSize: { $avg: '$batchSize' },
          },
        },
      ]),
      Batch.find(match)
        .sort({ manufacturingDate: -1 })
        .limit(20)
        .select('batchNo productName catalogueNo batchSize status manufacturingDate'),
    ]);

    res.json(
      ok({
        batchesCreated: created,
        batchesCompleted: completed,
        productionQuantity: quantityAgg[0]?.totalBatchSize ?? 0,
        averageBatchSize: Math.round(quantityAgg[0]?.avgBatchSize ?? 0),
        byStatus: byStatus.map((r) => ({
          status: r._id,
          count: r.count,
          totalSize: r.totalSize,
        })),
        recentBatches: recent,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function qcReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const [pending, onHold, rejected, sterilityPass, sterilityFail, betPass, betFail, batches] =
      await Promise.all([
        Batch.countDocuments({ status: { $in: QC_PENDING } }),
        Batch.countDocuments({ status: BatchStatus.ON_HOLD }),
        Batch.countDocuments({ status: BatchStatus.REJECTED }),
        Batch.countDocuments({ 'stages.sterilityTest.result': 'PASS' }),
        Batch.countDocuments({ 'stages.sterilityTest.result': 'FAIL' }),
        Batch.countDocuments({ 'stages.betTest.result': 'PASS' }),
        Batch.countDocuments({ 'stages.betTest.result': 'FAIL' }),
        Batch.find({
          $or: [
            { status: { $in: [...QC_PENDING, BatchStatus.ON_HOLD, BatchStatus.REJECTED] } },
            { 'stages.sterilityTest.result': { $in: ['PASS', 'FAIL'] } },
            { 'stages.betTest.result': { $in: ['PASS', 'FAIL'] } },
          ],
        })
          .sort({ updatedAt: -1 })
          .limit(25)
          .select('batchNo productName status stages.sterilityTest.result stages.betTest.result updatedAt'),
      ]);

    res.json(
      ok({
        pendingQc: pending,
        onHold,
        failed: rejected,
        passed: sterilityPass + betPass,
        sterility: { pass: sterilityPass, fail: sterilityFail },
        bet: { pass: betPass, fail: betFail },
        summary: [
          { label: 'Pending QC', value: pending },
          { label: 'On Hold', value: onHold },
          { label: 'Rejected', value: rejected },
          { label: 'Sterility Pass', value: sterilityPass },
          { label: 'Sterility Fail', value: sterilityFail },
          { label: 'BET Pass', value: betPass },
          { label: 'BET Fail', value: betFail },
        ],
        batches: batches.map((b) => {
          const stages = b.stages as Record<string, { result?: string }>;
          return {
            id: b.id,
            batchNo: b.batchNo,
            productName: b.productName,
            status: b.status,
            sterilityResult: stages?.sterilityTest?.result ?? null,
            betResult: stages?.betTest?.result ?? null,
            updatedAt: b.updatedAt,
          };
        }),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function sterilizationReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const [inProgress, completedCycles, quantityAgg, cartridges, recent] = await Promise.all([
      Batch.countDocuments({ status: BatchStatus.STERILIZATION }),
      Batch.countDocuments({
        'stages.sterilization.lockState': { $in: ['LOCKED', 'APPROVED'] },
      }),
      Batch.aggregate([
        {
          $match: {
            'stages.sterilization.lockState': { $in: ['LOCKED', 'APPROVED'] },
          },
        },
        {
          $group: {
            _id: null,
            quantitySterilized: { $sum: '$stages.sterilization.quantity' },
          },
        },
      ]),
      EtoCartridge.find().sort({ updatedAt: -1 }).limit(20),
      Batch.find({
        $or: [
          { status: BatchStatus.STERILIZATION },
          { 'stages.sterilization.lockState': { $in: ['LOCKED', 'APPROVED'] } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select(
          'batchNo productName status stages.sterilization.quantity stages.sterilization.cartridgeBatchNo stages.sterilization.machineId stages.sterilization.operator',
        ),
    ]);

    const cartridgeUsage = await EtoCartridge.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          remainingGrams: { $sum: '$quantityRemainingGrams' },
          totalGrams: { $sum: '$quantityGrams' },
        },
      },
    ]);

    res.json(
      ok({
        cyclesInProgress: inProgress,
        cyclesCompleted: completedCycles,
        quantitySterilized: quantityAgg[0]?.quantitySterilized ?? 0,
        cartridgeUsage: cartridgeUsage.map((c) => ({
          status: c._id,
          count: c.count,
          remainingGrams: c.remainingGrams,
          totalGrams: c.totalGrams,
        })),
        cartridges,
        recentCycles: recent.map((b) => {
          const ster = (b.stages as Record<string, Record<string, unknown>>)?.sterilization ?? {};
          return {
            id: b.id,
            batchNo: b.batchNo,
            productName: b.productName,
            status: b.status,
            quantity: ster.quantity ?? null,
            cartridgeBatchNo: ster.cartridgeBatchNo ?? null,
            machineId: ster.machineId ?? null,
            operator: (ster.operator as { name?: string })?.name ?? null,
          };
        }),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function inventoryReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const [fgStats, released, dispatchedBatches, items] = await Promise.all([
      FinishedGood.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            available: { $sum: '$quantityAvailable' },
            dispatched: { $sum: '$quantityDispatched' },
          },
        },
      ]),
      Batch.countDocuments({ status: BatchStatus.RELEASED }),
      Batch.countDocuments({ status: BatchStatus.DISPATCHED }),
      FinishedGood.find().sort({ updatedAt: -1 }).limit(50),
    ]);

    const availableQty = fgStats
      .filter((s) => s._id === 'AVAILABLE')
      .reduce((sum, s) => sum + s.available, 0);
    const dispatchedQty = fgStats.reduce((sum, s) => sum + s.dispatched, 0);

    res.json(
      ok({
        availableQuantity: availableQty,
        dispatchedQuantity: dispatchedQty,
        releasedBatches: released,
        dispatchedBatches,
        byStatus: fgStats.map((s) => ({
          status: s._id,
          lots: s.count,
          available: s.available,
          dispatched: s.dispatched,
        })),
        items,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function dispatchReport(req: Request, res: Response, next: NextFunction) {
  try {
    const match: Record<string, unknown> = { status: 'CONFIRMED' };
    const range = dateFilter(req.query.from, req.query.to);
    if (range) match.dispatchDate = range;

    const [total, byCustomer, byProduct, byDate, recent] = await Promise.all([
      Dispatch.aggregate([
        { $match: match },
        { $group: { _id: null, count: { $sum: 1 }, quantity: { $sum: '$quantity' } } },
      ]),
      Dispatch.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$customerName',
            count: { $sum: 1 },
            quantity: { $sum: '$quantity' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 20 },
      ]),
      Dispatch.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'batches',
            localField: 'batchId',
            foreignField: '_id',
            as: 'batch',
          },
        },
        { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$batch.productName',
            count: { $sum: 1 },
            quantity: { $sum: '$quantity' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 20 },
      ]),
      Dispatch.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$dispatchDate' },
            },
            count: { $sum: 1 },
            quantity: { $sum: '$quantity' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 60 },
      ]),
      Dispatch.find(match).sort({ dispatchDate: -1 }).limit(30),
    ]);

    res.json(
      ok({
        confirmedDispatches: total[0]?.count ?? 0,
        quantityDispatched: total[0]?.quantity ?? 0,
        byCustomer: byCustomer.map((r) => ({
          customer: r._id,
          count: r.count,
          quantity: r.quantity,
        })),
        byProduct: byProduct.map((r) => ({
          product: r._id ?? 'Unknown',
          count: r.count,
          quantity: r.quantity,
        })),
        byDate: byDate.map((r) => ({
          date: r._id,
          count: r.count,
          quantity: r.quantity,
        })),
        recent,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  const type = String(req.params.type || '').toLowerCase();
  const format = String(req.query.format ?? 'json').toLowerCase();

  if (format === 'csv') {
    try {
      const { Batch } = await import('../models/Batch.js');
      const { FinishedGood } = await import('../models/FinishedGood.js');
      const { Dispatch } = await import('../models/Dispatch.js');

      let rows: Array<Record<string, unknown>> = [];
      if (type === 'production') {
        const batches = await Batch.find().sort({ createdAt: -1 }).limit(500).lean();
        rows = batches.map((b) => ({
          batchNo: b.batchNo,
          product: b.productName,
          catalogueNo: b.catalogueNo,
          batchSize: b.batchSize,
          status: b.status,
          mfgDate: b.manufacturingDate,
          revision: b.currentRevision,
        }));
      } else if (type === 'qc') {
        const batches = await Batch.find({
          status: {
            $in: [
              'RAW_MATERIAL_QC',
              'IN_PROCESS_QC',
              'VISUAL_INSPECTION',
              'STERILITY_TEST',
              'BET_TEST',
              'ON_HOLD',
              'REJECTED',
            ],
          },
        })
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean();
        rows = batches.map((b) => ({
          batchNo: b.batchNo,
          product: b.productName,
          status: b.status,
          holdReason: b.holdReason ?? '',
          rejectReason: b.rejectReason ?? '',
        }));
      } else if (type === 'inventory' || type === 'fg' || type === 'finished-goods') {
        const items = await FinishedGood.find().sort({ createdAt: -1 }).limit(500).lean();
        rows = items.map((f) => ({
          batchNo: f.batchNo,
          product: f.productName,
          qtyAvailable: f.quantityAvailable,
          qtyDispatched: f.quantityDispatched,
          status: f.status,
        }));
      } else if (type === 'dispatch') {
        const items = await Dispatch.find().sort({ createdAt: -1 }).limit(500).lean();
        rows = items.map((d) => ({
          billNo: d.billNo,
          batchNo: d.batchNo,
          customer: d.customerName,
          quantity: d.quantity,
          status: d.status,
          dispatchDate: d.dispatchDate,
        }));
      } else if (type === 'sterilization') {
        const batches = await Batch.find({
          'stages.sterilization.lockState': { $in: ['SUBMITTED', 'APPROVED', 'LOCKED'] },
        })
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean();
        rows = batches.map((b) => {
          const ster = (b.stages as Record<string, Record<string, unknown>>)?.sterilization ?? {};
          return {
            batchNo: b.batchNo,
            product: b.productName,
            temperatureC: ster.actualTemperatureC ?? '',
            durationHours: ster.actualDurationHours ?? '',
            cartridge: ster.cartridgeLotNo ?? '',
            status: b.status,
          };
        });
      } else {
        throw new AppError(404, 'NOT_FOUND', 'Unknown report type for CSV');
      }

      const headers = rows.length ? Object.keys(rows[0]) : ['message'];
      const escape = (v: unknown) => {
        const s = v === undefined || v === null ? '' : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
      res.send(csv);
      return;
    } catch (err) {
      return next(err);
    }
  }

  switch (type) {
    case 'production':
      return productionReport(req, res, next);
    case 'qc':
      return qcReport(req, res, next);
    case 'sterilization':
      return sterilizationReport(req, res, next);
    case 'inventory':
    case 'finished-goods':
    case 'fg':
      return inventoryReport(req, res, next);
    case 'dispatch':
      return dispatchReport(req, res, next);
    default:
      return next(
        new AppError(
          404,
          'NOT_FOUND',
          'Unknown report type. Use production|qc|sterilization|inventory|dispatch',
        ),
      );
  }
}
