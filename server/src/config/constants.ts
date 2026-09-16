export const PRIMARY_BATCH_STATUSES = [
  'DRAFT',
  'RAW_MATERIAL_QC',
  'RAW_MATERIAL_APPROVED',
  'MATERIAL_ISSUED',
  'MANUFACTURING',
  'IN_PROCESS_QC',
  'VISUAL_INSPECTION',
  'PACKING',
  'SEALING',
  'STERILIZATION',
  'LABELLING',
  'STERILITY_TEST',
  'BET_TEST',
  'QA_REVIEW',
  'RELEASED',
  'FINISHED_GOODS',
  'DISPATCHED',
] as const;

export const EXCEPTION_BATCH_STATUSES = [
  'ON_HOLD',
  'REJECTED',
  'CANCELLED',
  'ARCHIVED',
] as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PRODUCTION_CHEMIST: 'Production Chemist',
  QC_OFFICER: 'QC Officer',
  PACKING_OPERATOR: 'Packing Operator',
  STERILIZATION_OPERATOR: 'Sterilization Operator',
  QA_APPROVER: 'QA / Approver',
  DISPATCH_USER: 'Dispatch User',
};
