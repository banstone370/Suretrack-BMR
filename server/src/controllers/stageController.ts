import { NextFunction, Request, Response } from 'express';
import * as stageService from '../services/stageService.js';
import { ok } from '../utils/errors.js';

export async function getStage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await stageService.getStage(req.params.batchId, req.params.stage);
    res.json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function saveStage(req: Request, res: Response, next: NextFunction) {
  try {
    const batch = await stageService.saveStage({
      batchId: req.params.batchId,
      slug: req.params.stage,
      payload: (req.body?.payload ?? req.body) as Record<string, unknown>,
      user: req.user!,
      req,
    });
    res.json(ok(batch));
  } catch (err) {
    next(err);
  }
}

export async function submitStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { payload, signature, reason } = req.body as {
      payload: Record<string, unknown>;
      signature: { password: string; statement?: string };
      reason?: string;
    };
    const batch = await stageService.submitStage({
      batchId: req.params.batchId,
      slug: req.params.stage,
      payload: payload ?? {},
      password: signature?.password,
      statement: signature?.statement,
      reason,
      user: req.user!,
      req,
    });
    res.json(ok(batch));
  } catch (err) {
    next(err);
  }
}

export async function approveStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { signature, reason } = req.body as {
      signature: { password: string; statement?: string };
      reason?: string;
    };
    const batch = await stageService.approveStage({
      batchId: req.params.batchId,
      slug: req.params.stage,
      password: signature?.password,
      statement: signature?.statement,
      reason,
      user: req.user!,
      req,
    });
    res.json(ok(batch));
  } catch (err) {
    next(err);
  }
}

export async function rejectStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { signature, reason, decision } = req.body as {
      signature: { password: string; statement?: string };
      reason: string;
      decision?: 'REJECTED' | 'HOLD';
    };
    const batch = await stageService.rejectStage({
      batchId: req.params.batchId,
      slug: req.params.stage,
      password: signature?.password,
      statement: signature?.statement,
      reason,
      decision,
      user: req.user!,
      req,
    });
    res.json(ok(batch));
  } catch (err) {
    next(err);
  }
}
