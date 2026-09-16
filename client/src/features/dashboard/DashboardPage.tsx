import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BatchStatusBadge } from '../../components/batch/BatchStatusBadge';
import { api } from '../../lib/api';
import { formatDate, STATUS_LABELS } from '../../lib/utils';
import type { ApiResponse, BatchListItem, DashboardSummary } from '../../types';

const CARDS: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: 'activeBatches', label: 'Active Batches' },
  { key: 'pendingQc', label: 'Pending QC' },
  { key: 'readyFg', label: 'Ready FG' },
  { key: 'pendingApprovals', label: 'Pending Approvals' },
  { key: 'sterilization', label: 'Sterilization' },
  { key: 'dispatch', label: 'Dispatch' },
];

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardSummary>>('/dashboard/summary');
      return data.data;
    },
  });

  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BatchListItem[]>>('/dashboard/recent-batches');
      return data.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">
            eBMR Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">SureTech Medical — batch manufacturing overview</p>
        </div>
        <Link
          to="/batches/create"
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 sm:w-auto sm:py-2"
        >
          Create Batch
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-line bg-white/80 px-3 py-3 shadow-sm sm:px-5 sm:py-4"
          >
            <p className="text-xs text-muted sm:text-sm">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold text-brand-900 sm:text-3xl">
              {summary.data?.[card.key] ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <section className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Recent Batches</h2>
          <Link to="/batches" className="text-sm text-brand-800 hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Batch No.</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Mfg Date</th>
              </tr>
            </thead>
            <tbody>
              {(recent.data ?? []).map((batch) => (
                <tr key={batch.id} className="border-t border-line/70 hover:bg-brand-50/40">
                  <td className="px-5 py-3">
                    <Link
                      to={`/batches/${batch.id}`}
                      className="font-medium text-brand-900 hover:underline"
                    >
                      {batch.batchNo}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{batch.productName}</td>
                  <td className="px-5 py-3 text-muted">
                    {STATUS_LABELS[batch.status] ?? batch.status}
                  </td>
                  <td className="px-5 py-3">
                    <BatchStatusBadge status={batch.status} />
                  </td>
                  <td className="px-5 py-3 text-muted">{formatDate(batch.manufacturingDate)}</td>
                </tr>
              ))}
              {recent.isSuccess && recent.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    No batches yet. Create the first Introducer Needle batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
