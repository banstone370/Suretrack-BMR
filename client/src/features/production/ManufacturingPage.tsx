import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { useStage } from '../../hooks/useStage';

export function ManufacturingPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'manufacturing');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    process: 'The needles are made Ready for Sterilization.',
    processDate: '',
    startTime: '',
    endTime: '',
    remarks: '',
    status: 'IN_PROGRESS',
  });

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
  }, [stage.query.data]);

  const batch = stage.batchQuery.data;
  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('manufacturing:edit') && !locked;

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="Manufacturing Process"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}

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
              onClick={() => setSignOpen(true)}
            >
              Complete & Verify
            </button>
          </div>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Verify Manufacturing"
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({
            payload: { ...form, status: 'COMPLETED' },
            password,
            statement,
          });
          setMsg('Manufacturing verified — moved to In-Process QC');
        }}
      />
    </StageShell>
  );
}
