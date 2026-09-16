import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import type { ApiResponse } from '../../types';

interface Customer {
  _id: string;
  name: string;
  code: string;
  address?: string;
  contact?: string;
  isActive: boolean;
}

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    contact: '',
  });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Customer[]>>('/customers');
      return data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/customers', form);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setForm({ name: '', code: '', address: '', contact: '' });
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create customer',
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
        <h1 className="font-display text-2xl font-semibold text-brand-950">Customers</h1>
        <p className="mt-1 text-sm text-muted">Dispatch customers / consignees</p>
      </div>

      {hasPermission('dispatch:create') && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5 sm:grid-cols-2"
        >
          <label className="text-sm font-medium">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Code
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Contact
            <input
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {create.isPending ? 'Saving…' : 'Add customer'}
            </button>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </form>
      )}

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Address</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((c) => (
              <tr key={c._id} className="border-t border-line/70">
                <td className="px-5 py-3 font-medium">{c.code}</td>
                <td className="px-5 py-3">{c.name}</td>
                <td className="px-5 py-3 text-muted">{c.contact ?? '—'}</td>
                <td className="px-5 py-3 text-muted">{c.address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
