import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, API_ORIGIN, tokenStore } from '../../lib/api';
import type { ApiResponse } from '../../types';

interface AttachmentRow {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  stageSlug?: string;
  url: string;
  createdAt: string;
}

export function AttachmentPanel({
  batchId,
  stageSlug,
  canUpload,
}: {
  batchId: string;
  stageSlug?: string;
  canUpload: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['attachments', batchId, stageSlug],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AttachmentRow[]>>(
        `/batches/${batchId}/attachments`,
        { params: stageSlug ? { stageSlug } : undefined },
      );
      return data.data;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      if (stageSlug) form.append('stageSlug', stageSlug);
      const { data } = await api.post(`/batches/${batchId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments', batchId] });
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Upload failed',
      );
    },
  });

  async function download(att: AttachmentRow) {
    const token = tokenStore.getAccess();
    const urlPath = att.url.startsWith('http') ? att.url : `${API_ORIGIN}${att.url}`;
    const res = await fetch(urlPath, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.originalName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-line bg-brand-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Attachments</h3>
        {canUpload && (
          <label className="cursor-pointer rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-white">
            {upload.isPending ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <ul className="mt-2 space-y-1 text-sm">
        {(list.data ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <span className="truncate">{a.originalName}</span>
            <button
              type="button"
              onClick={() => void download(a).catch(() => setError('Download failed'))}
              className="shrink-0 text-xs text-brand-800 hover:underline"
            >
              Download
            </button>
          </li>
        ))}
        {list.isSuccess && (list.data?.length ?? 0) === 0 && (
          <li className="text-muted">No files uploaded yet.</li>
        )}
      </ul>
    </div>
  );
}
