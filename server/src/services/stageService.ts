import { Request } from 'express';
import { Types } from 'mongoose';
import { writeAudit } from '../audit/auditLogger.js';
import { Batch, IBatch } from '../models/Batch.js';
import { EtoCartridge } from '../models/EtoCartridge.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { User } from '../models/User.js';
import {
  BatchStatus,
  CheckResult,
  ProcessStatus,
  RecordLockState,
  TestResult,
} from '../types/enums.js';
import { AuthUser } from '../types/express.js';
import { AppError } from '../utils/errors.js';
import { verifyPassword } from '../utils/authTokens.js';
import { hasPermission } from '../workflow/permissions.js';
import {
  getStageDef,
  isStageLocked,
  makeSignature,
  StageSlug,
} from '../workflow/stageConfig.js';
import {
  batchProgressPercent,
  buildTimeline,
} from '../workflow/batchStateMachine.js';

function serializeBatch(batch: IBatch) {
  const obj = batch.toObject();
  return {
    ...obj,
    id: batch.id,
    progressPercent: batchProgressPercent(batch.status),
    timeline: buildTimeline(batch.status),
  };
}

async function loadBatch(batchId: string) {
  if (!Types.ObjectId.isValid(batchId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid batch id');
  }
  const batch = await Batch.findById(batchId);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  return batch;
}

async function verifyESign(user: AuthUser, password: string) {
  const dbUser = await User.findById(user.id);
  if (!dbUser || !dbUser.isActive) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }
  const ok = await verifyPassword(password, dbUser.passwordHash);
  if (!ok) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Electronic signature password is incorrect');
  }
}

function getStageData(batch: IBatch, field: string): Record<string, unknown> {
  const stages = (batch.stages ?? {}) as Record<string, Record<string, unknown>>;
  return { ...(stages[field] ?? {}) };
}

function setStageData(batch: IBatch, field: string, data: Record<string, unknown>) {
  const stages = {
    ...((batch.stages ?? {}) as Record<string, unknown>),
    [field]: data,
  };
  batch.stages = stages;
  batch.markModified('stages');
}

function transition(
  batch: IBatch,
  next: BatchStatus,
  user: AuthUser,
  reason: string,
) {
  batch.statusHistory.push({
    status: next,
    at: new Date(),
    by: new Types.ObjectId(user.id),
    reason,
  });
  batch.status = next;
  void import('./notificationService.js').then(({ notifyStatusChange }) =>
    notifyStatusChange({
      batchId: batch.id,
      batchNo: batch.batchNo,
      status: next,
    }).catch(() => undefined),
  );
}

function validateRmQcPayload(payload: Record<string, unknown>) {
  const checks = payload.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one QC check row is required');
  }
  for (const row of checks) {
    const r = row as Record<string, unknown>;
    if (!r.process) throw new AppError(400, 'VALIDATION_ERROR', 'Process name required');
    if (!r.result || !['PASS', 'FAIL', 'NA'].includes(String(r.result))) {
      throw new AppError(400, 'VALIDATION_ERROR', `Result required for ${r.process}`);
    }
  }
}

function validateConsumptionPayload(payload: Record<string, unknown>) {
  const lines = payload.lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one consumption line is required');
  }
  for (const line of lines) {
    const l = line as Record<string, unknown>;
    if (!l.rawMaterialName) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Raw material name is required');
    }
    if (!l.supplierBatchNo) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Supplier batch no. is required');
    }
    const qty = Number(l.quantityWithdrawn);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Quantity withdrawn must be > 0');
    }
  }
}

function validateManufacturingPayload(payload: Record<string, unknown>, forSubmit: boolean) {
  if (!forSubmit) return;
  if (!payload.processDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Process date is required');
  }
  if (!payload.startTime || !payload.endTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Start and end time are required');
  }
}

function validateIpqcPayload(payload: Record<string, unknown>) {
  if (
    payload.dustFree !== true ||
    payload.burrFree !== true ||
    payload.foreignParticleFree !== true
  ) {
    // Allow fail path via result FAIL, but require explicit fields
  }
  if (!['PASS', 'FAIL', 'NA'].includes(String(payload.result ?? ''))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Overall result (PASS/FAIL/NA) is required');
  }
}

