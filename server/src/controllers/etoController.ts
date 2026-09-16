import { NextFunction, Request, Response } from 'express';
import { EtoCartridge } from '../models/EtoCartridge.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';

export async function listCartridges(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const items = await EtoCartridge.find(filter).sort({ expiryDate: 1 });
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function createCartridge(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      cartridgeBatchNo: string;
      manufacturer: string;
      receivedDate: string;
      expiryDate: string;
      quantityGrams: number;
    };
    const exists = await EtoCartridge.findOne({ cartridgeBatchNo: body.cartridgeBatchNo });
    if (exists) {
      throw new AppError(409, 'CONFLICT', 'Cartridge batch number already exists');
    }
    const item = await EtoCartridge.create({
      cartridgeBatchNo: body.cartridgeBatchNo,
      manufacturer: body.manufacturer,
      receivedDate: new Date(body.receivedDate),
      expiryDate: new Date(body.expiryDate),
      quantityGrams: body.quantityGrams,
      quantityRemainingGrams: body.quantityGrams,
      status: 'AVAILABLE',
    });
    await writeAudit({
      actor: req.user,
      action: 'CREATE_ETO_CARTRIDGE',
      entityType: 'EtoCartridge',
      entityId: item.id,
      newValue: item.toObject(),
      req,
    });
    res.status(201).json(ok(item));
  } catch (err) {
    next(err);
  }
}
