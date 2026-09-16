import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function LabellingPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'labelling');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    labelsPrinted: 0,
    labelsUsed: 0,
    labelsDestroyed: 0,
    devicesLabelled: 0,
    overrideReason: '',
    doneOn: '',
  });

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      labelsPrinted: Number(data.labelsPrinted ?? 0),
      labelsUsed: Number(data.labelsUsed ?? 0),
      labelsDestroyed: Number(data.labelsDestroyed ?? 0),
      devicesLabelled: Number(data.devicesLabelled ?? 0),
      overrideReason: String(data.overrideReason ?? ''),
      doneOn: data.doneOn ? String(data.doneOn).slice(0, 10) : '',
    });
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('labelling:edit') && !locked;
  const needsOverride = form.labelsUsed > form.labelsPrinted;

  function validateLocal() {
    if (needsOverride && !form.overrideReason.trim()) {
      setError('Override reason required when labels used > labels printed');
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
      title="Batch Labelling"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Labels printed
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.labelsPrinted}
              onChange={(e) => setForm((f) => ({ ...f, labelsPrinted: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Labels used
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.labelsUsed}
              onChange={(e) => setForm((f) => ({ ...f, labelsUsed: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Labels destroyed
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.labelsDestroyed}
              onChange={(e) =>
                setForm((f) => ({ ...f, labelsDestroyed: Number(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Devices labelled
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.devicesLabelled}
              onChange={(e) =>
                setForm((f) => ({ ...f, devicesLabelled: Number(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Done on
            <input
              type="date"
              disabled={!canEdit}
              value={form.doneOn}
              onChange={(e) => setForm((f) => ({ ...f, doneOn: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>

        {needsOverride && (
          <label className="block text-sm font-medium">
            Override reason
            <textarea
              disabled={!canEdit}
              value={form.overrideReason}
              onChange={(e) => setForm((f) => ({ ...f, overrideReason: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
              rows={2}
              required
            />
          </label>
        )}

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
              onClick={async () => {
                if (!validateLocal()) return;
                await stage.save.mutateAsync(form);
                setMsg('Labelling draft saved');
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => {
                if (!validateLocal()) return;
                setSignOpen(true);
              }}
            >
              Complete Labelling
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Complete Labelling"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: form, password, statement });
          setMsg('Labelling complete — moved to Sterility Test');
        }}
      />
    </StageShell>
  );
}
