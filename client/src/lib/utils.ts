export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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

export const ROLE_LABELS: Record<string, string> = {  ADMIN: 'Admin',
  PRODUCTION_CHEMIST: 'Production Chemist',
  QC_OFFICER: 'QC Officer',
  PACKING_OPERATOR: 'Packing Operator',
  STERILIZATION_OPERATOR: 'Sterilization Operator',
  QA_APPROVER: 'QA / Approver',
  DISPATCH_USER: 'Dispatch User',
};

/** Local yyyy-mm-dd for today, safe for <input type="date">. */
export function todayInput(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** True when a yyyy-mm-dd date is strictly before today (local time). */
export function isBeforeToday(value?: string | null): boolean {
  if (!value) return false;
  return value < todayInput();
}

/** Returns an error message when a process date is in the past, else ''. */
export function processDateError(
  value: string | undefined,
  label = 'Process date',
): string {
  if (!value) return '';
  return isBeforeToday(value) ? `${label} cannot be before today.` : '';
}

/** Returns an error message when end time precedes start time, else ''. */
export function timeOrderError(
  start?: string | null,
  end?: string | null,
  label = 'End time',
): string {
  if (!start || !end) return '';
  const toMinutes = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return toMinutes(end) < toMinutes(start)
    ? `${label} cannot be before the start time.`
    : '';
}
