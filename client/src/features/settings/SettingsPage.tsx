import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { ApiResponse } from '../../types';

interface Settings {
  companyName: string;
  companyAddress: string;
  batchNoPrefixMode: 'CATALOGUE' | 'FIXED';
  fixedBatchPrefix: string;
  esignStatement: string;
  pdfFooterNote: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>({
    companyName: 'SureTech Medical',
    companyAddress: '',
    batchNoPrefixMode: 'CATALOGUE',
    fixedBatchPrefix: 'IN',
    esignStatement: '',
    pdfFooterNote: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Settings>>('/settings');
      return data.data;
    },
  });

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<ApiResponse<Settings>>('/settings', form);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMsg('Settings saved');
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Save failed',
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Company identity, e-sign statement, and PDF footer</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5"
      >
        <label className="block text-sm font-medium">
          Company name
          <input
            required
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Company address
          <textarea
            value={form.companyAddress}
            onChange={(e) => setForm((f) => ({ ...f, companyAddress: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Batch no. prefix mode
            <select
              value={form.batchNoPrefixMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  batchNoPrefixMode: e.target.value as Settings['batchNoPrefixMode'],
                }))
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="CATALOGUE">From catalogue (e.g. IN…)</option>
              <option value="FIXED">Fixed prefix</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Fixed prefix
            <input
              value={form.fixedBatchPrefix}
              onChange={(e) => setForm((f) => ({ ...f, fixedBatchPrefix: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Default e-sign statement
          <textarea
            value={form.esignStatement}
            onChange={(e) => setForm((f) => ({ ...f, esignStatement: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          PDF footer note
          <textarea
            value={form.pdfFooterNote}
            onChange={(e) => setForm((f) => ({ ...f, pdfFooterNote: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>

        {msg && <p className="text-sm text-accent-600">{msg}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
