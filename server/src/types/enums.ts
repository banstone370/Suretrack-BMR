export enum Role {
  ADMIN = 'ADMIN',
  PRODUCTION_CHEMIST = 'PRODUCTION_CHEMIST',
  QC_OFFICER = 'QC_OFFICER',
  PACKING_OPERATOR = 'PACKING_OPERATOR',
  STERILIZATION_OPERATOR = 'STERILIZATION_OPERATOR',
  QA_APPROVER = 'QA_APPROVER',
  DISPATCH_USER = 'DISPATCH_USER',
}

export enum BatchStatus {
  DRAFT = 'DRAFT',
  RAW_MATERIAL_QC = 'RAW_MATERIAL_QC',
  RAW_MATERIAL_APPROVED = 'RAW_MATERIAL_APPROVED',
  MATERIAL_ISSUED = 'MATERIAL_ISSUED',
  MANUFACTURING = 'MANUFACTURING',
  IN_PROCESS_QC = 'IN_PROCESS_QC',
  VISUAL_INSPECTION = 'VISUAL_INSPECTION',
  PACKING = 'PACKING',
  SEALING = 'SEALING',
  STERILIZATION = 'STERILIZATION',
  LABELLING = 'LABELLING',
  STERILITY_TEST = 'STERILITY_TEST',
  BET_TEST = 'BET_TEST',
  QA_REVIEW = 'QA_REVIEW',
  RELEASED = 'RELEASED',
  FINISHED_GOODS = 'FINISHED_GOODS',
  DISPATCHED = 'DISPATCHED',
  ON_HOLD = 'ON_HOLD',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

export enum CheckResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  NA = 'NA',
}

export enum TestResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PENDING = 'PENDING',
}

export enum ProcessStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
}

export enum RecordLockState {
  OPEN = 'OPEN',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
}

export type Permission =
  | 'users:manage'
  | 'products:manage'
  | 'sops:manage'
  | 'rawMaterials:manage'
  | 'system:configure'
  | 'audit:view'
  | 'batches:view_all'
  | 'batches:create'
  | 'batches:edit_production'
  | 'batches:submit_production'
  | 'rm_qc:edit'
  | 'rm_qc:approve'
  | 'rm_consumption:edit'
  | 'manufacturing:edit'
  | 'ipqc:edit'
  | 'visual_inspection:edit'
  | 'packing:edit'
  | 'sealing:edit'
  | 'sterilization:edit'
  | 'eto_cartridge:manage'
  | 'labelling:edit'
  | 'sterility:edit'
  | 'bet:edit'
  | 'qa:review'
  | 'qa:release'
  | 'finished_goods:transfer'
  | 'dispatch:create'
  | 'dispatch:confirm'
  | 'batch:hold'
  | 'batch:cancel'
  | 'batch:request_correction'
  | 'reports:view'
  | 'pdf:generate';
