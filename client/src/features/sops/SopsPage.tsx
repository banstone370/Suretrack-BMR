import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import type { ApiResponse } from '../../types';

interface Sop {
  _id: string;
  sopNo: string;
  title: string;
  version: string;
  effectiveDate: string;
  status: string;
  description?: string;
  documentUrl?: string;
}

export function SopsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    sopNo: '',
    title: '',
    version: '1.0',
    effectiveDate: new Date().toISOString().slice(0, 10),
    description: '',
    status: 'APPROVED' as 'DRAFT' | 'APPROVED' | 'SUPERSEDED',
  });
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Sop[]>>('/sops');
      return data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/sops', form);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sops'] });
      setForm({
        sopNo: '',
        title: '',
        version: '1.0',
        effectiveDate: new Date().toISOString().slice(0, 10),
        description: '',
        status: 'APPROVED',
      });
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create SOP',
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
        <h1 className="font-display text-2xl font-semibold text-brand-950">SOPs</h1>
        <p className="mt-1 text-sm text-muted">
          Controlled procedures referenced by batch process templates
        </p>
      </div>

      {hasPermission('sops:manage') && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5 sm:grid-cols-2"
        >
          <label className="text-sm font-medium">
            SOP No.
            <input
              required
              value={form.sopNo}
              onChange={(e) => setForm((f) => ({ ...f, sopNo: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
              placeholder="SOP/MF/008"
            />
          </label>
          <label className="text-sm font-medium">
            Version
            <input
              required
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Effective date
            <input
              type="date"
              required
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as typeof form.status,
                }))
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
            >
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="SUPERSEDED">Superseded</option>
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line px-3 py-2"
              rows={2}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {create.isPending ? 'Saving…' : 'Add SOP'}
            </button>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </form>
      )}

      <div className="table-scroll rounded-xl border border-line bg-white/80 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-50/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">SOP No.</th>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Version</th>
              <th className="px-5 py-3 font-medium">Effective</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Document</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((sop) => (
              <tr key={sop._id} className="border-t border-line/70">
                <td className="px-5 py-3 font-medium">{sop.sopNo}</td>
                <td className="px-5 py-3">
                  <div>{sop.title}</div>
                  {sop.description && (
                    <div className="text-xs text-muted">{sop.description}</div>
                  )}
                </td>
                <td className="px-5 py-3">{sop.version}</td>
                <td className="px-5 py-3 text-muted">{formatDate(sop.effectiveDate)}</td>
                <td className="px-5 py-3">{sop.status}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1">
                    {sop.documentUrl ? (
                      <a
                        href={sop.documentUrl}
                        className="text-xs text-brand-800 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-muted">No file</span>
                    )}
                    {hasPermission('sops:manage') && (
                      <label className="cursor-pointer text-xs text-muted hover:underline">
                        Upload
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              await api.post(`/sops/${sop._id}/document`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              void queryClient.invalidateQueries({ queryKey: ['sops'] });
                            } catch {
                              setError('Document upload failed');
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
