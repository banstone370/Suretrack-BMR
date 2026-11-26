import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ApiResponse, BatchDetail, Product } from '../../types';

/** Parse yyyy-mm-dd as a local calendar date (avoids UTC off-by-one). */
function parseDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Expiry = sterility date + shelf life years - 1 day. */
function expiryFor(sterilityDate: string, years: number): string {
  const start = parseDate(sterilityDate);
  if (!start || !years) return '';
  const expiry = new Date(start);
  expiry.setFullYear(expiry.getFullYear() + years);
  expiry.setDate(expiry.getDate() - 1);
  return toInputDate(expiry);
}

export function CreateBatchPage() {
  const navigate = useNavigate();
  const [productId, setProductId] = useState('');
  const [batchSize, setBatchSize] = useState(10000);
  const [sterilityDate, setSterilityDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryYears, setExpiryYears] = useState(5);
  const [batchNo, setBatchNo] = useState('');
  const [error, setError] = useState('');

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Product[]>>('/products');
      return data.data;
    },
  });

  const selected = products.data?.find((p) => p._id === productId);

  useEffect(() => {
    if (!productId && products.data?.[0]) {
      const p = products.data[0];
      setProductId(p._id);
      if (p.defaultBatchSize) setBatchSize(p.defaultBatchSize);
    }
  }, [products.data, productId]);

  useEffect(() => {
    if (!selected) return;
    if (selected.defaultBatchSize) setBatchSize(selected.defaultBatchSize);
    setExpiryYears(Math.max(1, Math.round((selected.shelfLifeMonths || 60) / 12)));
  }, [selected?._id]);

  const expiryDate = useMemo(
    () => expiryFor(sterilityDate, expiryYears),
    [sterilityDate, expiryYears],
  );

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<BatchDetail>>('/batches', {
        productId,
        batchSize: Number(batchSize),
        manufacturingDate: sterilityDate,
        expiryDate: expiryDate || undefined,
        expiryYears,
        batchNo: batchNo.trim() || undefined,
      });
      return data.data;
    },
    onSuccess: (batch) => navigate(`/batches/${batch.id}`),
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create batch';
      setError(message);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    create.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link to="/batches" className="text-sm text-brand-800 hover:underline">
          ← Back to batches
        </Link>
        <h1 className="mt-2 font-display text-xl font-semibold text-brand-950 sm:text-2xl">
          Create Batch
        </h1>
        <p className="mt-1 text-sm text-muted">Start a new electronic batch manufacturing record</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-6"
      >
        <label className="block text-sm font-medium">
          Product Name
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
            required
          >
            {(products.data ?? []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Catalogue No.
            <input
              value={selected?.catalogueNo ?? ''}
              readOnly
              className="mt-1.5 w-full rounded-md border border-line bg-brand-50/50 px-3 py-2 text-muted"
            />
          </label>
          <label className="block text-sm font-medium">
            Size / spec
            <input
              value={selected?.size ?? ''}
              readOnly
              placeholder="Not set on product"
              className="mt-1.5 w-full rounded-md border border-line bg-brand-50/50 px-3 py-2 text-muted"
            />
          </label>
          <label className="block text-sm font-medium">
            Batch No. <span className="font-normal text-muted">(optional — auto if blank)</span>
            <input
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="e.g. IN26091401"
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Batch Size
          <input
            type="number"
            min={1}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Sterility Date
            <input
              type="date"
              value={sterilityDate}
              onChange={(e) => setSterilityDate(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Expiry duration (years)
            <input
              type="number"
              min={1}
              value={expiryYears}
              onChange={(e) => setExpiryYears(Number(e.target.value))}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Expiry Date
            <input
              type="date"
              value={expiryDate}
              readOnly
              className="mt-1.5 w-full rounded-md border border-line bg-brand-50/50 px-3 py-2 text-muted"
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Expiry is calculated as one day before the sterility date plus the shelf life
          ({expiryYears} years).
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
          <Link
            to="/batches"
            className="rounded-md border border-line px-4 py-2 text-sm hover:bg-brand-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {create.isPending ? 'Creating…' : 'Create Draft Batch'}
          </button>
        </div>
      </form>
    </div>
  );
}
