import { Link } from 'react-router-dom';
import { BatchProgress } from '../batch/BatchProgress';
import { BatchStatusBadge } from '../batch/BatchStatusBadge';
import type { BatchStatus } from '../../types';

interface Props {
  batchId: string;
  batchNo?: string;
  productName?: string;
  status?: BatchStatus | string;
  progressPercent?: number;
  title: string;
  children: React.ReactNode;
}

export function StageShell({
  batchId,
  batchNo,
  productName,
  status,
  progressPercent = 0,
  title,
  children,
}: Props) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <Link to={`/batches/${batchId}`} className="text-sm text-brand-800 hover:underline">
          ← Back to batch
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 break-words text-sm text-muted">
              {batchNo ?? '—'} · {productName ?? '—'}
            </p>
          </div>
          {status && <BatchStatusBadge status={status} />}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-4">
        <BatchProgress percent={progressPercent} />
      </div>
      {children}
    </div>
  );
}
