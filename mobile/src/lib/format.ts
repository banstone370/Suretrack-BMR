export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  RAW_MATERIAL_QC: 'Raw Material QC',
  RAW_MATERIAL_APPROVED: 'RM Approved',
  MATERIAL_ISSUED: 'Material Issued',
  MANUFACTURING: 'Manufacturing',
  IN_PROCESS_QC: 'In-Process QC',
  VISUAL_INSPECTION: 'Visual Inspection',
  PACKING: 'Packing',
  SEALING: 'Sealing',
  STERILIZATION: 'Sterilization',
  LABELLING: 'Labelling',
  STERILITY_TEST: 'Sterility Test',
  BET_TEST: 'BET Test',
  QA_REVIEW: 'QA Review',
  RELEASED: 'Released',
  FINISHED_GOODS: 'Finished Goods',
  DISPATCHED: 'Dispatched',
  ON_HOLD: 'On Hold',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PRODUCTION_CHEMIST: 'Production Chemist',
  QC_OFFICER: 'QC Officer',
  PACKING_OPERATOR: 'Packing Operator',
  STERILIZATION_OPERATOR: 'Sterilization Operator',
  QA_APPROVER: 'QA / Approver',
  DISPATCH_USER: 'Dispatch User',
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as string[];

export function statusLabel(status?: string | null) {
  return status ? STATUS_LABELS[status] ?? status : '—';
}

export function roleLabel(role?: string | null) {
  return role ? ROLE_LABELS[role] ?? role : '—';
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** 'YYYY-MM-DD' today, matching the web inputs */
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isoFromLocale(value?: string | null) {
  if (!value) return '—';
  return value;
}

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export const BATCH_STATUS_TONE: Record<string, 'grey' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'grey',
  RAW_MATERIAL_QC: 'info',
  RAW_MATERIAL_APPROVED: 'info',
  MATERIAL_ISSUED: 'info',
  MANUFACTURING: 'info',
  IN_PROCESS_QC: 'info',
  VISUAL_INSPECTION: 'info',
  PACKING: 'info',
  SEALING: 'info',
  STERILIZATION: 'info',
  LABELLING: 'info',
  STERILITY_TEST: 'info',
  BET_TEST: 'info',
  QA_REVIEW: 'info',
  RELEASED: 'success',
  FINISHED_GOODS: 'success',
  DISPATCHED: 'success',
  ON_HOLD: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  ARCHIVED: 'grey',
};