function validateVisualPayload(payload: Record<string, unknown>) {
  const unitsChecked = Number(payload.unitsChecked);
  const particlesFound = Number(payload.particlesFound);
  if (!Number.isFinite(unitsChecked) || unitsChecked < 0 || !Number.isInteger(unitsChecked)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Units checked must be a non-negative integer');
  }
  if (!Number.isFinite(particlesFound) || particlesFound < 0 || !Number.isInteger(particlesFound)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Particles found must be a non-negative integer');
  }
  if (particlesFound > unitsChecked) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Particles found cannot exceed units checked',
    );
  }
  if (!payload.inspectionDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Inspection date is required');
  }
}

function normalizeVisual(payload: Record<string, unknown>) {
  const unitsChecked = Number(payload.unitsChecked) || 0;
  const particlesFound = Number(payload.particlesFound) || 0;
  return {
    ...payload,
    unitsChecked,
    particlesFound,
    particlesFoundPercent:
      unitsChecked === 0 ? 0 : Number(((particlesFound / unitsChecked) * 100).toFixed(2)),
  };
}

function normalizePacking(payload: Record<string, unknown>) {
  const pouchesTaken = Number(payload.pouchesTaken) || 0;
  const pouchesDamaged = Number(payload.pouchesDamaged) || 0;
  const devicesPacked = Number(payload.devicesPacked) || 0;
  return {
    ...payload,
    pouchesTaken,
    pouchesDamaged,
    devicesPacked,
    goodPouches: pouchesTaken - pouchesDamaged,
  };
}

function validatePackingPayload(payload: Record<string, unknown>) {
  const pouchesTaken = Number(payload.pouchesTaken);
  const pouchesDamaged = Number(payload.pouchesDamaged);
  const devicesPacked = Number(payload.devicesPacked);
  if (!Number.isFinite(pouchesTaken) || pouchesTaken < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Pouches taken must be ≥ 0');
  }
  if (!Number.isFinite(pouchesDamaged) || pouchesDamaged < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Pouches damaged must be ≥ 0');
  }
  if (pouchesDamaged > pouchesTaken) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Damaged pouches cannot exceed pouches taken');
  }
  if (!Number.isFinite(devicesPacked) || devicesPacked < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Devices packed must be ≥ 0');
  }
  if (!payload.packingDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Packing date is required');
  }
}

function validateSealingPayload(payload: Record<string, unknown>, forSubmit: boolean) {
  if (!forSubmit) return;
  if (payload.actualTemperatureC === undefined || payload.actualTemperatureC === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Actual sealing temperature is required');
  }
  const devicesSealed = Number(payload.devicesSealed);
  if (!Number.isFinite(devicesSealed) || devicesSealed < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Devices sealed must be ≥ 0');
  }
  if (!payload.sealingDate || !payload.startTime || !payload.endTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Sealing date, start and end time are required');
  }
}

function validateSterilizationPayload(payload: Record<string, unknown>, forSubmit: boolean) {
  if (!forSubmit) return;
  if (!payload.quantity || Number(payload.quantity) <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Quantity is required');
  }
  if (!payload.startDate || !payload.startTime || !payload.endDate || !payload.endTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Start/end date and time are required');
  }
  if (!payload.machineId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Machine ID is required');
  }
  if (!payload.etoCartridgeId && !payload.cartridgeBatchNo) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ETO cartridge selection is required');
  }
}

function validateLabellingPayload(payload: Record<string, unknown>) {
  const labelsPrinted = Number(payload.labelsPrinted);
  const labelsUsed = Number(payload.labelsUsed);
  const labelsDestroyed = Number(payload.labelsDestroyed);
  const devicesLabelled = Number(payload.devicesLabelled);
  for (const [name, value] of [
    ['Labels printed', labelsPrinted],
    ['Labels used', labelsUsed],
    ['Labels destroyed', labelsDestroyed],
    ['Devices labelled', devicesLabelled],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', `${name} must be ≥ 0`);
    }
  }
  if (labelsUsed > labelsPrinted && !String(payload.overrideReason ?? '').trim()) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Labels used cannot exceed labels printed without an override reason',
    );
  }
  if (!payload.doneOn) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Done on date is required');
  }
}

