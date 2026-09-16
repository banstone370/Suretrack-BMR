import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function InProcessQcPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'in-process-qc');
  const [signMode, setSignMode] = useState<'submit' | 'approve' | 'reject' | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    dustFree: false,
    burrFree: false,
    foreignParticleFree: false,
    observation: '',
    result: '' as '' | 'PASS' | 'FAIL' | 'NA',
  });

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      dustFree: Boolean(data.dustFree),
      burrFree: Boolean(data.burrFree),
      foreignParticleFree: Boolean(data.foreignParticleFree),
      observation: String(data.observation ?? ''),
      result: (data.result as typeof form.result) || '',
    });
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const lockState = String(stage.query.data?.data?.lockState ?? 'OPEN');
  const locked = ['APPROVED', 'LOCKED'].includes(lockState);
  const canEdit = hasPermission('ipqc:edit') && lockState === 'OPEN';

  useEffect(() => {
    if (form.dustFree && form.burrFree && form.foreignParticleFree && !form.result) {
      setForm((f) => ({ ...f, result: 'PASS' }));
    }
  }, [form.dustFree, form.burrFree, form.foreignParticleFree, form.result]);

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="In-Process Quality Control"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">Lock: {lockState}</p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="space-y-3">
          {(
            [
              ['dustFree', 'Dust free'],
              ['burrFree', 'Burr free'],
              ['foreignParticleFree', 'Foreign particle free'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>

        <label className="block text-sm font-medium">
          Observation
          <textarea
            disabled={!canEdit}
            value={form.observation}
            onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            rows={3}
          />
        </label>

        <label className="block text-sm font-medium">
          Result
          <select
            disabled={!canEdit}
            value={form.result}
            onChange={(e) =>
              setForm((f) => ({ ...f, result: e.target.value as typeof form.result }))
            }
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 sm:w-48"
          >
            <option value="">Select</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="NA">N/A</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
                onClick={async () => {
                  await stage.save.mutateAsync(form);
                  setMsg('IPQC draft saved');
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('submit')}
              >
                Submit
              </button>
            </>
          )}
          {hasPermission('ipqc:edit') && lockState === 'SUBMITTED' && (
            <>
              <button
                type="button"
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('approve')}
              >
                QC Approve
              </button>
              <button
                type="button"
                className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white"
                onClick={() => setSignMode('reject')}
              >
                Hold / Reject
              </button>
            </>
          )}
          {locked && <p className="text-sm text-muted">This stage is locked.</p>}
        </div>
      </section>

      <ElectronicSignature
        open={signMode === 'submit'}
        title="Submit In-Process QC"
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: form, password, statement });
          setMsg('IPQC submitted');
        }}
      />
      <ElectronicSignature
        open={signMode === 'approve'}
        title="Approve In-Process QC"
        confirmLabel="Approve"
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement }) => {
          await stage.approve.mutateAsync({ password, statement });
          setMsg('IPQC approved — proceed to Visual Inspection');
        }}
      />
      <ElectronicSignature
        open={signMode === 'reject'}
        title="Hold Batch from IPQC"
        confirmLabel="Place On Hold"
        requireReason
        onClose={() => setSignMode(null)}
        onConfirm={async ({ password, statement, reason }) => {
          await stage.reject.mutateAsync({ password, statement, reason: reason! });
          setMsg('Batch placed on hold');
        }}
      />
    </StageShell>
  );
}
