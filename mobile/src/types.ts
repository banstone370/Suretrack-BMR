export type Role =
  | 'ADMIN'
  | 'PRODUCTION_CHEMIST'
  | 'QC_OFFICER'
  | 'PACKING_OPERATOR'
  | 'STERILIZATION_OPERATOR'
  | 'QA_APPROVER'
  | 'DISPATCH_USER';

export type BatchStatus =
  | 'DRAFT'
  | 'RAW_MATERIAL_QC'
  | 'RAW_MATERIAL_APPROVED'
  | 'MATERIAL_ISSUED'
  | 'MANUFACTURING'
  | 'IN_PROCESS_QC'
  | 'VISUAL_INSPECTION'
  | 'PACKING'
  | 'SEALING'
  | 'STERILIZATION'
  | 'LABELLING'
  | 'STERILITY_TEST'
  | 'BET_TEST'
  | 'QA_REVIEW'
  | 'RELEASED'
  | 'FINISHED_GOODS'
  | 'DISPATCHED'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type CheckResult = 'PASS' | 'FAIL' | 'NA';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  permissions: string[];
}

export interface ProcessParamsSnapshot {
  sealingParams?: { temperatureC: number; sopRef: string; allowedRange?: { min: number; max: number } };
  sterilizationParams?: {
    temperatureC: number;
    durationHours: number;
    etoCartridgeGrams: number;
    sopRef: string;
  };
  sterilitySop?: string;
  betSop?: string;
  storageCondition?: string;
  rmQcChecks?: string[];
  ipqcChecks?: string[];
}

export interface TimelineItem {
  key: string;
  label: string;
  state: 'complete' | 'current' | 'upcoming';
}

export interface BatchListItem {
  id: string;
  batchNo: string;
  productName: string;
  catalogueNo: string;
  batchSize: number;
  manufacturingDate: string;
  expiryDate: string;
  status: BatchStatus;
  progressPercent: number;
  createdAt: string;
}

export interface BatchDetail extends BatchListItem {
  productId: string;
  processParamsSnapshot: ProcessParamsSnapshot;
  stages: Record<string, Record<string, unknown>>;
  timeline: TimelineItem[];
  statusHistory: Array<{ status: BatchStatus; at: string; reason?: string }>;
  currentRevision: number;
  holdReason?: string;
  rejectReason?: string;
}

export interface DashboardSummary {
  activeBatches: number;
  pendingQc: number;
  readyFg: number;
  pendingApprovals: number;
  sterilization: number;
  dispatch: number;
}

export interface Product {
  _id: string;
  name: string;
  catalogueNo: string;
  description?: string;
  defaultBatchSize?: number;
  shelfLifeMonths: number;
  isActive: boolean;
  processTemplateId?: {
    _id: string;
    name: string;
    sealingParams?: { temperatureC: number; sopRef: string };
    sterilizationParams?: {
      temperatureC: number;
      durationHours: number;
      etoCartridgeGrams: number;
      sopRef: string;
    };
    sterilitySop?: string;
    betSop?: string;
    storageCondition?: string;
  };
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
}