function validateLabTestPayload(payload: Record<string, unknown>, label: string) {
  if (!payload.testDate && !payload.doneOn) {
    throw new AppError(400, 'VALIDATION_ERROR', `${label} date is required`);
  }
  if (!String(payload.reportNo ?? '').trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Report number is required');
  }
  const result = String(payload.result ?? '');
  if (result !== TestResult.PASS && result !== TestResult.FAIL) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Result must be PASS or FAIL');
  }
  if (!payload.reportingDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reporting date is required');
  }
  if (!payload.startTime || !payload.endTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Start and end time are required');
  }
}

function validateQaPayload(payload: Record<string, unknown>, forSubmit: boolean) {
  if (forSubmit && !String(payload.reviewNotes ?? '').trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'QA review notes are required');
  }
}

function validateFinishedGoodsPayload(payload: Record<string, unknown>, forSubmit: boolean) {
  if (!forSubmit) return;
  const quantity = Number(payload.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Finished product quantity must be > 0');
  }
  if (!payload.transferDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Transfer date is required');
  }
}

function computeExpectedEnd(startDate: string, startTime: string, durationHours: number): Date {
  const [hh, mm] = startTime.split(':').map(Number);
  const start = new Date(startDate);
  start.setHours(hh || 0, mm || 0, 0, 0);
  return new Date(start.getTime() + durationHours * 60 * 60 * 1000);
}

function validateStagePayload(slug: StageSlug, payload: Record<string, unknown>, forSubmit: boolean) {
  switch (slug) {
    case 'raw-material-qc':
      if (forSubmit) validateRmQcPayload(payload);
      break;
    case 'raw-material-consumption':
      if (forSubmit) validateConsumptionPayload(payload);
      break;
    case 'manufacturing':
      validateManufacturingPayload(payload, forSubmit);
      break;
    case 'in-process-qc':
      if (forSubmit) validateIpqcPayload(payload);
      break;
    case 'visual-inspection':
      if (forSubmit) validateVisualPayload(payload);
      break;
    case 'packing':
      if (forSubmit) validatePackingPayload(payload);
      break;
    case 'sealing':
      validateSealingPayload(payload, forSubmit);
      break;
    case 'sterilization':
      validateSterilizationPayload(payload, forSubmit);
      break;
    case 'labelling':
      if (forSubmit) validateLabellingPayload(payload);
      break;
    case 'sterility':
      if (forSubmit) validateLabTestPayload(payload, 'Sterility test');
      break;
    case 'bet':
      if (forSubmit) validateLabTestPayload(payload, 'BET test');
      break;
    case 'qa':
      validateQaPayload(payload, forSubmit);
      break;
    case 'finished-goods':
      validateFinishedGoodsPayload(payload, forSubmit);
      break;
  }
}

export async function getStage(batchId: string, slug: string) {
  const def = getStageDef(slug);
  if (!def) throw new AppError(404, 'NOT_FOUND', 'Unknown stage');
  const batch = await loadBatch(batchId);
  return {
    batchId: batch.id,
    batchNo: batch.batchNo,
    status: batch.status,
    progressPercent: batchProgressPercent(batch.status),
    stage: def.slug,
    label: def.label,
    data: getStageData(batch, def.field),
    processParamsSnapshot: batch.processParamsSnapshot,
  };
}

