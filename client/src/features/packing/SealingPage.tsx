import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function SealingPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'sealing');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    actualTemperatureC: 200,
    devicesSealed: 0,
    sealingDate: '',
    startTime: '',
    endTime: '',
  });

  const snapshot = stage.query.data?.processParamsSnapshot as {
    sealingParams?: { temperatureC: number; sopRef: string };
  };
  const configuredTemp =
    snapshot?.sealingParams?.temperatureC ??
    Number(stage.query.data?.data?.configuredTemperatureC ?? 200);
  const sopRef =
    snapshot?.sealingParams?.sopRef ?? String(stage.query.data?.data?.sopRef ?? 'SOP/MF/011');

  useEffect(() => {
    const data = stage.query.data?.data;
    if (!data) return;
    setForm({
      actualTemperatureC: Number(data.actualTemperatureC ?? configuredTemp),
      devicesSealed: Number(data.devicesSealed ?? 0),
      sealingDate: data.sealingDate ? String(data.sealingDate).slice(0, 10) : '',
      startTime: String(data.startTime ?? ''),
      endTime: String(data.endTime ?? ''),
    });
  }, [stage.query.data, configuredTemp]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('sealing:edit') && !locked;

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="Sealing"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <div className="grid gap-3 rounded-lg bg-brand-50/80 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">Configured temperature (SOP)</p>
            <p className="mt-1 font-semibold text-brand-900">{configuredTemp}°C</p>
          </div>
          <div>
            <p className="text-xs text-muted">SOP reference</p>
            <p className="mt-1 font-semibold text-brand-900">{sopRef}</p>
          </div>
        </div>

        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Actual temperature (°C)
            <input
              type="number"
              disabled={!canEdit}
              value={form.actualTemperatureC}
              onChange={(e) =>
                setForm((f) => ({ ...f, actualTemperatureC: Number(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Devices sealed
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.devicesSealed}
              onChange={(e) => setForm((f) => ({ ...f, devicesSealed: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Sealing date
            <input
              type="date"
              disabled={!canEdit}
              value={form.sealingDate}
              onChange={(e) => setForm((f) => ({ ...f, sealingDate: e.target.value }))}
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

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
              onClick={async () => {
                await stage.save.mutateAsync({
                  ...form,
                  configuredTemperatureC: configuredTemp,
                  sopRef,
                });
                setMsg('Sealing draft saved');
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setSignOpen(true)}
            >
              Complete Sealing
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Complete Sealing"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({
            payload: { ...form, configuredTemperatureC: configuredTemp, sopRef },
            password,
            statement,
          });
          setMsg('Sealing complete — moved to Sterilization');
        }}
      />
    </StageShell>
  );
}
