import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { writeAudit } from '../audit/auditLogger.js';
import { Batch } from '../models/Batch.js';
import { Customer } from '../models/Customer.js';
import { Dispatch } from '../models/Dispatch.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { User } from '../models/User.js';
import { BatchStatus } from '../types/enums.js';
import { AppError, ok } from '../utils/errors.js';
import { verifyPassword } from '../utils/authTokens.js';
import { makeSignature } from '../workflow/stageConfig.js';

export async function listCustomers(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await Customer.find({ isActive: true }).sort({ name: 1 });
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      name: string;
      code: string;
      address?: string;
      contact?: string;
    };
    if (!body.name?.trim() || !body.code?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name and code are required');
    }
    const exists = await Customer.findOne({ code: body.code.toUpperCase() });
    if (exists) throw new AppError(409, 'CONFLICT', 'Customer code already exists');

    const customer = await Customer.create({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      address: body.address,
      contact: body.contact,
    });

    await writeAudit({
      actor: req.user,
      action: 'CREATE_CUSTOMER',
      entityType: 'Customer',
      entityId: customer.id,
      newValue: customer.toObject(),
      req,
    });

    res.status(201).json(ok(customer));
  } catch (err) {
    next(err);
  }
}

export async function listDispatches(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId, status, billNo } = req.query;
    const filter: Record<string, unknown> = {};
    if (batchId) filter.batchId = batchId;
    if (status) filter.status = status;
    if (billNo) filter.billNo = new RegExp(String(billNo), 'i');
    const items = await Dispatch.find(filter).sort({ createdAt: -1 });
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function createDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      batchId: string;
      customerId: string;
      dispatchDate: string;
      billNo: string;
      quantity: number;
    };

    if (!Types.ObjectId.isValid(body.batchId) || !Types.ObjectId.isValid(body.customerId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid batch or customer id');
    }
    if (!body.billNo?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Bill number is required');
    }
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Quantity must be > 0');
    }

    const batch = await Batch.findById(body.batchId);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
    if (
      batch.status !== BatchStatus.FINISHED_GOODS &&
      batch.status !== BatchStatus.DISPATCHED
    ) {
      throw new AppError(
        400,
        'INVALID_STATE',
        'Batch must be in Finished Goods before dispatch',
      );
    }

    const fg = await FinishedGood.findOne({ batchId: batch._id });
    if (!fg) throw new AppError(404, 'NOT_FOUND', 'Finished goods record not found');
    if (quantity > fg.quantityAvailable) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Quantity exceeds available stock (${fg.quantityAvailable})`,
      );
    }

    const customer = await Customer.findById(body.customerId);
    if (!customer || !customer.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    }

    const dispatch = await Dispatch.create({
      batchId: batch._id,
      finishedGoodsId: fg._id,
      batchNo: batch.batchNo,
      customerId: customer._id,
      customerName: customer.name,
      dispatchDate: new Date(body.dispatchDate),
      billNo: body.billNo.trim(),
      quantity,
      status: 'DRAFT',
      createdBy: req.user!.id,
    });

    await writeAudit({
      actor: req.user,
      action: 'CREATE_DISPATCH',
      entityType: 'Dispatch',
      entityId: dispatch.id,
      batchId: batch.id,
      newValue: {
        billNo: dispatch.billNo,
        quantity: dispatch.quantity,
        customerName: dispatch.customerName,
      },
      req,
    });

    res.status(201).json(ok(dispatch));
  } catch (err) {
    next(err);
  }
}

export async function confirmDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { signature } = req.body as {
      signature?: { password: string; statement?: string };
    };
    if (!signature?.password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Electronic signature password is required');
    }

    const user = await User.findById(req.user!.id);
    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    }
    const valid = await verifyPassword(signature.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Electronic signature password is incorrect');
    }

    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) throw new AppError(404, 'NOT_FOUND', 'Dispatch not found');
    if (dispatch.status !== 'DRAFT') {
      throw new AppError(400, 'INVALID_STATE', `Dispatch is already ${dispatch.status}`);
    }

    const fg = await FinishedGood.findById(dispatch.finishedGoodsId);
    if (!fg) throw new AppError(404, 'NOT_FOUND', 'Finished goods record not found');
    if (dispatch.quantity > fg.quantityAvailable) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Quantity exceeds available stock (${fg.quantityAvailable})`,
      );
    }

    const sig = makeSignature(req.user!, signature.statement);
    dispatch.dispatchedBy = sig;
    dispatch.checkedBy = sig;
    dispatch.confirmedAt = new Date();
    dispatch.status = 'CONFIRMED';
    await dispatch.save();

    fg.quantityAvailable -= dispatch.quantity;
    fg.quantityDispatched += dispatch.quantity;
    if (fg.quantityAvailable <= 0) {
      fg.quantityAvailable = 0;
      fg.status = 'DEPLETED';
    }
    await fg.save();

    const batch = await Batch.findById(dispatch.batchId);
    if (batch && fg.quantityAvailable === 0 && batch.status === BatchStatus.FINISHED_GOODS) {
      batch.statusHistory.push({
        status: BatchStatus.DISPATCHED,
        at: new Date(),
        by: new Types.ObjectId(req.user!.id),
        reason: `Fully dispatched via bill ${dispatch.billNo}`,
      });
      batch.status = BatchStatus.DISPATCHED;
      await batch.save();
    }

    await writeAudit({
      actor: req.user,
      action: 'CONFIRM_DISPATCH',
      entityType: 'Dispatch',
      entityId: dispatch.id,
      batchId: dispatch.batchId.toString(),
      newValue: {
        status: dispatch.status,
        quantity: dispatch.quantity,
        remainingStock: fg.quantityAvailable,
        batchStatus: batch?.status,
      },
      req,
    });

    res.json(
      ok({
        dispatch,
        finishedGoods: fg,
        batchStatus: batch?.status,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function cancelDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) throw new AppError(404, 'NOT_FOUND', 'Dispatch not found');
    if (dispatch.status !== 'DRAFT') {
      throw new AppError(400, 'INVALID_STATE', 'Only draft dispatches can be cancelled');
    }
    dispatch.status = 'CANCELLED';
    await dispatch.save();

    await writeAudit({
      actor: req.user,
      action: 'CANCEL_DISPATCH',
      entityType: 'Dispatch',
      entityId: dispatch.id,
      batchId: dispatch.batchId.toString(),
      req,
    });

    res.json(ok(dispatch));
  } catch (err) {
    next(err);
  }
}
