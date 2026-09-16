import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import type { ApiResponse, Product } from '../../types';

const EMPTY_FORM = {
  name: '',
  catalogueNo: '',
  description: '',
  defaultBatchSize: '10000',
  shelfLifeMonths: '60',
  sealingTemperatureC: '200',
  sealingSopRef: 'SOP/MF/011',
  sterilizationTemperatureC: '55',
  sterilizationDurationHours: '4',
  etoCartridgeGrams: '40',
  sterilizationSopRef: 'SOP/MF/008',
  sterilitySop: 'SOP/QC/004',
  betSop: 'SOP/QC/005',
  storageCondition: 'Store at Room Temperature',
  rmQcChecks: 'Hub checking\nBevel checking\nGuide wire passing\nVisual inspection for dust, burrs and foreign particles',
  ipqcChecks: 'Dust free\nBurr free\nForeign particle free',
};

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function templateOf(product: Product) {
  const t = product.processTemplateId;
  return typeof t === 'object' && t ? t : null;
}

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Product[]>>('/products');
      return data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        catalogueNo: form.catalogueNo.trim(),
        description: form.description.trim() || undefined,
        defaultBatchSize: Number(form.defaultBatchSize),
        shelfLifeMonths: Number(form.shelfLifeMonths),
        processTemplate: {
          sealingTemperatureC: Number(form.sealingTemperatureC),
          sealingSopRef: form.sealingSopRef.trim(),
          sterilizationTemperatureC: Number(form.sterilizationTemperatureC),
          sterilizationDurationHours: Number(form.sterilizationDurationHours),
          etoCartridgeGrams: Number(form.etoCartridgeGrams),
          sterilizationSopRef: form.sterilizationSopRef.trim(),
          sterilitySop: form.sterilitySop.trim(),
          betSop: form.betSop.trim(),
          storageCondition: form.storageCondition.trim(),
          rmQcChecks: parseLines(form.rmQcChecks),
          ipqcChecks: parseLines(form.ipqcChecks),
        },
      };
      const { data } = await api.post<ApiResponse<Product>>('/products', payload);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to create product',
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    create.mutate();
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canManage = hasPermission('products:manage');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-brand-950 sm:text-2xl">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted">Product masters and BMR process templates</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setError('');
            }}
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 sm:w-auto sm:py-2"
          >
            {showForm ? 'Cancel' : 'Add Product'}
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5"
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Product details
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Product name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. INTRODUCER NEEDLE"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Catalogue No.
                <input
                  required
                  value={form.catalogueNo}
                  onChange={(e) => setField('catalogueNo', e.target.value)}
                  placeholder="e.g. IN-002"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Default batch size
                <input
                  required
                  type="number"
                  min={1}
                  value={form.defaultBatchSize}
                  onChange={(e) => setField('defaultBatchSize', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Shelf life (months)
                <input
                  required
                  type="number"
                  min={1}
                  value={form.shelfLifeMonths}
                  onChange={(e) => setField('shelfLifeMonths', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Process template
            </h2>
            <p className="mt-1 text-xs text-muted">
              Parameters are snapshotted onto each new batch for this product.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium">
                Sealing temp (°C)
                <input
                  required
                  type="number"
                  min={1}
                  value={form.sealingTemperatureC}
                  onChange={(e) => setField('sealingTemperatureC', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Sealing SOP
                <input
                  required
                  value={form.sealingSopRef}
                  onChange={(e) => setField('sealingSopRef', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                ETO temp (°C)
                <input
                  required
                  type="number"
                  min={1}
                  value={form.sterilizationTemperatureC}
                  onChange={(e) => setField('sterilizationTemperatureC', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                ETO duration (hours)
                <input
                  required
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={form.sterilizationDurationHours}
                  onChange={(e) => setField('sterilizationDurationHours', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                ETO cartridge (g)
                <input
                  required
                  type="number"
                  min={1}
                  value={form.etoCartridgeGrams}
                  onChange={(e) => setField('etoCartridgeGrams', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Sterilization SOP
                <input
                  required
                  value={form.sterilizationSopRef}
                  onChange={(e) => setField('sterilizationSopRef', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                Sterility SOP
                <input
                  required
                  value={form.sterilitySop}
                  onChange={(e) => setField('sterilitySop', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium">
                BET SOP
                <input
                  required
                  value={form.betSop}
                  onChange={(e) => setField('betSop', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-1">
                Storage condition
                <input
                  required
                  value={form.storageCondition}
                  onChange={(e) => setField('storageCondition', e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">
                RM QC checks (one per line)
                <textarea
                  value={form.rmQcChecks}
                  onChange={(e) => setField('rmQcChecks', e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 font-mono text-xs outline-none ring-brand-800 focus:ring-2 sm:text-sm"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">
                In-process QC checks (one per line)
                <textarea
                  value={form.ipqcChecks}
                  onChange={(e) => setField('ipqcChecks', e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 font-mono text-xs outline-none ring-brand-800 focus:ring-2 sm:text-sm"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-danger">{error}</p> : <span />}
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-accent-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-60 sm:py-2"
            >
              {create.isPending ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(products.data ?? []).map((product) => {
          const template = templateOf(product);
          return (
            <article
              key={product._id}
              className="rounded-xl border border-line bg-white/90 p-3 shadow-sm sm:p-5"
            >
              <h2 className="font-display text-lg font-semibold text-brand-900">
                {product.name}
              </h2>
              <p className="mt-1 text-sm text-muted">Catalogue: {product.catalogueNo}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Default batch size</dt>
                  <dd className="font-medium">
                    {product.defaultBatchSize?.toLocaleString() ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Shelf life</dt>
                  <dd className="font-medium">{product.shelfLifeMonths} months</dd>
                </div>
              </dl>
              {product.description && (
                <p className="mt-3 text-sm text-muted">{product.description}</p>
              )}
              {template && (
                <div className="mt-4 rounded-lg bg-brand-50/70 p-3 text-xs text-muted sm:text-sm">
                  <p className="font-medium text-ink">{template.name}</p>
                  <p className="mt-1">
                    Seal {template.sealingParams?.temperatureC ?? '—'}°C · ETO{' '}
                    {template.sterilizationParams?.temperatureC ?? '—'}°C /{' '}
                    {template.sterilizationParams?.durationHours ?? '—'}h /{' '}
                    {template.sterilizationParams?.etoCartridgeGrams ?? '—'}g
                  </p>
                  <p className="mt-1">
                    {template.storageCondition ?? 'Store at Room Temperature'}
                  </p>
                </div>
              )}
            </article>
          );
        })}
        {products.isSuccess && (products.data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted sm:col-span-2">No products yet. Add the first product.</p>
        )}
      </div>
    </div>
  );
}
