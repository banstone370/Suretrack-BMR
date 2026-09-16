import { Request } from 'express';
import { Types } from 'mongoose';
import { writeAudit } from '../audit/auditLogger.js';
import { Batch } from '../models/Batch.js';
import { CorrectionRequest } from '../models/CorrectionRequest.js';
import { AuthUser } from '../types/express.js';
import { BatchStatus, RecordLockState } from '../types/enums.js';
import { hasPermission } from '../workflow/permissions.js';
import { getStageDef, STAGE_DEFINITIONS, type StageSlug } from '../workflow/stageConfig.js';
import { AppError } from '../utils/errors.js';
import { notifyRoles, notifyUser } from './notificationService.js';
import { Role } from '../types/enums.js';

const TERMINAL: BatchStatus[] = [
  BatchStatus.DISPATCHED,
  BatchStatus.CANCELLED,
  BatchStatus.ARCHIVED,
  BatchStatus.REJECTED,
];

export async function requestCorrection(params: {
  batchId: string;
  stageSlug: string;
  reason: string;
  user: AuthUser;
  req?: Request;
}) {
  if (!hasPermission(params.user.role, 'batch:request_correction')) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }
  const def = getStageDef(params.stageSlug);
  if (!def) throw new AppError(400, 'VALIDATION_ERROR', 'Unknown stage');

  const batch = await Batch.findById(params.batchId);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  if (TERMINAL.includes(batch.status)) {
    throw new AppError(400, 'INVALID_STATE', 'Cannot request correction on a closed batch');
  }

  const stages = (batch.stages ?? {}) as Record<string, Record<string, unknown>>;
  const stageData = stages[def.field] ?? {};
  const lock = String(stageData.lockState ?? RecordLockState.OPEN);
  if (lock === RecordLockState.OPEN) {
    throw new AppError(400, 'INVALID_STATE', 'Stage is already open for editing');
  }

  const existing = await CorrectionRequest.findOne({
    batchId: batch._id,
    stageSlug: def.slug,
    status: 'PENDING',
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'A pending correction already exists for this stage');
  }

  const correction = await CorrectionRequest.create({
    batchId: batch._id,
    stageSlug: def.slug,
    stageField: def.field,
    stageLabel: def.label,
    requestedBy: new Types.ObjectId(params.user.id),
    reason: params.reason.trim(),
    status: 'PENDING',
  });

  await writeAudit({
    actor: params.user,
    action: 'REQUEST_CORRECTION',
    entityType: 'CorrectionRequest',
    entityId: correction.id,
    batchId: batch.id,
    newValue: { stage: def.slug, reason: params.reason },
    reason: params.reason,
    req: params.req,
  });

  await notifyRoles({
    roles: [Role.QA_APPROVER, Role.ADMIN],
    type: 'CORRECTION_REQUEST',
    title: `Correction requested: ${batch.batchNo}`,
    body: `${params.user.name} requested unlock of ${def.label}: ${params.reason}`,
    batchId: batch.id,
    link: `/batches/${batch.id}`,
  });

  return correction;
}

export async function resolveCorrection(params: {
  batchId: string;
  correctionId: string;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
  user: AuthUser;
  req?: Request;
}) {
  if (!hasPermission(params.user.role, 'qa:release') && params.user.role !== Role.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only QA or Admin can resolve corrections');
  }

  const correction = await CorrectionRequest.findById(params.correctionId);
  if (!correction || String(correction.batchId) !== params.batchId) {
    throw new AppError(404, 'NOT_FOUND', 'Correction request not found');
  }
  if (correction.status !== 'PENDING') {
    throw new AppError(400, 'INVALID_STATE', 'Correction already resolved');
  }

  const batch = await Batch.findById(params.batchId);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

  if (params.decision === 'APPROVE') {
    const def = getStageDef(correction.stageSlug);
    const stages = {
      ...((batch.stages ?? {}) as Record<string, Record<string, unknown>>),
    };
    const current = { ...(stages[correction.stageField] ?? {}) };
    current.lockState = RecordLockState.OPEN;
    current.unlockedAt = new Date().toISOString();
    current.unlockedBy = params.user.id;
    current.unlockReason = correction.reason;
    // Clear prior approval markers so stage can be re-submitted
    delete current.approvedAt;
    delete current.approvedBy;
    delete current.submittedAt;
    stages[correction.stageField] = current;
    batch.stages = stages;
    batch.markModified('stages');
    batch.currentRevision = (batch.currentRevision ?? 1) + 1;

    // Move batch back to a status where this stage is editable
    const editableStatus = def?.editableWhen?.[0] ?? def?.submittableWhen?.[0];
    if (editableStatus && batch.status !== editableStatus && batch.status !== BatchStatus.ON_HOLD) {
      batch.previousStatus = batch.status;
      batch.statusHistory.push({
        status: editableStatus,
        at: new Date(),
        by: new Types.ObjectId(params.user.id),
        reason: `Correction unlock — returned to ${def?.label ?? correction.stageLabel}`,
      });
      batch.status = editableStatus;
    }

    await batch.save();

    correction.status = 'APPROVED';
    correction.newRevision = batch.currentRevision;
  } else {
    correction.status = 'REJECTED';
  }

  correction.resolvedBy = new Types.ObjectId(params.user.id);
  correction.resolvedAt = new Date();
  correction.resolutionNote = params.note;
  await correction.save();

  await writeAudit({
    actor: params.user,
    action: params.decision === 'APPROVE' ? 'APPROVE_CORRECTION' : 'REJECT_CORRECTION',
    entityType: 'CorrectionRequest',
    entityId: correction.id,
    batchId: batch.id,
    newValue: {
      status: correction.status,
      revision: correction.newRevision,
      note: params.note,
    },
    reason: params.note ?? correction.reason,
    req: params.req,
  });

  await notifyUser({
    userId: String(correction.requestedBy),
    type: 'CORRECTION_RESOLVED',
    title: `Correction ${correction.status.toLowerCase()}: ${batch.batchNo}`,
    body:
      params.decision === 'APPROVE'
        ? `${correction.stageLabel} unlocked (revision R${batch.currentRevision}).`
        : `${correction.stageLabel} unlock was rejected.`,
    batchId: batch.id,
    link: `/batches/${batch.id}`,
  });

  return { correction, batch };
}

export async function listCorrections(batchId: string) {
  return CorrectionRequest.find({ batchId })
    .populate('requestedBy', 'name employeeId')
    .populate('resolvedBy', 'name employeeId')
    .sort({ createdAt: -1 });
}

export function listStageOptions() {
  return Object.values(STAGE_DEFINITIONS).map((s) => ({
    slug: s.slug as StageSlug,
    label: s.label,
    field: s.field,
  }));
}
