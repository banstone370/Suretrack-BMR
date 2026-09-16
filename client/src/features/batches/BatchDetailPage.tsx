import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BatchProgress } from '../../components/batch/BatchProgress';
import { BatchStatusBadge } from '../../components/batch/BatchStatusBadge';
import { ProcessTimeline } from '../../components/batch/ProcessTimeline';
import { downloadBatchPdf } from '../audit/AuditLogsPage';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse, BatchDetail } from '../../types';

const STAGE_LINKS = [
  { path: 'raw-material', label: 'Raw Material', ready: true },
  { path: 'manufacturing', label: 'Manufacturing', ready: true },
  { path: 'qc', label: 'In-Process QC', ready: true },
  { path: 'inspection', label: 'Inspection', ready: true },
  { path: 'packing', label: 'Packing', ready: true },
  { path: 'sealing', label: 'Sealing', ready: true },
  { path: 'sterilization', label: 'Sterilization', ready: true },
  { path: 'labelling', label: 'Labelling', ready: true },
  { path: 'sterility', label: 'Sterility', ready: true },
  { path: 'bet', label: 'BET', ready: true },
  { path: 'qa', label: 'QA', ready: true },
  { path: 'finished-goods', label: 'Finished Goods', ready: true },
  { path: 'dispatch', label: 'Dispatch', ready: true },
  { path: 'audit', label: 'Audit', ready: true },
];

const CORRECTION_STAGES = [
  { slug: 'raw-material-qc', label: 'Raw Material QC' },
  { slug: 'raw-material-consumption', label: 'RM Consumption' },
  { slug: 'manufacturing', label: 'Manufacturing' },
  { slug: 'in-process-qc', label: 'In-Process QC' },
  { slug: 'visual-inspection', label: 'Visual Inspection' },
  { slug: 'packing', label: 'Packing' },
  { slug: 'sealing', label: 'Sealing' },
  { slug: 'sterilization', label: 'Sterilization' },
  { slug: 'labelling', label: 'Labelling' },
  { slug: 'sterility', label: 'Sterility' },
  { slug: 'bet', label: 'BET' },
  { slug: 'qa', label: 'QA Review' },
  { slug: 'finished-goods', label: 'Finished Goods' },
];

interface CorrectionRow {
  _id: string;
  stageLabel: string;
  stageSlug: string;
  reason: string;
  status: string;
  newRevision?: number;
  requestedBy?: { name?: string; employeeId?: string };
  createdAt: string;
}

