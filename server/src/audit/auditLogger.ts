import { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { AuthUser } from '../types/express.js';

export async function writeAudit(params: {
  actor?: AuthUser | null;
  action: string;
  entityType: string;
  entityId?: string;
  batchId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  req?: Request;
}) {
  const { actor, action, entityType, entityId, batchId, oldValue, newValue, reason, req } =
    params;

  await AuditLog.create({
    actorUserId: actor?.id,
    actorEmployeeId: actor?.employeeId,
    actorName: actor?.name,
    action,
    entityType,
    entityId,
    batchId,
    oldValue,
    newValue,
    reason,
    ip: req?.ip,
    userAgent: req?.get('user-agent') ?? undefined,
  });
}
