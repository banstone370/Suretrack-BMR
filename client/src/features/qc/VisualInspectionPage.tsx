import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function VisualInspectionPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'visual-inspection');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    unitsChecked: 0,
    particlesFound: 0,
    inspectionDate: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      unitsChecked: Number(data.unitsChecked ?? 0),
      particlesFound: Number(data.particlesFound ?? 0),
      inspectionDate: data.inspectionDate ? String(data.inspectionDate).slice(0, 10) : '',
      startTime: String(data.startTime ?? ''),
      endTime: String(data.endTime ?? ''),
    });
  }, [stage.query.data]);

  const percent = useMemo(() => {
    if (!form.unitsChecked) return 0;
    return Number(((form.particlesFound / form.unitsChecked) * 100).toFixed(2));
  }, [form.unitsChecked, form.particlesFound]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('visual_inspection:edit') && !locked;

  function validateLocal() {
    if (form.particlesFound > form.unitsChecked) {
      setError('Particles found cannot exceed units checked');
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
      title="Visual Inspection"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Units checked
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.unitsChecked}
              onChange={(e) =>
                setForm((f) => ({ ...f, unitsChecked: Number(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Particles found
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.particlesFound}
              onChange={(e) =>
                setForm((f) => ({ ...f, particlesFound: Number(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Inspection date
            <input
              type="date"
              disabled={!canEdit}
              value={form.inspectionDate}
              onChange={(e) => setForm((f) => ({ ...f, inspectionDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="rounded-lg bg-brand-50/80 px-4 py-3">
            <p className="text-xs text-muted">Particles found %</p>
            <p className="mt-1 font-display text-2xl font-semibold text-brand-900">{percent}%</p>
          </div>
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

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
              onClick={async () => {
                if (!validateLocal()) return;
                await stage.save.mutateAsync(form);
                setMsg('Inspection draft saved');
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
              Complete Inspection
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Complete Visual Inspection"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: form, password, statement });
          setMsg('Inspection complete — batch moved to Packing');
        }}
      />
    </StageShell>
  );
}
