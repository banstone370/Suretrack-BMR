import { Request, Response, NextFunction } from 'express';
import { SystemSettings } from '../models/SystemSettings.js';
import { writeAudit } from '../audit/auditLogger.js';
import { AppError, ok } from '../utils/errors.js';
import {
  listNotificationsForUser,
  markAllRead,
  markNotificationRead,
  pendingWorkForRole,
} from '../services/notificationService.js';
import { Role } from '../types/enums.js';

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    let settings = await SystemSettings.findOne({ key: 'default' });
    if (!settings) {
      settings = await SystemSettings.create({ key: 'default' });
    }
    res.json(ok(settings));
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Partial<{
      companyName: string;
      companyAddress: string;
      batchNoPrefixMode: 'CATALOGUE' | 'FIXED';
      fixedBatchPrefix: string;
      esignStatement: string;
      pdfFooterNote: string;
    }>;

    let settings = await SystemSettings.findOne({ key: 'default' });
    if (!settings) settings = await SystemSettings.create({ key: 'default' });

    const old = settings.toObject();
    if (body.companyName !== undefined) settings.companyName = body.companyName;
    if (body.companyAddress !== undefined) settings.companyAddress = body.companyAddress;
    if (body.batchNoPrefixMode !== undefined) settings.batchNoPrefixMode = body.batchNoPrefixMode;
    if (body.fixedBatchPrefix !== undefined) settings.fixedBatchPrefix = body.fixedBatchPrefix;
    if (body.esignStatement !== undefined) settings.esignStatement = body.esignStatement;
    if (body.pdfFooterNote !== undefined) settings.pdfFooterNote = body.pdfFooterNote;
    await settings.save();

    await writeAudit({
      actor: req.user,
      action: 'UPDATE_SETTINGS',
      entityType: 'SystemSettings',
      entityId: settings.id,
      oldValue: old,
      newValue: settings.toObject(),
      req,
    });

    res.json(ok(settings));
  } catch (err) {
    next(err);
  }
}

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const unreadOnly = String(req.query.unread ?? '') === '1';
    const items = await listNotificationsForUser(req.user!.id, req.user!.role as Role, unreadOnly);
    res.json(ok(items));
  } catch (err) {
    next(err);
  }
}

export async function readNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const n = await markNotificationRead(req.params.id, req.user!.id, req.user!.role as Role);
    if (!n) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    res.json(ok(n));
  } catch (err) {
    next(err);
  }
}

export async function readAllNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    await markAllRead(req.user!.id, req.user!.role as Role);
    res.json(ok({ success: true }));
  } catch (err) {
    next(err);
  }
}

export async function pendingInbox(req: Request, res: Response, next: NextFunction) {
  try {
    const work = await pendingWorkForRole(req.user!.role as Role);
    const unread = await listNotificationsForUser(req.user!.id, req.user!.role as Role, true);
    res.json(
      ok({
        ...work,
        unreadCount: unread.length,
      }),
    );
  } catch (err) {
    next(err);
  }
}
