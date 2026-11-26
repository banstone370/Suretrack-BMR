import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';
import { processDateError, timeOrderError } from '../../lib/utils';

interface MfgStep {
  step: string;
  processDate: string;
  startTime: string;
  endTime: string;
  remarks: string;
}

function normalizeSteps(raw: unknown): MfgStep[] {
  return (raw as Array<Record<string, unknown>>).map((s) => ({
    step: String(s.step ?? ''),
    processDate: s.processDate ? String(s.processDate).slice(0, 10) : '',
    startTime: String(s.startTime ?? ''),
    endTime: String(s.endTime ?? ''),
    remarks: String(s.remarks ?? ''),
  }));
}

export function ManufacturingPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'manufacturing');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    process: 'The needles are made Ready for Sterilization.',
    processDate: '',
    startTime: '',
    endTime: '',
    remarks: '',
    status: 'IN_PROGRESS',
  });
  /** Product-centric (v2) batches track a date/time per manufacturing step. */
  const [steps, setSteps] = useState<MfgStep[] | null>(null);

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      process: String(data.process ?? 'The needles are made Ready for Sterilization.'),
      processDate: data.processDate ? String(data.processDate).slice(0, 10) : '',
      startTime: String(data.startTime ?? ''),
      endTime: String(data.endTime ?? ''),
      remarks: String(data.remarks ?? ''),
      status: String(data.status ?? 'IN_PROGRESS'),
    });
    setSteps(Array.isArray(data.steps) ? normalizeSteps(data.steps) : null);
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const lockState = String(stage.query.data?.data?.lockState ?? 'OPEN');
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(lockState);
  const canEdit = hasPermission('manufacturing:edit') && !locked;

  function updateStep(index: number, patch: Partial<MfgStep>) {
    setSteps((prev) => (prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : prev));
  }

  function validateSteps(): boolean {
    if (!steps) {
      setError('');
      return true;
    }
    const missing = steps.find((s) => !s.processDate || !s.startTime || !s.endTime);
    if (missing) {
      setError(
        `Date and start/end time are required for every step — missing on "${missing.step}".`,
      );
      return false;
    }
    for (const s of steps) {
      const dateErr = processDateError(s.processDate, `Date for "${s.step}"`);
      if (dateErr) {
        setError(dateErr);
        return false;
      }
      const timeErr = timeOrderError(s.startTime, s.endTime, `End time for "${s.step}"`);
      if (timeErr) {
        setError(timeErr);
        return false;
      }
    }
    setError('');
    return true;
  }

  function validateSingle(): boolean {
    const dateErr = processDateError(form.processDate, 'Process date');
    if (dateErr) {
      setError(dateErr);
      return false;
    }
    const timeErr = timeOrderError(form.startTime, form.endTime);
    if (timeErr) {
      setError(timeErr);
      return false;
    }
    setError('');
    return true;
  }

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="Manufacturing Process"
    >
      {steps ? (
        <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
          <p className="text-xs text-muted">Lock: {lockState}</p>
          {msg && <p className="text-sm text-accent-600">{msg}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <h2 className="text-sm font-semibold">Manufacturing steps</h2>
            <p className="mt-1 text-xs text-muted">
              Steps come from this product&apos;s BMR template. Record the date and start/end time
              for each step — they are printed on the batch record.
            </p>
          </div>

          <div className="table-scroll">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Step</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr key={`${s.step}-${i}`} className="border-t border-line/70">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.step}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        disabled={!canEdit}
                        value={s.processDate}
                        onChange={(e) => updateStep(i, { processDate: e.target.value })}
                        className="w-full rounded-md border border-line px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={s.startTime}
                        onChange={(e) => updateStep(i, { startTime: e.target.value })}
                        className="w-full rounded-md border border-line px-2 py-1.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={s.endTime}
                        onChange={(e) => updateStep(i, { endTime: e.target.value })}
                        className="w-full rounded-md border border-line px-2 py-1.5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="block text-sm font-medium">
            Remarks
            <textarea
              disabled={!canEdit}
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              rows={3}
            />
          </label>

          {canEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                onClick={async () => {
                  await stage.save.mutateAsync({
                    steps,
                    remarks: form.remarks,
                    status: 'IN_PROGRESS',
                  });
                  setMsg('Manufacturing draft saved');
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => {
                  if (!validateSteps()) return;
                  setSignOpen(true);
                }}
              >
                Complete & Verify
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
          <p className="text-xs text-muted">Lock: {lockState}</p>
          {msg && <p className="text-sm text-accent-600">{msg}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}

          <label className="block text-sm font-medium">
            Process
            <textarea
              disabled={!canEdit}
              value={form.process}
              onChange={(e) => setForm((f) => ({ ...f, process: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              rows={2}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Date
              <input
                type="date"
                disabled={!canEdit}
                value={form.processDate}
                onChange={(e) => setForm((f) => ({ ...f, processDate: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Start time
              <input
                type="time"
                disabled={!canEdit}
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              End time
              <input
                type="time"
                disabled={!canEdit}
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Remarks
            <textarea
              disabled={!canEdit}
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              rows={3}
            />
          </label>

          {canEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                onClick={async () => {
                  await stage.save.mutateAsync({ ...form, status: 'IN_PROGRESS' });
                  setMsg('Manufacturing draft saved');
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => {
                  if (!validateSingle()) return;
                  setSignOpen(true);
                }}
              >
                Complete &amp; Verify
              </button>
            </div>
          )}
        </section>
      )}

      <ElectronicSignature
        open={signOpen}
        title="Verify Manufacturing"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({
            payload: steps
              ? { steps, remarks: form.remarks, status: 'COMPLETED' }
              : { ...form, status: 'COMPLETED' },
            password,
            statement,
          });
          setMsg('Manufacturing verified — moved to In-Process QC');
        }}
      />
    </StageShell>
  );
}
