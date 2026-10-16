import type { BatchStatus } from '../types';

export type RouteSlug =
  | 'raw-material'
  | 'manufacturing'
  | 'qc'
  | 'inspection'
  | 'packing'
  | 'sealing'
  | 'sterilization'
  | 'labelling'
  | 'sterility'
  | 'bet'
  | 'qa'
  | 'finished-goods';

export interface StageDef {
  routeSlug: RouteSlug;
  apiSlug: string;
  field: string;
  label: string;
  editPermission: string;
  approvePermission?: string;
  requiresApprove?: boolean;
  editableWhen: BatchStatus[];
  submittableWhen: BatchStatus[];
  submitLabel: string;
  approveLabel?: string;
  approveStatement?: string;
  rejectIsHold?: boolean;
}

export const STAGE_DEFS: Record<RouteSlug, StageDef> = {
  'raw-material': {
    routeSlug: 'raw-material',
    apiSlug: 'raw-material-qc',
    field: 'rawMaterialQc',
    label: 'Raw Material QC',
    editPermission: 'rm_qc:edit',
    approvePermission: 'rm_qc:approve',
    requiresApprove: true,
    editableWhen: ['RAW_MATERIAL_QC'],
    submittableWhen: ['RAW_MATERIAL_QC'],
    submitLabel: 'Submit for Approval',
    approveLabel: 'Approve',
    approveStatement: 'I confirm that I have reviewed this raw material QC record.',
  },
  manufacturing: {
    routeSlug: 'manufacturing',
    apiSlug: 'manufacturing',
    field: 'manufacturing',
    label: 'Manufacturing',
    editPermission: 'manufacturing:edit',
    editableWhen: ['MATERIAL_ISSUED', 'MANUFACTURING'],
    submittableWhen: ['MATERIAL_ISSUED', 'MANUFACTURING'],
    submitLabel: 'Complete & Verify',
  },
  qc: {
    routeSlug: 'qc',
    apiSlug: 'in-process-qc',
    field: 'inProcessQc',
    label: 'In-Process QC',
    editPermission: 'ipqc:edit',
    approvePermission: 'ipqc:edit',
    requiresApprove: true,
    editableWhen: ['IN_PROCESS_QC'],
    submittableWhen: ['IN_PROCESS_QC'],
    submitLabel: 'Submit',
    approveLabel: 'QC Approve',
    rejectIsHold: true,
  },
  inspection: {
    routeSlug: 'inspection',
    apiSlug: 'visual-inspection',
    field: 'visualInspection',
    label: 'Visual Inspection',
    editPermission: 'visual_inspection:edit',
    editableWhen: ['VISUAL_INSPECTION'],
    submittableWhen: ['VISUAL_INSPECTION'],
    submitLabel: 'Complete Inspection',
  },
  packing: {
    routeSlug: 'packing',
    apiSlug: 'packing',
    field: 'packing',
    label: 'Packing',
    editPermission: 'packing:edit',
    editableWhen: ['PACKING'],
    submittableWhen: ['PACKING'],
    submitLabel: 'Complete Packing',
  },
  sealing: {
    routeSlug: 'sealing',
    apiSlug: 'sealing',
    field: 'sealing',
    label: 'Sealing',
    editPermission: 'sealing:edit',
    editableWhen: ['SEALING'],
    submittableWhen: ['SEALING'],
    submitLabel: 'Complete Sealing',
  },
  sterilization: {
    routeSlug: 'sterilization',
    apiSlug: 'sterilization',
    field: 'sterilization',
    label: 'ETO Sterilization',
    editPermission: 'sterilization:edit',
    editableWhen: ['STERILIZATION'],
    submittableWhen: ['STERILIZATION'],
    submitLabel: 'Complete Cycle',
  },
  labelling: {
    routeSlug: 'labelling',
    apiSlug: 'labelling',
    field: 'labelling',
    label: 'Batch Labelling',
    editPermission: 'labelling:edit',
    editableWhen: ['LABELLING'],
    submittableWhen: ['LABELLING'],
    submitLabel: 'Complete Labelling',
  },
  sterility: {
    routeSlug: 'sterility',
    apiSlug: 'sterility',
    field: 'sterilityTest',
    label: 'Sterility Test',
    editPermission: 'sterility:edit',
    editableWhen: ['STERILITY_TEST'],
    submittableWhen: ['STERILITY_TEST'],
    submitLabel: 'Submit Result',
  },
  bet: {
    routeSlug: 'bet',
    apiSlug: 'bet',
    field: 'betTest',
    label: 'BET Test',
    editPermission: 'bet:edit',
    editableWhen: ['BET_TEST'],
    submittableWhen: ['BET_TEST'],
    submitLabel: 'Submit Result',
  },
  qa: {
    routeSlug: 'qa',
    apiSlug: 'qa',
    field: 'qaReview',
    label: 'QA Review',
    editPermission: 'qa:review',
    approvePermission: 'qa:release',
    requiresApprove: true,
    editableWhen: ['QA_REVIEW'],
    submittableWhen: ['QA_REVIEW'],
    submitLabel: 'Submit for Release',
    approveLabel: 'Release Batch',
    approveStatement: 'I confirm that I have reviewed this batch record and authorize release.',
  },
  'finished-goods': {
    routeSlug: 'finished-goods',
    apiSlug: 'finished-goods',
    field: 'finishedGoods',
    label: 'Finished Goods Transfer',
    editPermission: 'finished_goods:transfer',
    editableWhen: ['RELEASED', 'FINISHED_GOODS'],
    submittableWhen: ['RELEASED'],
    submitLabel: 'Complete Transfer',
  },
};

export const CONSUMPTION_DEF = {
  apiSlug: 'raw-material-consumption',
  field: 'rawMaterialConsumption',
  label: 'Raw Material Consumption',
  editPermission: 'rm_consumption:edit',
  editableWhen: ['RAW_MATERIAL_APPROVED', 'MATERIAL_ISSUED'],
  submittableWhen: ['RAW_MATERIAL_APPROVED'],
};