export async function saveStage(params: {
  batchId: string;
  slug: string;
  payload: Record<string, unknown>;
  user: AuthUser;
  req?: Request;
}) {
  const def = getStageDef(params.slug);
  if (!def) throw new AppError(404, 'NOT_FOUND', 'Unknown stage');
  if (!hasPermission(params.user.role, def.editPermission)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  const batch = await loadBatch(params.batchId);
  if (!def.editableWhen.includes(batch.status)) {
    throw new AppError(400, 'INVALID_STATE', `Cannot edit ${def.label} while status is ${batch.status}`);
  }

  const current = getStageData(batch, def.field);
  if (isStageLocked(String(current.lockState ?? ''))) {
    throw new AppError(400, 'LOCKED', `${def.label} is locked. Request a correction to edit.`);
  }

  validateStagePayload(def.slug, params.payload, false);

  let nextData: Record<string, unknown> = {
    ...current,
    ...params.payload,
    lockState: RecordLockState.OPEN,
  };

  if (def.slug === 'visual-inspection') {
    nextData = normalizeVisual(nextData);
  }
  if (def.slug === 'packing') {
    nextData = normalizePacking(nextData);
  }
  if (def.slug === 'sterilization' && nextData.startDate && nextData.startTime) {
    const hours = Number(
      nextData.requiredDurationHours ??
        batch.processParamsSnapshot?.sterilizationParams?.durationHours ??
        4,
    );
    nextData.expectedEndAt = computeExpectedEnd(
      String(nextData.startDate).slice(0, 10),
      String(nextData.startTime),
      hours,
    );
    nextData.cycleStatus = ProcessStatus.IN_PROGRESS;
  }
  if (def.slug === 'manufacturing' && !nextData.status) {
    nextData.status = ProcessStatus.IN_PROGRESS;
  }
  if (def.slug === 'manufacturing' && batch.status === BatchStatus.MATERIAL_ISSUED) {
    transition(batch, BatchStatus.MANUFACTURING, params.user, 'Manufacturing started');
  }

  const oldValue = current;
  setStageData(batch, def.field, nextData);
  await batch.save();

  await writeAudit({
    actor: params.user,
    action: `SAVE_${def.field.toUpperCase()}`,
    entityType: 'Batch',
    entityId: batch.id,
    batchId: batch.id,
    oldValue,
    newValue: nextData,
    req: params.req,
  });

  return serializeBatch(batch);
}

export async function submitStage(params: {
  batchId: string;
  slug: string;
  payload: Record<string, unknown>;
  password: string;
  statement?: string;
  reason?: string;
  user: AuthUser;
  req?: Request;
}) {
  const def = getStageDef(params.slug);
  if (!def) throw new AppError(404, 'NOT_FOUND', 'Unknown stage');
  if (!hasPermission(params.user.role, def.editPermission)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  if (!params.password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Electronic signature password is required');
  }
  await verifyESign(params.user, params.password);

  const batch = await loadBatch(params.batchId);
  if (!def.submittableWhen.includes(batch.status)) {
    throw new AppError(400, 'INVALID_STATE', `Cannot submit ${def.label} while status is ${batch.status}`);
  }

  const current = getStageData(batch, def.field);
  if (isStageLocked(String(current.lockState ?? '')) && current.lockState !== RecordLockState.SUBMITTED) {
    throw new AppError(400, 'LOCKED', `${def.label} is locked`);
  }

  validateStagePayload(def.slug, params.payload, true);
  const signature = makeSignature(params.user, params.statement);

  let nextData: Record<string, unknown> = {
    ...current,
    ...params.payload,
  };

  if (def.slug === 'visual-inspection') {
    nextData = normalizeVisual(nextData);
  }
  if (def.slug === 'packing') {
    nextData = normalizePacking(nextData);
  }
  if (def.slug === 'sterilization' && nextData.startDate && nextData.startTime) {
    const hours = Number(
      nextData.requiredDurationHours ??
        batch.processParamsSnapshot?.sterilizationParams?.durationHours ??
        4,
    );
    nextData.expectedEndAt = computeExpectedEnd(
      String(nextData.startDate).slice(0, 10),
      String(nextData.startTime),
      hours,
    );
  }

  if (def.slug === 'raw-material-qc') {
    const incoming = nextData.checks as Array<Record<string, unknown>>;
    const checks = incoming.map((c) => ({
      ...c,
      doneBy: c.doneBy ?? signature,
      checkedBy: c.checkedBy ?? signature,
    }));
    const failed = incoming.some((c) => c.result === CheckResult.FAIL);
    nextData = {
      ...nextData,
      checks,
      overallResult: failed ? CheckResult.FAIL : CheckResult.PASS,
      submittedAt: new Date(),
      lockState: RecordLockState.SUBMITTED,
    };
  } else if (def.slug === 'raw-material-consumption') {
    const lines = (nextData.lines as Array<Record<string, unknown>>).map((l) => ({
      ...l,
      doneBy: l.doneBy ?? signature,
      checkedBy: l.checkedBy ?? signature,
    }));
    nextData = {
      ...nextData,
      lines,
      submittedAt: new Date(),
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'manufacturing') {
    nextData = {
      ...nextData,
      status: ProcessStatus.VERIFIED,
      operator: signature,
      verifiedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'in-process-qc') {
    nextData = {
      ...nextData,
      doneBy: signature,
      submittedAt: new Date(),
      lockState: RecordLockState.SUBMITTED,
    };
  } else if (def.slug === 'visual-inspection') {
    nextData = {
      ...nextData,
      doneBy: signature,
      checkedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'packing') {
    nextData = {
      ...nextData,
      operator: signature,
      checker: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'sealing') {
    nextData = {
      ...nextData,
      configuredTemperatureC:
        nextData.configuredTemperatureC ??
        batch.processParamsSnapshot?.sealingParams?.temperatureC,
      sopRef: nextData.sopRef ?? batch.processParamsSnapshot?.sealingParams?.sopRef,
      operator: signature,
      checker: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'sterilization') {
    const grams =
      Number(nextData.etoCartridgeGrams) ||
      batch.processParamsSnapshot?.sterilizationParams?.etoCartridgeGrams ||
      40;
    let cartridge = null as InstanceType<typeof EtoCartridge> | null;
    if (nextData.etoCartridgeId) {
      cartridge = await EtoCartridge.findById(String(nextData.etoCartridgeId));
    } else if (nextData.cartridgeBatchNo) {
      cartridge = await EtoCartridge.findOne({
        cartridgeBatchNo: String(nextData.cartridgeBatchNo),
      });
    }
    if (!cartridge) {
      throw new AppError(404, 'NOT_FOUND', 'ETO cartridge not found');
    }
    if (cartridge.status !== 'AVAILABLE' && cartridge.status !== 'RESERVED') {
      throw new AppError(400, 'INVALID_STATE', `Cartridge status is ${cartridge.status}`);
    }
    if (cartridge.expiryDate < new Date()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ETO cartridge is expired');
    }
    if (cartridge.quantityRemainingGrams < grams) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Insufficient ETO cartridge quantity remaining');
    }
    cartridge.quantityRemainingGrams -= grams;
    cartridge.status = cartridge.quantityRemainingGrams <= 0 ? 'USED' : 'AVAILABLE';
    cartridge.usedForBatchId = batch._id as typeof cartridge.usedForBatchId;
    cartridge.usedDate = new Date();
    await cartridge.save();

    nextData = {
      ...nextData,
      etoCartridgeId: cartridge.id,
      cartridgeBatchNo: cartridge.cartridgeBatchNo,
      configuredTemperatureC:
        nextData.configuredTemperatureC ??
        batch.processParamsSnapshot?.sterilizationParams?.temperatureC,
      requiredDurationHours:
        nextData.requiredDurationHours ??
        batch.processParamsSnapshot?.sterilizationParams?.durationHours,
      etoCartridgeGrams: grams,
      sopRef: nextData.sopRef ?? batch.processParamsSnapshot?.sterilizationParams?.sopRef,
      operator: signature,
      checkedBy: signature,
      cycleStatus: ProcessStatus.COMPLETED,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'labelling') {
    nextData = {
      ...nextData,
      printedBy: signature,
      checkedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'sterility') {
    nextData = {
      ...nextData,
      sopRef: nextData.sopRef ?? batch.processParamsSnapshot?.sterilitySop ?? 'SOP/QC/004',
      testDate: nextData.testDate ?? nextData.doneOn,
      testedBy: signature,
      checkedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'bet') {
    nextData = {
      ...nextData,
      sopRef: nextData.sopRef ?? batch.processParamsSnapshot?.betSop ?? 'SOP/QC/005',
      testDate: nextData.testDate ?? nextData.doneOn,
      testedBy: signature,
      checkedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  } else if (def.slug === 'qa') {
    nextData = {
      ...nextData,
      submittedAt: new Date(),
      submittedBy: signature,
      lockState: RecordLockState.SUBMITTED,
    };
  } else if (def.slug === 'finished-goods') {
    const quantity = Number(nextData.quantity);
    if (quantity > batch.batchSize) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Finished quantity cannot exceed batch size',
      );
    }
    const existing = await FinishedGood.findOne({ batchId: batch._id });
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Finished goods record already exists for this batch');
    }
    const receivedOn = nextData.receivedOn
      ? new Date(String(nextData.receivedOn))
      : new Date(String(nextData.transferDate));
    const storageCondition =
      String(nextData.storageCondition ?? '') ||
      batch.processParamsSnapshot?.storageCondition ||
      'Store at Room Temperature';

    const fg = await FinishedGood.create({
      batchId: batch._id,
      batchNo: batch.batchNo,
      productId: batch.productId,
      productName: batch.productName,
      catalogueNo: batch.catalogueNo,
      quantityAvailable: quantity,
      quantityReserved: 0,
      quantityDispatched: 0,
      receivedOn,
      expiryDate: batch.expiryDate,
      storageCondition,
      status: 'AVAILABLE',
    });

    nextData = {
      ...nextData,
      quantity,
      receivedOn,
      expiryDate: batch.expiryDate,
      storageCondition,
      finishedGoodsId: fg.id,
      transferredBy: signature,
      approvedBy: signature,
      lockState: RecordLockState.LOCKED,
    };
  }

  const oldStatus = batch.status;
  setStageData(batch, def.field, nextData);

  if (def.requiresApprove) {
    // stay in current status awaiting approve
  } else if (def.slug === 'sterility' || def.slug === 'bet') {
    const result = String(nextData.result);
    if (result === TestResult.FAIL) {
      batch.rejectReason = params.reason ?? `${def.label} failed`;
      transition(
        batch,
        def.nextOnReject ?? BatchStatus.REJECTED,
        params.user,
        batch.rejectReason,
      );
    } else if (def.nextOnSubmit) {
      transition(batch, def.nextOnSubmit, params.user, params.reason ?? `${def.label} passed`);
    }
  } else if (def.nextOnSubmit) {
    if (def.slug === 'manufacturing' && batch.status === BatchStatus.MATERIAL_ISSUED) {
      transition(batch, BatchStatus.MANUFACTURING, params.user, 'Manufacturing in progress');
    }
    transition(batch, def.nextOnSubmit, params.user, params.reason ?? `${def.label} submitted`);
  }

  await batch.save();

  await writeAudit({
    actor: params.user,
    action: `SUBMIT_${def.field.toUpperCase()}`,
    entityType: 'Batch',
    entityId: batch.id,
    batchId: batch.id,
    oldValue: { status: oldStatus, stage: current },
    newValue: { status: batch.status, stage: nextData },
    reason: params.reason,
    req: params.req,
  });

  return serializeBatch(batch);
}

export async function approveStage(params: {
  batchId: string;
  slug: string;
  password: string;
  statement?: string;
  reason?: string;
  user: AuthUser;
  req?: Request;
}) {
  const def = getStageDef(params.slug);
  if (!def || !def.requiresApprove || !def.approvePermission || !def.nextOnApprove) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This stage does not support approval');
  }
  if (!hasPermission(params.user.role, def.approvePermission)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  if (!params.password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Electronic signature password is required');
  }
  await verifyESign(params.user, params.password);
  const batch = await loadBatch(params.batchId);

  if (!def.submittableWhen.includes(batch.status)) {
    throw new AppError(400, 'INVALID_STATE', `Cannot approve ${def.label} while status is ${batch.status}`);
  }

  const current = getStageData(batch, def.field);
  if (current.lockState !== RecordLockState.SUBMITTED) {
    throw new AppError(400, 'INVALID_STATE', `${def.label} must be submitted before approval`);
  }

  const signature = makeSignature(
    params.user,
    params.statement ??
      (def.slug === 'qa'
        ? 'I confirm that I have reviewed this batch record and authorize release.'
        : 'I confirm that I have reviewed this record.'),
  );

  if (def.slug === 'raw-material-qc') {
    if (current.overallResult === CheckResult.FAIL) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot approve QC with FAIL result — reject instead');
    }
  }
  if (def.slug === 'in-process-qc') {
    if (current.result === CheckResult.FAIL) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot approve IPQC with FAIL result — reject instead');
    }
  }

  const nextData = {
    ...current,
    approvedAt: new Date(),
    approvedBy: signature,
    reviewedBy: def.slug === 'qa' ? signature : current.reviewedBy,
    reviewedAt: def.slug === 'qa' ? new Date() : current.reviewedAt,
    decision: def.slug === 'qa' ? 'APPROVED' : current.decision,
    releaseStatement:
      def.slug === 'qa'
        ? params.statement ??
          'I confirm that I have reviewed this batch record and authorize release.'
        : current.releaseStatement,
    qcCheckedBy: def.slug === 'in-process-qc' ? signature : current.qcCheckedBy,
    checkedBy: def.slug === 'in-process-qc' ? signature : current.checkedBy,
    lockState: RecordLockState.APPROVED,
  };

  const oldStatus = batch.status;
  setStageData(batch, def.field, nextData);
  transition(
    batch,
    def.nextOnApprove,
    params.user,
    params.reason ?? (def.slug === 'qa' ? 'Batch released by QA' : `${def.label} approved`),
  );
  await batch.save();

  await writeAudit({
    actor: params.user,
    action: `APPROVE_${def.field.toUpperCase()}`,
    entityType: 'Batch',
    entityId: batch.id,
    batchId: batch.id,
    oldValue: { status: oldStatus },
    newValue: { status: batch.status },
    reason: params.reason,
    req: params.req,
  });

  return serializeBatch(batch);
}

export async function rejectStage(params: {
  batchId: string;
  slug: string;
  password: string;
  reason: string;
  statement?: string;
  decision?: 'REJECTED' | 'HOLD';
  user: AuthUser;
  req?: Request;
}) {
  const def = getStageDef(params.slug);
  if (!def || !def.requiresApprove || !def.approvePermission || !def.nextOnReject) {
    throw new AppError(400, 'VALIDATION_ERROR', 'This stage does not support rejection');
  }
  if (!hasPermission(params.user.role, def.approvePermission)) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
  }
  if (!params.reason?.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Rejection reason is required');
  }

  if (!params.password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Electronic signature password is required');
  }
  await verifyESign(params.user, params.password);
  const batch = await loadBatch(params.batchId);

  if (!def.submittableWhen.includes(batch.status)) {
    throw new AppError(400, 'INVALID_STATE', `Cannot reject ${def.label} while status is ${batch.status}`);
  }

  const current = getStageData(batch, def.field);
  const signature = makeSignature(params.user, params.statement);
  const hold = def.slug === 'qa' && params.decision === 'HOLD';
  const nextStatus = hold
    ? BatchStatus.ON_HOLD
    : def.slug === 'in-process-qc'
      ? def.nextOnReject
      : def.nextOnReject;

  const nextData = {
    ...current,
    rejectedAt: new Date(),
    rejectedBy: signature,
    rejectReason: params.reason,
    decision: hold ? 'HOLD' : 'REJECTED',
    lockState: RecordLockState.LOCKED,
  };

  const oldStatus = batch.status;
  setStageData(batch, def.field, nextData);
  if (hold) {
    batch.previousStatus = batch.status;
    batch.holdReason = params.reason;
  } else if (nextStatus === BatchStatus.REJECTED) {
    batch.rejectReason = params.reason;
  } else if (nextStatus === BatchStatus.ON_HOLD) {
    batch.holdReason = params.reason;
    batch.previousStatus = batch.status;
  }
  transition(batch, nextStatus, params.user, params.reason);
  await batch.save();

  await writeAudit({
    actor: params.user,
    action: hold ? `HOLD_${def.field.toUpperCase()}` : `REJECT_${def.field.toUpperCase()}`,
    entityType: 'Batch',
    entityId: batch.id,
    batchId: batch.id,
    oldValue: { status: oldStatus },
    newValue: { status: batch.status },
    reason: params.reason,
    req: params.req,
  });

  return serializeBatch(batch);
}
