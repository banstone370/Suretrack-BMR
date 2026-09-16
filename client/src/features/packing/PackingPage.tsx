import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function PackingPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'packing');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    pouchesTaken: 0,
    devicesPacked: 0,
    pouchesDamaged: 0,
    packingDate: '',
    remarks: '',
  });

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      pouchesTaken: Number(data.pouchesTaken ?? 0),
      devicesPacked: Number(data.devicesPacked ?? 0),
      pouchesDamaged: Number(data.pouchesDamaged ?? 0),
      packingDate: data.packingDate ? String(data.packingDate).slice(0, 10) : '',
      remarks: String(data.remarks ?? ''),
    });
  }, [stage.query.data]);

  const goodPouches = useMemo(
    () => form.pouchesTaken - form.pouchesDamaged,
    [form.pouchesTaken, form.pouchesDamaged],
  );

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('packing:edit') && !locked;

  function validateLocal() {
    if (form.pouchesDamaged > form.pouchesTaken) {
      setError('Damaged pouches cannot exceed pouches taken');
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
      title="Packing"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Pouches taken
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.pouchesTaken}
              onChange={(e) => setForm((f) => ({ ...f, pouchesTaken: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Devices packed
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.devicesPacked}
              onChange={(e) => setForm((f) => ({ ...f, devicesPacked: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Pouches damaged
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.pouchesDamaged}
              onChange={(e) => setForm((f) => ({ ...f, pouchesDamaged: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="rounded-lg bg-brand-50/80 px-4 py-3">
            <p className="text-xs text-muted">Good pouches</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand-900">{goodPouches}</p>
          </div>
          <label className="block text-sm font-medium">
            Packing date
            <input
              type="date"
              disabled={!canEdit}
              value={form.packingDate}
              onChange={(e) => setForm((f) => ({ ...f, packingDate: e.target.value }))}
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
                if (!validateLocal()) return;
                await stage.save.mutateAsync(form);
                setMsg('Packing draft saved');
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
              Complete Packing
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Complete Packing"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: form, password, statement });
          setMsg('Packing complete — moved to Sealing');
        }}
      />
    </StageShell>
  );
}