export function BatchDetailPage() {
  const { batchId } = useParams();
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [corrStage, setCorrStage] = useState('manufacturing');
  const [corrReason, setCorrReason] = useState('');

  const batch = useQuery({
    queryKey: ['batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BatchDetail>>(`/batches/${batchId}`);
      return data.data;
    },
  });

  const corrections = useQuery({
    queryKey: ['corrections', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<CorrectionRow[]>>(
        `/batches/${batchId}/corrections`,
      );
      return data.data;
    },
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['batches'] });
    void queryClient.invalidateQueries({ queryKey: ['corrections', batchId] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<BatchDetail>>(`/batches/${batchId}/start`);
      return data.data;
    },
    onSuccess: () => {
      invalidate();
      setActionMsg('Production started');
    },
  });

  const lifecycle = useMutation({
    mutationFn: async (params: {
      action: 'hold' | 'resume' | 'cancel' | 'archive';
      reason?: string;
    }) => {
      const { data } = await api.post(`/batches/${batchId}/${params.action}`, {
        reason: params.reason,
      });
      return data;
    },
    onSuccess: (_d, vars) => {
      invalidate();
      setActionMsg(`Batch ${vars.action} completed`);
      setActionError('');
    },
    onError: (err: unknown) => {
      setActionError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Action failed',
      );
    },
  });

  const requestCorr = useMutation({
    mutationFn: async () => {
      await api.post(`/batches/${batchId}/corrections`, {
        stageSlug: corrStage,
        reason: corrReason,
      });
    },
    onSuccess: () => {
      setCorrReason('');
      invalidate();
      setActionMsg('Correction requested — awaiting QA/Admin approval');
    },
    onError: (err: unknown) => {
      setActionError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Correction request failed',
      );
    },
  });

  const resolveCorr = useMutation({
    mutationFn: async (params: { id: string; decision: 'APPROVE' | 'REJECT' }) => {
      await api.post(`/batches/${batchId}/corrections/${params.id}/resolve`, {
        decision: params.decision,
      });
    },
    onSuccess: () => {
      invalidate();
      setActionMsg('Correction resolved');
    },
  });

  if (batch.isLoading) {
    return <p className="text-sm text-muted">Loading batch…</p>;
  }

  if (batch.isError || !batch.data) {
    return <p className="text-sm text-danger">Batch not found.</p>;
  }

  const b = batch.data;
  const snapshot = b.processParamsSnapshot as {
    sealingParams?: { temperatureC: number; sopRef: string };
    sterilizationParams?: {
      temperatureC: number;
      durationHours: number;
      etoCartridgeGrams: number;
      sopRef: string;
    };
    storageCondition?: string;
  };

  const canResolve =
    hasPermission('qa:release') || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/batches" className="text-sm text-brand-800 hover:underline">
          ← Batches
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold break-words text-brand-950 sm:text-2xl">
              BATCH: {b.batchNo}
            </h1>
            <p className="mt-1 text-sm text-muted">{b.productName}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <BatchStatusBadge status={b.status} />
            {hasPermission('pdf:generate') && (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={async () => {
                  setActionError('');
                  setPdfBusy(true);
                  try {
                    await downloadBatchPdf(batchId!, b.batchNo);
                  } catch {
                    setActionError('PDF generation failed');
                  } finally {
                    setPdfBusy(false);
                  }
                }}
                className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60 sm:py-2"
              >
                {pdfBusy ? 'Generating…' : 'Generate BMR PDF'}
              </button>
            )}
            {b.status === 'DRAFT' && hasPermission('batches:submit_production') && (
              <button
                type="button"
                onClick={() => start.mutate()}
                disabled={start.isPending}
                className="rounded-md bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-60 sm:py-2"
              >
                {start.isPending ? 'Starting…' : 'Start Production'}
              </button>
            )}
          </div>
        </div>
        {actionMsg && <p className="mt-2 text-sm text-accent-600">{actionMsg}</p>}
        {actionError && <p className="mt-2 text-sm text-danger">{actionError}</p>}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-white/90 p-3 shadow-sm">
        {hasPermission('batch:hold') &&
          !['ON_HOLD', 'DISPATCHED', 'CANCELLED', 'ARCHIVED', 'REJECTED'].includes(b.status) && (
            <button
              type="button"
              className="rounded-md border border-warn/40 bg-amber-50 px-3 py-1.5 text-xs font-medium text-warn"
              onClick={() => {
                const reason = window.prompt('Hold reason');
                if (reason) lifecycle.mutate({ action: 'hold', reason });
              }}
            >
              Hold batch
            </button>
          )}
        {b.status === 'ON_HOLD' && canResolve && (
          <button
            type="button"
            className="rounded-md border border-accent-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-accent-600"
            onClick={() => lifecycle.mutate({ action: 'resume' })}
          >
            Resume from hold
          </button>
        )}
        {hasPermission('batch:cancel') &&
          !['DISPATCHED', 'CANCELLED', 'ARCHIVED'].includes(b.status) && (
            <button
              type="button"
              className="rounded-md border border-danger/30 bg-red-50 px-3 py-1.5 text-xs font-medium text-danger"
              onClick={() => {
                const reason = window.prompt('Cancel reason');
                if (reason) lifecycle.mutate({ action: 'cancel', reason });
              }}
            >
              Cancel batch
            </button>
          )}
        {user?.role === 'ADMIN' && ['REJECTED', 'CANCELLED'].includes(b.status) && (
          <button
            type="button"
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium"
            onClick={() => lifecycle.mutate({ action: 'archive' })}
          >
            Archive
          </button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5">
        <BatchProgress percent={b.progressPercent} />
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1 sm:min-w-0 sm:flex-wrap">
          {STAGE_LINKS.map((link) => (
            <Link
              key={link.path}
              to={`/batches/${batchId}/${link.path}`}
              className="shrink-0 rounded-md border border-brand-800/20 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-900 hover:bg-brand-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Batch Information
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Catalogue No.</dt>
              <dd className="mt-1 font-medium">{b.catalogueNo}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Batch Size</dt>
              <dd className="mt-1 font-medium">{b.batchSize.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Mfg Date</dt>
              <dd className="mt-1 font-medium">{formatDate(b.manufacturingDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Expiry</dt>
              <dd className="mt-1 font-medium">{formatDate(b.expiryDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Revision</dt>
              <dd className="mt-1 font-medium">R{b.currentRevision}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Storage</dt>
              <dd className="mt-1 font-medium">
                {snapshot.storageCondition ?? 'Store at Room Temperature'}
              </dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-3 rounded-lg bg-brand-50/70 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Sealing (configured)</p>
              <p className="mt-1 font-medium">
                {snapshot.sealingParams?.temperatureC ?? 200}°C ·{' '}
                {snapshot.sealingParams?.sopRef ?? 'SOP/MF/011'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">ETO Sterilization (configured)</p>
              <p className="mt-1 font-medium">
                {snapshot.sterilizationParams?.temperatureC ?? 55}°C ·{' '}
                {snapshot.sterilizationParams?.durationHours ?? 4}h ·{' '}
                {snapshot.sterilizationParams?.etoCartridgeGrams ?? 40}g ·{' '}
                {snapshot.sterilizationParams?.sopRef ?? 'SOP/MF/008'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Process Timeline
          </h2>
          <ProcessTimeline items={b.timeline} />
        </section>
      </div>

      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Corrections / Unlock
        </h2>
        <p className="text-sm text-muted">
          Locked stages cannot be edited until QA or Admin approves a correction request. Approval
          unlocks the stage and bumps the batch revision.
        </p>

        {hasPermission('batch:request_correction') && (
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <select
              value={corrStage}
              onChange={(e) => setCorrStage(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              {CORRECTION_STAGES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              placeholder="Reason for unlock / correction"
              className="rounded-md border border-line px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!corrReason.trim() || requestCorr.isPending}
              onClick={() => requestCorr.mutate()}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Request
            </button>
          </div>
        )}

        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-50 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(corrections.data ?? []).map((c) => (
                <tr key={c._id} className="border-t border-line/70">
                  <td className="px-3 py-2 font-medium">{c.stageLabel}</td>
                  <td className="px-3 py-2">{c.reason}</td>
                  <td className="px-3 py-2 text-muted">
                    {c.requestedBy?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    {c.status}
                    {c.newRevision ? ` · R${c.newRevision}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    {c.status === 'PENDING' && canResolve && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-accent-600 hover:underline"
                          onClick={() =>
                            resolveCorr.mutate({ id: c._id, decision: 'APPROVE' })
                          }
                        >
                          Approve unlock
                        </button>
                        <button
                          type="button"
                          className="text-xs text-danger hover:underline"
                          onClick={() =>
                            resolveCorr.mutate({ id: c._id, decision: 'REJECT' })
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {corrections.isSuccess && (corrections.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    No correction requests yet.
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
