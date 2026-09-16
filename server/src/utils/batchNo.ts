/** Batch no format: PREFIX + YYMMDD + sequential(2) e.g. IN26091401 */
export function buildBatchNoPrefix(catalogueNo: string, date: Date): string {
  const prefix = catalogueNo.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IN';
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix}${yy}${mm}${dd}`;
}

export function formatBatchNo(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(2, '0')}`;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
