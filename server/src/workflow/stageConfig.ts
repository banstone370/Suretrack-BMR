import { Types } from 'mongoose';
import { BatchStatus, Permission, RecordLockState } from '../types/enums.js';

export type StageSlug =
  | 'raw-material-qc'
  | 'raw-material-consumption'
  | 'manufacturing'
  | 'in-process-qc'
  | 'visual-inspection'
  | 'packing'
  | 'sealing'
  | 'sterilization'
  | 'labelling'
  | 'sterility'
  | 'bet'
  | 'qa'
  | 'finished-goods';

export interface StageDefinition {
  slug: StageSlug;
  field: string;
  label: string;
  editPermission: Permission;
  approvePermission?: Permission;
  editableWhen: BatchStatus[];
  submittableWhen: BatchStatus[];
  nextOnSubmit?: BatchStatus;
  nextOnApprove?: BatchStatus;
  nextOnReject?: BatchStatus;
  requiresApprove?: boolean;
}

export const STAGE_DEFINITIONS: Record<StageSlug, StageDefinition> = {
  'raw-material-qc': {
    slug: 'raw-material-qc',
    field: 'rawMaterialQc',
    label: 'Raw Material QC',
    editPermission: 'rm_qc:edit',
    approvePermission: 'rm_qc:approve',
    editableWhen: [BatchStatus.RAW_MATERIAL_QC],
    submittableWhen: [BatchStatus.RAW_MATERIAL_QC],
    nextOnApprove: BatchStatus.RAW_MATERIAL_APPROVED,
    nextOnReject: BatchStatus.REJECTED,
    requiresApprove: true,
  },
  'raw-material-consumption': {
    slug: 'raw-material-consumption',
    field: 'rawMaterialConsumption',
    label: 'Raw Material Consumption',
    editPermission: 'rm_consumption:edit',
    editableWhen: [BatchStatus.RAW_MATERIAL_APPROVED, BatchStatus.MATERIAL_ISSUED],
    submittableWhen: [BatchStatus.RAW_MATERIAL_APPROVED],
    nextOnSubmit: BatchStatus.MATERIAL_ISSUED,
  },
  manufacturing: {
    slug: 'manufacturing',
    field: 'manufacturing',
    label: 'Manufacturing',
    editPermission: 'manufacturing:edit',
    editableWhen: [BatchStatus.MATERIAL_ISSUED, BatchStatus.MANUFACTURING],
    submittableWhen: [BatchStatus.MATERIAL_ISSUED, BatchStatus.MANUFACTURING],
    nextOnSubmit: BatchStatus.IN_PROCESS_QC,
  },
  'in-process-qc': {
    slug: 'in-process-qc',
    field: 'inProcessQc',
    label: 'In-Process QC',
    editPermission: 'ipqc:edit',
    approvePermission: 'ipqc:edit',
    editableWhen: [BatchStatus.IN_PROCESS_QC],
    submittableWhen: [BatchStatus.IN_PROCESS_QC],
    nextOnApprove: BatchStatus.VISUAL_INSPECTION,
    nextOnReject: BatchStatus.ON_HOLD,
    requiresApprove: true,
  },
  'visual-inspection': {
    slug: 'visual-inspection',
    field: 'visualInspection',
    label: 'Visual Inspection',
    editPermission: 'visual_inspection:edit',
    editableWhen: [BatchStatus.VISUAL_INSPECTION],
    submittableWhen: [BatchStatus.VISUAL_INSPECTION],
    nextOnSubmit: BatchStatus.PACKING,
  },
  packing: {
    slug: 'packing',
    field: 'packing',
    label: 'Packing',
    editPermission: 'packing:edit',
    editableWhen: [BatchStatus.PACKING],
    submittableWhen: [BatchStatus.PACKING],
    nextOnSubmit: BatchStatus.SEALING,
  },
  sealing: {
    slug: 'sealing',
    field: 'sealing',
    label: 'Sealing',
    editPermission: 'sealing:edit',
    editableWhen: [BatchStatus.SEALING],
    submittableWhen: [BatchStatus.SEALING],
    nextOnSubmit: BatchStatus.STERILIZATION,
  },
  sterilization: {
    slug: 'sterilization',
    field: 'sterilization',
    label: 'ETO Sterilization',
    editPermission: 'sterilization:edit',
    editableWhen: [BatchStatus.STERILIZATION],
    submittableWhen: [BatchStatus.STERILIZATION],
    nextOnSubmit: BatchStatus.LABELLING,
  },
  labelling: {
    slug: 'labelling',
    field: 'labelling',
    label: 'Batch Labelling',
    editPermission: 'labelling:edit',
    editableWhen: [BatchStatus.LABELLING],
    submittableWhen: [BatchStatus.LABELLING],
    nextOnSubmit: BatchStatus.STERILITY_TEST,
  },
  sterility: {
    slug: 'sterility',
    field: 'sterilityTest',
    label: 'Sterility Test',
    editPermission: 'sterility:edit',
    editableWhen: [BatchStatus.STERILITY_TEST],
    submittableWhen: [BatchStatus.STERILITY_TEST],
    nextOnSubmit: BatchStatus.BET_TEST,
    nextOnReject: BatchStatus.REJECTED,
  },
  bet: {
    slug: 'bet',
    field: 'betTest',
    label: 'BET Test',
    editPermission: 'bet:edit',
    editableWhen: [BatchStatus.BET_TEST],
    submittableWhen: [BatchStatus.BET_TEST],
    nextOnSubmit: BatchStatus.QA_REVIEW,
    nextOnReject: BatchStatus.REJECTED,
  },
  qa: {
    slug: 'qa',
    field: 'qaReview',
    label: 'QA Review',
    editPermission: 'qa:review',
    approvePermission: 'qa:release',
    editableWhen: [BatchStatus.QA_REVIEW],
    submittableWhen: [BatchStatus.QA_REVIEW],
    nextOnApprove: BatchStatus.RELEASED,
    nextOnReject: BatchStatus.REJECTED,
    requiresApprove: true,
  },
  'finished-goods': {
    slug: 'finished-goods',
    field: 'finishedGoods',
    label: 'Finished Goods Transfer',
    editPermission: 'finished_goods:transfer',
    editableWhen: [BatchStatus.RELEASED, BatchStatus.FINISHED_GOODS],
    submittableWhen: [BatchStatus.RELEASED],
    nextOnSubmit: BatchStatus.FINISHED_GOODS,
  },
};

export function getStageDef(slug: string): StageDefinition | undefined {
  return STAGE_DEFINITIONS[slug as StageSlug];
}

export function makeSignature(
  user: { id: string; name: string; employeeId: string },
  statement?: string,
) {
  return {
    userId: new Types.ObjectId(user.id),
    name: user.name,
    employeeId: user.employeeId,
    signedAt: new Date(),
    method: 'PASSWORD' as const,
    statement:
      statement ?? 'I confirm that I have reviewed this record and the entries are accurate.',
  };
}

export function isStageLocked(lockState?: string): boolean {
  return (
    lockState === RecordLockState.LOCKED ||
    lockState === RecordLockState.APPROVED ||
    lockState === RecordLockState.SUBMITTED
  );
}
