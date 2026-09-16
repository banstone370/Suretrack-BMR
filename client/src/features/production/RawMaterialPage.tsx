import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

interface QcCheck {
  process: string;
  processDate?: string;
  startTime?: string;
  endTime?: string;
  observation?: string;
  result?: 'PASS' | 'FAIL' | 'NA' | null;
}

export function RawMaterialPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
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

  const [sharedDate, setSharedDate] = useState('');
  const [sharedStart, setSharedStart] = useState('');
  const [sharedEnd, setSharedEnd] = useState('');

  function updateCheck(index: number, patch: Partial<QcCheck>) {
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function applyDateTimeToAll() {
    if (!sharedDate && !sharedStart && !sharedEnd) {
      setMsg('Enter a date and/or time above, then apply to all processes.');
      return;
    }
    setChecks((prev) =>
      prev.map((c) => ({
        ...c,
        ...(sharedDate ? { processDate: sharedDate } : {}),
        ...(sharedStart ? { startTime: sharedStart } : {}),
        ...(sharedEnd ? { endTime: sharedEnd } : {}),
      })),
    );
    setMsg('Date and time applied to all process rows.');
  }

  function applyFirstRowDateTimeToAll() {
    const first = checks[0];
    if (!first) return;
    if (!first.processDate && !first.startTime && !first.endTime) {
      setMsg('Fill date/time on the first process row, then apply to all.');
      return;
    }
    setChecks((prev) =>
      prev.map((c, i) =>
        i === 0
          ? c
          : {
              ...c,
              processDate: first.processDate ?? c.processDate,
              startTime: first.startTime ?? c.startTime,
              endTime: first.endTime ?? c.endTime,
            },
      ),
    );
    setSharedDate(first.processDate ?? '');
    setSharedStart(first.startTime ?? '');
    setSharedEnd(first.endTime ?? '');
    setMsg('First row date and time copied to all processes.');
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

      {tab === 'qc' && (
        <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Raw Material QC
            </h2>
            <p className="text-xs text-muted">Lock: {String(qcData.lockState ?? 'OPEN')}</p>
          </div>

          {canEditQc && checks.length > 1 && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/80 px-3 py-3 sm:px-4">
              <p className="text-sm font-medium text-brand-950">Same date & time for all processes</p>
              <p className="mt-0.5 text-xs text-muted">
                Enter once, then apply to every row in the list. Observation and result stay per
                process.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs font-medium text-muted">
                  Date
                  <input
                    type="date"
                    value={sharedDate}
                    onChange={(e) => setSharedDate(e.target.value)}
                    className="mt-1 block rounded border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Start
                  <input
                    type="time"
                    value={sharedStart}
                    onChange={(e) => setSharedStart(e.target.value)}
                    className="mt-1 block rounded border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  End
                  <input
                    type="time"
                    value={sharedEnd}
                    onChange={(e) => setSharedEnd(e.target.value)}
                    className="mt-1 block rounded border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyDateTimeToAll}
                  className="rounded-md bg-brand-900 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  Apply to all processes
                </button>
                <button
                  type="button"
                  onClick={applyFirstRowDateTimeToAll}
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm text-brand-900 hover:bg-white"
                >
                  Copy first row to all
                </button>
              </div>
            </div>
          )}

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
                        disabled={qcLocked || !hasPermission('rm_qc:edit')}
                        value={row.processDate ?? ''}
                        onChange={(e) => updateCheck(index, { processDate: e.target.value })}
                        className="rounded border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={qcLocked || !hasPermission('rm_qc:edit')}
                        value={row.startTime ?? ''}
                        onChange={(e) => updateCheck(index, { startTime: e.target.value })}
                        className="rounded border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={qcLocked || !hasPermission('rm_qc:edit')}
                        value={row.endTime ?? ''}
                        onChange={(e) => updateCheck(index, { endTime: e.target.value })}
                        className="rounded border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={qcLocked || !hasPermission('rm_qc:edit')}
                        value={row.observation ?? ''}
                        onChange={(e) => updateCheck(index, { observation: e.target.value })}
                        className="w-40 rounded border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={qcLocked || !hasPermission('rm_qc:edit')}
                        value={row.result ?? ''}
                        onChange={(e) =>
                          updateCheck(index, {
                            result: e.target.value as QcCheck['result'],
                          })
                        }
                        className="rounded border border-line px-2 py-1"
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
            {hasPermission('rm_qc:edit') && !qcLocked && (
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
            {!consLocked && hasPermission('rm_consumption:edit') && (
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

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-line/80 p-3 sm:grid-cols-3"
              >
                <label className="text-xs font-medium text-muted">
                  Raw material
                  <input
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
                    value={line.rawMaterialName}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, rawMaterialName: e.target.value } : l,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Supplier batch no.
                  <input
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
                    value={line.supplierBatchNo}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, supplierBatchNo: e.target.value } : l,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Qty withdrawn
                  <input
                    type="number"
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
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
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Unit
                  <input
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
                    value={line.unit}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === index ? { ...l, unit: e.target.value } : l)),
                      )
                    }
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Quality checked on
                  <input
                    type="date"
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
                    value={line.qualityCheckedDate ?? ''}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, qualityCheckedDate: e.target.value } : l,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  Requirement slip no.
                  <input
                    disabled={consLocked || !hasPermission('rm_consumption:edit')}
                    value={line.requirementSlipNo ?? ''}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, requirementSlipNo: e.target.value } : l,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-line px-2 py-1.5 text-sm text-ink"
                  />
                </label>
              </div>
            ))}
          </div>

          {hasPermission('rm_consumption:edit') && !consLocked && (
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
