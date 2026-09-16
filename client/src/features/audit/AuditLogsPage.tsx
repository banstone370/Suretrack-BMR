import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, API_BASE, tokenStore } from '../../lib/api';
import type { ApiResponse } from '../../types';

interface AuditRow {
  _id: string;
  actorName?: string;
  actorEmployeeId?: string;
  action: string;
  entityType: string;
  batchId?: string;
  reason?: string;
  createdAt: string;
  oldValue?: unknown;
  newValue?: unknown;
}

function AuditTable({ items }: { items: AuditRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">When</th>
            <th className="px-5 py-3 font-medium">User</th>
            <th className="px-5 py-3 font-medium">Action</th>
            <th className="px-5 py-3 font-medium">Entity</th>
            <th className="px-5 py-3 font-medium">Reason</th>
            <th className="px-5 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <Fragment key={row._id}>
              <tr className="border-t border-line/70">
                <td className="px-5 py-3 text-muted">
                  {new Date(row.createdAt).toLocaleString('en-GB')}
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium">{row.actorName ?? '—'}</div>
                  <div className="text-xs text-muted">{row.actorEmployeeId}</div>
                </td>
                <td className="px-5 py-3 font-medium">{row.action}</td>
                <td className="px-5 py-3 text-muted">{row.entityType}</td>
                <td className="px-5 py-3 text-muted">{row.reason ?? '—'}</td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    className="text-xs text-brand-800 hover:underline"
                    onClick={() => setExpanded(expanded === row._id ? null : row._id)}
                  >
                    {expanded === row._id ? 'Hide' : 'Details'}
                  </button>
                </td>
              </tr>
              {expanded === row._id && (
                <tr className="border-t border-line/40 bg-brand-50/40">
                  <td colSpan={6} className="px-5 py-3">
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted">
                      {JSON.stringify(
                        { oldValue: row.oldValue, newValue: row.newValue },
                        null,
                        2,
                      )}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-muted">
                No audit entries.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  const logs = useQuery({
    queryKey: ['audit-logs', action, actor],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AuditRow[]>>('/audit-logs', {
        params: {
          action: action || undefined,
          actor: actor || undefined,
          limit: 100,
        },
      });
      return data.data;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-950">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted">System-wide activity log (append-only)</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-line bg-white/80 p-4">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter action"
          className="rounded-md border border-line px-3 py-2 text-sm"
        />
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Filter user / employee ID"
          className="rounded-md border border-line px-3 py-2 text-sm"
        />
      </div>

      <AuditTable items={logs.data ?? []} />
    </div>
  );
}

export function BatchAuditPage() {
  const { batchId } = useParams();
  const logs = useQuery({
    queryKey: ['batch-audit', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AuditRow[]>>(`/batches/${batchId}/audit`);
      return data.data;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/batches/${batchId}`} className="text-sm text-brand-800 hover:underline">
          ← Back to batch
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-950">Batch Audit</h1>
        <p className="mt-1 text-sm text-muted">Changes and approvals for this batch record</p>
      </div>
      <AuditTable items={logs.data ?? []} />
    </div>
  );
}

export async function downloadBatchPdf(batchId: string, batchNo: string) {
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_BASE}/batches/${batchId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Failed to generate PDF');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BMR-${batchNo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
