import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse } from '../../types';

interface Cartridge {
  _id: string;
  cartridgeBatchNo: string;
  manufacturer: string;
  receivedDate: string;
  expiryDate: string;
  quantityGrams: number;
  quantityRemainingGrams: number;
  status: string;
}

export function EtoCartridgesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cartridgeBatchNo: '',
    manufacturer: '',
    receivedDate: '',
    expiryDate: '',
    quantityGrams: 40,
  });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['eto-cartridges'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Cartridge[]>>('/eto-cartridges');
      return data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/eto-cartridges', form);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['eto-cartridges'] });
      setForm({
        cartridgeBatchNo: '',
        manufacturer: '',
        receivedDate: '',
        expiryDate: '',
        quantityGrams: 40,
      });
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create cartridge',
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-950">ETO Cartridges</h1>
        <p className="mt-1 text-sm text-muted">Sterilization gas cartridge inventory & traceability</p>
      </div>

      {hasPermission('eto_cartridge:manage') && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm font-medium">
            Cartridge batch no.
            <input
              required
              value={form.cartridgeBatchNo}
              onChange={(e) => setForm((f) => ({ ...f, cartridgeBatchNo: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Manufacturer
            <input
              required
              value={form.manufacturer}
              onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Quantity (g)
            <input
              type="number"
              min={1}
              required
              value={form.quantityGrams}
              onChange={(e) => setForm((f) => ({ ...f, quantityGrams: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Received date
            <input
              type="date"
              required
              value={form.receivedDate}
              onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Expiry date
            <input
              type="date"
              required
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {create.isPending ? 'Saving…' : 'Add cartridge'}
            </button>
          </div>
          {error && <p className="text-sm text-danger sm:col-span-2 lg:col-span-3">{error}</p>}
        </form>
      )}

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Batch No.</th>
              <th className="px-5 py-3 font-medium">Manufacturer</th>
              <th className="px-5 py-3 font-medium">Remaining</th>
              <th className="px-5 py-3 font-medium">Expiry</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((c) => (
              <tr key={c._id} className="border-t border-line/70">
                <td className="px-5 py-3 font-medium">{c.cartridgeBatchNo}</td>
                <td className="px-5 py-3">{c.manufacturer}</td>
                <td className="px-5 py-3">
                  {c.quantityRemainingGrams}g / {c.quantityGrams}g
                </td>
                <td className="px-5 py-3 text-muted">{formatDate(c.expiryDate)}</td>
                <td className="px-5 py-3">{c.status}</td>
              </tr>
            ))}
            {list.isSuccess && (list.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No cartridges yet. Run seed or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
