import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ApiResponse, BatchDetail, Product } from '../../types';

export function CreateBatchPage() {
  const navigate = useNavigate();
  const [productId, setProductId] = useState('');
  const [batchSize, setBatchSize] = useState(10000);
  const [manufacturingDate, setManufacturingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [expiryDate, setExpiryDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [error, setError] = useState('');

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Product[]>>('/products');
      return data.data;
    },
  });

  useEffect(() => {
    if (!productId && products.data?.[0]) {
      const p = products.data[0];
      setProductId(p._id);
      if (p.defaultBatchSize) setBatchSize(p.defaultBatchSize);
    }
  }, [products.data, productId]);

  useEffect(() => {
    const product = products.data?.find((p) => p._id === productId);
    if (!product || !manufacturingDate) return;
    const mfg = new Date(manufacturingDate);
    const exp = new Date(mfg);
    exp.setMonth(exp.getMonth() + (product.shelfLifeMonths || 60));
    setExpiryDate(exp.toISOString().slice(0, 10));
  }, [productId, manufacturingDate, products.data]);

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiResponse<BatchDetail>>('/batches', {
        productId,
        batchSize: Number(batchSize),
        manufacturingDate,
        expiryDate: expiryDate || undefined,
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

  const selected = products.data?.find((p) => p._id === productId);

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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Catalogue No.
            <input
              value={selected?.catalogueNo ?? ''}
              readOnly
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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Manufacturing Date
            <input
              type="date"
              value={manufacturingDate}
              onChange={(e) => setManufacturingDate(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Expiry Date
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
              required
            />
          </label>
        </div>

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
