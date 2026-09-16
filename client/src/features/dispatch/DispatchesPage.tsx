import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BatchStatusBadge } from '../../components/batch/BatchStatusBadge';
import { ElectronicSignature } from '../../components/forms/ElectronicSignature';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse, BatchDetail } from '../../types';

interface Customer {
  _id: string;
  name: string;
  code: string;
}

interface FgRow {
  _id: string;
  batchId: string;
  batchNo: string;
  productName: string;
  quantityAvailable: number;
  status: string;
}

interface DispatchRow {
  _id: string;
  batchId: string;
  batchNo: string;
  customerName: string;
  dispatchDate: string;
  billNo: string;
  quantity: number;
  status: string;
}

export function BatchDispatchPage() {
  const { batchId } = useParams();
  return <DispatchWorkspace batchId={batchId} />;
}

export function DispatchesPage() {
  return <DispatchWorkspace />;
}

function DispatchWorkspace({ batchId }: { batchId?: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    batchId: batchId ?? '',
    customerId: '',
    dispatchDate: new Date().toISOString().slice(0, 10),
    billNo: '',
    quantity: 0,
  });

  const batch = useQuery({
    queryKey: ['batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<BatchDetail>>(`/batches/${batchId}`);
      return data.data;
    },
  });

  const inventory = useQuery({
    queryKey: ['inventory-fg'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FgRow[]>>('/inventory/finished-goods');
      return data.data;
    },
  });

  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Customer[]>>('/customers');
      return data.data;
    },
  });

  const dispatches = useQuery({
    queryKey: ['dispatches', batchId ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DispatchRow[]>>('/dispatches', {
        params: batchId ? { batchId } : undefined,
      });
      return data.data;
    },
  });

  const availableBatches = useMemo(
    () => (inventory.data ?? []).filter((fg) => fg.quantityAvailable > 0),
    [inventory.data],
  );

  const selectedFg = useMemo(() => {
    const id = form.batchId || batchId;
    return (inventory.data ?? []).find((fg) => fg.batchId === id || String(fg.batchId) === id);
  }, [inventory.data, form.batchId, batchId]);

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/dispatches', {
        ...form,
        batchId: form.batchId || batchId,
        quantity: Number(form.quantity),
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setMsg('Dispatch draft created — confirm to decrement inventory');
      setError('');
      setForm((f) => ({ ...f, billNo: '', quantity: 0 }));
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create dispatch',
      );
    },
  });

  const confirm = useMutation({
    mutationFn: async (body: { id: string; password: string; statement?: string }) => {
      const { data } = await api.post(`/dispatches/${body.id}/confirm`, {
        signature: { password: body.password, statement: body.statement },
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-fg'] });
      void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setMsg('Dispatch confirmed — inventory updated');
      setConfirmId(null);
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/dispatches/${id}/cancel`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setMsg('Draft dispatch cancelled');
    },
  });

  const canCreate = hasPermission('dispatch:create');
  const canConfirm = hasPermission('dispatch:confirm');

  return (
    <div className="space-y-5">
      <div>
        {batchId ? (
          <Link to={`/batches/${batchId}`} className="text-sm text-brand-800 hover:underline">
            ← Back to batch
          </Link>
        ) : null}
        <h1 className="mt-2 font-display text-2xl font-semibold text-brand-950">
          {batchId ? `Dispatch · ${batch.data?.batchNo ?? '…'}` : 'Dispatch'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Customer · bill no. · quantity — confirmed dispatches reduce finished goods stock
        </p>
        {batch.data && (
          <div className="mt-2">
            <BatchStatusBadge status={batch.data.status} />
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-accent-600">{msg}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {selectedFg && (
        <div className="rounded-xl border border-line bg-brand-50/70 px-5 py-4 text-sm">
          <span className="text-muted">Available stock for </span>
          <span className="font-semibold">{selectedFg.batchNo}</span>
          <span className="text-muted">: </span>
          <span className="font-display text-xl font-semibold text-brand-900">
            {selectedFg.quantityAvailable.toLocaleString()}
          </span>
        </div>
      )}

      {canCreate && (
        <form
          className="grid gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          {!batchId && (
            <label className="text-sm font-medium sm:col-span-2">
              Batch (finished goods)
              <select
                required
                value={form.batchId}
                onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-line px-3 py-2"
              >
                <option value="">Select batch</option>
                {availableBatches.map((fg) => (
                  <option key={fg._id} value={fg.batchId}>
                    {fg.batchNo} · {fg.productName} · avail {fg.quantityAvailable}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-medium">
            Customer
            <select
              required
              value={form.customerId}
              onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="">Select customer</option>
              {(customers.data ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Bill no.
            <input
              required
              value={form.billNo}
              onChange={(e) => setForm((f) => ({ ...f, billNo: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Dispatch date
            <input
              type="date"
              required
              value={form.dispatchDate}
              onChange={(e) => setForm((f) => ({ ...f, dispatchDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Quantity
            <input
              type="number"
              min={1}
              max={selectedFg?.quantityAvailable ?? undefined}
              required
              value={form.quantity || ''}
              onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {create.isPending ? 'Creating…' : 'Create draft dispatch'}
            </button>
          </div>
        </form>
      )}

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Bill No.</th>
              {!batchId && <th className="px-5 py-3 font-medium">Batch</th>}
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(dispatches.data ?? []).map((d) => (
              <tr key={d._id} className="border-t border-line/70">
                <td className="px-5 py-3 font-medium">{d.billNo}</td>
                {!batchId && (
                  <td className="px-5 py-3">
                    <Link
                      to={`/batches/${d.batchId}/dispatch`}
                      className="text-brand-900 hover:underline"
                    >
                      {d.batchNo}
                    </Link>
                  </td>
                )}
                <td className="px-5 py-3">{d.customerName}</td>
                <td className="px-5 py-3">{d.quantity.toLocaleString()}</td>
                <td className="px-5 py-3 text-muted">{formatDate(d.dispatchDate)}</td>
                <td className="px-5 py-3">{d.status}</td>
                <td className="px-5 py-3">
                  {d.status === 'DRAFT' && (
                    <div className="flex gap-2">
                      {canConfirm && (
                        <button
                          type="button"
                          className="text-sm font-medium text-accent-600 hover:underline"
                          onClick={() => setConfirmId(d._id)}
                        >
                          Confirm
                        </button>
                      )}
                      {canCreate && (
                        <button
                          type="button"
                          className="text-sm text-danger hover:underline"
                          onClick={() => cancel.mutate(d._id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {dispatches.isSuccess && (dispatches.data?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={batchId ? 6 : 7}
                  className="px-5 py-8 text-center text-muted"
                >
                  No dispatches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ElectronicSignature
        open={!!confirmId}
        title="Confirm Dispatch"
        confirmLabel="Confirm & Deduct Stock"
        statement="I confirm this dispatch quantity and bill details are accurate."
        onClose={() => setConfirmId(null)}
        onConfirm={async ({ password, statement }) => {
          await confirm.mutateAsync({ id: confirmId!, password, statement });
        }}
      />
    </div>
  );
}
