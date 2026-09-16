import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useStage } from '../../hooks/useStage';
import { api } from '../../lib/api';
import { ROLE_LABELS } from '../../lib/utils';
import type { ApiResponse, BatchDetail } from '../../types';
import { useAuth } from '../auth/AuthContext';

interface QcCheck {
  process: string;
  processDate?: string;
  startTime?: string;
  endTime?: string;
  observation?: string;
  result?: 'PASS' | 'FAIL' | 'NA' | null;
}

const inputClass =
  'rounded border border-line px-2 py-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted disabled:opacity-80';

export function RawMaterialPage() {
  const { batchId } = useParams();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'qc' | 'consumption'>('qc');

  const qc = useStage(batchId, 'raw-material-qc');
  const consumption = useStage(batchId, 'raw-material-consumption');

  const [checks, setChecks] = useState<QcCheck[]>([]);
  const [lines, setLines] = useState<
    Array<{
      rawMaterialName: string;
      supplierBatchNo: string;
      qualityCheckedDate?: string;
      quantityWithdrawn: number;
      unit: string;
      requirementSlipNo?: string;
    }>
  >([]);
  const [signMode, setSignMode] = useState<'submit-qc' | 'approve-qc' | 'reject-qc' | 'submit-cons' | null>(
    null,
  );
  const [msg, setMsg] = useState('');

  const startProduction = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<BatchDetail>>(`/batches/${batchId}/start`);
      return data.data;
    },
    onSuccess: async () => {
      setMsg('Production started — batch is now in Raw Material QC.');
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      await qc.query.refetch();
    },
  });

  useEffect(() => {
    const data = qc.query.data?.data;
    if (data?.checks && Array.isArray(data.checks)) {
      setChecks(
        (data.checks as QcCheck[]).map((c) => ({
          ...c,
          processDate: c.processDate ? String(c.processDate).slice(0, 10) : '',
        })),
      );
    }
  }, [qc.query.data]);

  useEffect(() => {
    const data = consumption.query.data?.data;
    if (data?.lines && Array.isArray(data.lines)) {
      setLines(
        (data.lines as typeof lines).map((l) => ({
          ...l,
          qualityCheckedDate: l.qualityCheckedDate
            ? String(l.qualityCheckedDate).slice(0, 10)
            : '',
        })),
      );
    } else if (consumption.query.isSuccess && lines.length === 0) {
      setLines([
        {
          rawMaterialName: '',
          supplierBatchNo: '',
          quantityWithdrawn: 0,
          unit: 'pcs',
          requirementSlipNo: '',
          qualityCheckedDate: '',
        },
      ]);
    }
  }, [consumption.query.data, consumption.query.isSuccess]);

  const batch = qc.batchQuery.data;
  const qcData = qc.query.data?.data ?? {};
  const consData = consumption.query.data?.data ?? {};
  const qcLocked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(String(qcData.lockState ?? ''));
  const consLocked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(String(consData.lockState ?? ''));
  const canEditQc = hasPermission('rm_qc:edit') && !qcLocked;
  const canEditCons = hasPermission('rm_consumption:edit') && !consLocked;
  const isDraft = batch?.status === 'DRAFT';
  const roleLabel = user ? ROLE_LABELS[user.role] ?? user.role : 'your role';

  function updateCheck(index: number, patch: Partial<QcCheck>) {
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="Raw Material"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('qc')}
          className={`rounded-md px-3 py-2 text-sm sm:py-1.5 ${tab === 'qc' ? 'bg-brand-900 text-white' : 'border border-line bg-white'}`}
        >
          Quality Check
        </button>
        <button
          type="button"
          onClick={() => setTab('consumption')}
          className={`rounded-md px-3 py-2 text-sm sm:py-1.5 ${tab === 'consumption' ? 'bg-brand-900 text-white' : 'border border-line bg-white'}`}
        >
          Consumption
        </button>
      </div>

      {msg && <p className="text-sm text-accent-600">{msg}</p>}

      {isDraft && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Batch is still Draft</p>
          <p className="mt-1">
            Production must start the batch before Quality Control (QC) can fill Raw Material QC.
            Status will change from <strong>Draft</strong> to <strong>Raw Material QC</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasPermission('batches:submit_production') ? (
              <button
                type="button"
                disabled={startProduction.isPending}
                onClick={() => startProduction.mutate()}
                className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-60"
              >
                {startProduction.isPending ? 'Starting…' : 'Start Production'}
              </button>
            ) : (
              <p className="text-xs text-amber-900/80">
                Ask a Production Chemist (or Admin) to open the batch and click{' '}
                <strong>Start Production</strong>.
              </p>
            )}
            <Link
              to={`/batches/${batchId}`}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
            >
              Back to batch
            </Link>
          </div>
        </div>
      )}

      {tab === 'qc' && !canEditQc && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
          <p className="font-semibold">Fields are read-only for {roleLabel}</p>
          <p className="mt-1">
            Only a <strong>QC Officer</strong> (Quality Control) or <strong>Admin</strong> can fill
            and submit Raw Material QC.
            {qcLocked ? ' This QC stage is also locked after submit/approval.' : null}
          </p>
          <p className="mt-2 text-xs text-brand-800">
            Sign in as <code>qc@suretech.local</code> / <code>Demo@12345</code> to complete this
            stage (after the batch is started).
          </p>
        </div>
      )}

      {tab === 'qc' && (
        <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Raw Material QC
            </h2>
            <p className="text-xs text-muted">Lock: {String(qcData.lockState ?? 'OPEN')}</p>
          </div>

          <div className="table-scroll">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Process</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Observation</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((row, index) => (
                  <tr key={row.process} className="border-t border-line/70">
                    <td className="px-3 py-2 font-medium">{row.process}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        disabled={!canEditQc}
                        value={row.processDate ?? ''}
                        onChange={(e) => updateCheck(index, { processDate: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={!canEditQc}
                        value={row.startTime ?? ''}
                        onChange={(e) => updateCheck(index, { startTime: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={!canEditQc}
                        value={row.endTime ?? ''}
                        onChange={(e) => updateCheck(index, { endTime: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={!canEditQc}
                        value={row.observation ?? ''}
                        onChange={(e) => updateCheck(index, { observation: e.target.value })}
                        className={`w-40 ${inputClass}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEditQc}
                        value={row.result ?? ''}
                        onChange={(e) =>
                          updateCheck(index, {
                            result: e.target.value as QcCheck['result'],
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Select</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="NA">N/A</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEditQc && (
              <>
                <button
                  type="button"
                  className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                  onClick={async () => {
                    await qc.save.mutateAsync({ checks });
                    setMsg('QC draft saved');
                  }}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                  onClick={() => setSignMode('submit-qc')}
                >
                  Submit for Approval
                </button>
              </>
            )}
            {hasPermission('rm_qc:approve') && qcData.lockState === 'SUBMITTED' && (
              <>
                <button
                  type="button"
                  className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white"
                  onClick={() => setSignMode('approve-qc')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white"
                  onClick={() => setSignMode('reject-qc')}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'consumption' && (
        <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Raw Material Consumption
            </h2>
            {canEditCons && (
              <button
                type="button"
                className="text-sm text-brand-800 hover:underline"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      rawMaterialName: '',
                      supplierBatchNo: '',
                      quantityWithdrawn: 0,
                      unit: 'pcs',
                    },
                  ])
                }
              >
                + Add line
              </button>
            )}
          </div>

          {!canEditCons && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
              <p className="font-semibold">Consumption is for Production</p>
              <p className="mt-1">
                Only a <strong>Production Chemist</strong> (or Admin) can issue materials after QC
                approval.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-line/80 p-3 sm:grid-cols-3"
              >
                <label className="text-xs font-medium text-muted">
                  Raw material
                  <input
                    disabled={!canEditCons}
                    value={line.rawMaterialName}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, rawMaterialName: e.target.value } : l,
                        ),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Supplier batch no.
                  <input
                    disabled={!canEditCons}
                    value={line.supplierBatchNo}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, supplierBatchNo: e.target.value } : l,
                        ),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Qty withdrawn
                  <input
                    type="number"
                    disabled={!canEditCons}
                    value={line.quantityWithdrawn}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index
                            ? { ...l, quantityWithdrawn: Number(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Unit
                  <input
                    disabled={!canEditCons}
                    value={line.unit}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === index ? { ...l, unit: e.target.value } : l)),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Quality checked on
                  <input
                    type="date"
                    disabled={!canEditCons}
                    value={line.qualityCheckedDate ?? ''}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, qualityCheckedDate: e.target.value } : l,
                        ),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Requirement slip no.
                  <input
                    disabled={!canEditCons}
                    value={line.requirementSlipNo ?? ''}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, requirementSlipNo: e.target.value } : l,
                        ),
                      )
                    }
                    className={`mt-1 w-full ${inputClass} text-sm text-ink`}
                  />
                </label>
              </div>
            ))}
          </div>

          {canEditCons && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                onClick={async () => {
                  await consumption.save.mutateAsync({ lines });
                  setMsg('Consumption draft saved');
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('submit-cons')}
              >
                Submit Issue
              </button>
            </div>
          )}
        </section>
      )}

      <ElectronicSignature
        open={signMode === 'submit-qc'}
        title="Submit Raw Material QC"
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await qc.submit.mutateAsync({ payload: { checks }, password, statement });
          setMsg('QC submitted for approval');
        }}
      />
      <ElectronicSignature
        open={signMode === 'approve-qc'}
        title="Approve Raw Material QC"
        confirmLabel="Approve"
        statement="I confirm that I have reviewed this raw material QC record."
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await qc.approve.mutateAsync({ password, statement });
          setMsg('QC approved');
          setTab('consumption');
        }}
      />
      <ElectronicSignature
        open={signMode === 'reject-qc'}
        title="Reject Raw Material QC"
        confirmLabel="Reject"
        requireReason
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement, reason }) => {
          await qc.reject.mutateAsync({ password, statement, reason: reason! });
          setMsg('QC rejected');
        }}
      />
      <ElectronicSignature
        open={signMode === 'submit-cons'}
        title="Submit Material Issue"
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await consumption.submit.mutateAsync({ payload: { lines }, password, statement });
          setMsg('Material issued');
        }}
      />
    </StageShell>
  );
}
