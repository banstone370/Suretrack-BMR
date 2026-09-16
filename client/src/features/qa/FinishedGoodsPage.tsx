import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StageShell } from '../../components/batch/StageShell';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../lib/utils';
import { useStage } from '../../hooks/useStage';

export function FinishedGoodsPage() {
  const { batchId } = useParams();
  const { hasPermission } = useAuth();
  const stage = useStage(batchId, 'finished-goods');
  const [signOpen, setSignOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    quantity: 0,
    transferDate: '',
    receivedOn: '',
    storageCondition: 'Store at Room Temperature',
  });

  const batch = stage.batchQuery.data;
  const snapshot = stage.query.data?.processParamsSnapshot as {
    storageCondition?: string;
  };

  useEffect(() => {
    const data = stage.query.data?.data;
    const storage =
      String(data?.storageCondition ?? '') ||
      snapshot?.storageCondition ||
      'Store at Room Temperature';
    setForm({
      quantity: Number(data?.quantity ?? batch?.batchSize ?? 0),
      transferDate: data?.transferDate
        ? String(data.transferDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      receivedOn: data?.receivedOn
        ? String(data.receivedOn).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      storageCondition: storage,
    });
  }, [stage.query.data, batch?.batchSize, snapshot?.storageCondition]);

  const locked = ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(
    String(stage.query.data?.data?.lockState ?? ''),
  );
  const canEdit = hasPermission('finished_goods:transfer') && !locked;

  return (
    <StageShell
      batchId={batchId!}
      batchNo={batch?.batchNo}
      productName={batch?.productName}
      status={batch?.status}
      progressPercent={batch?.progressPercent}
      title="Finished Goods Transfer"
    >
      <section className="space-y-4 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5">
        <div className="grid gap-3 rounded-lg bg-brand-50/80 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">Batch expiry</p>
            <p className="mt-1 font-semibold">{formatDate(batch?.expiryDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Batch size</p>
            <p className="mt-1 font-semibold">{batch?.batchSize?.toLocaleString() ?? '—'}</p>
          </div>
        </div>

        <p className="text-xs text-muted">
          Lock: {String(stage.query.data?.data?.lockState ?? 'OPEN')}
        </p>
        {msg && <p className="text-sm text-accent-600">{msg}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Number of finished products
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Transfer date
            <input
              type="date"
              disabled={!canEdit}
              value={form.transferDate}
              onChange={(e) => setForm((f) => ({ ...f, transferDate: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Received on
            <input
              type="date"
              disabled={!canEdit}
              value={form.receivedOn}
              onChange={(e) => setForm((f) => ({ ...f, receivedOn: e.target.value }))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Storage condition
            <input
              disabled={!canEdit}
              value={form.storageCondition}
              onChange={(e) => setForm((f) => ({ ...f, storageCondition: e.target.value }))}
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
                await stage.save.mutateAsync(form);
                setMsg('Transfer draft saved');
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setSignOpen(true)}
            >
              Transfer to Finished Goods
            </button>
          </div>
        )}

        {locked && Boolean(stage.query.data?.data?.finishedGoodsId) && (
          <p className="text-sm text-muted">
            Inventory record created. View stock under Finished Goods inventory.
          </p>
        )}
      </section>

      <ElectronicSignature
        open={signOpen}
        title="Confirm Finished Goods Transfer"
        statement="I confirm compliance material is shifted to finished goods."
        onClose={() => setSignOpen(false)}
        onConfirm={async ({ password, statement }) => {
          await stage.submit.mutateAsync({ payload: form, password, statement });
          setMsg('Transferred to finished goods inventory');
        }}
      />
    </StageShell>
  );
}
