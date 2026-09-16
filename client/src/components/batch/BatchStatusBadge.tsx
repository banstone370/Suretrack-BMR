import { cn, STATUS_LABELS } from '../../lib/utils';
import type { BatchStatus } from '../../types';

const TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  RAW_MATERIAL_QC: 'bg-sky-100 text-sky-800',
  MANUFACTURING: 'bg-cyan-100 text-cyan-900',
  STERILIZATION: 'bg-teal-100 text-teal-900',
  STERILITY_TEST: 'bg-amber-100 text-amber-900',
  BET_TEST: 'bg-amber-100 text-amber-900',
  QA_REVIEW: 'bg-orange-100 text-orange-900',
  RELEASED: 'bg-emerald-100 text-emerald-900',
  FINISHED_GOODS: 'bg-emerald-100 text-emerald-900',
  DISPATCHED: 'bg-brand-100 text-brand-900',
  ON_HOLD: 'bg-yellow-100 text-yellow-900',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-zinc-200 text-zinc-700',
};

export function BatchStatusBadge({ status }: { status: BatchStatus | string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium tracking-wide',
        TONE[status] ?? 'bg-slate-100 text-slate-700',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
