import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import type { ApiResponse, Product } from '../../types';

type Template = Exclude<NonNullable<Product['processTemplateId']>, string>;

interface ModeRow {
  mode: string;
  temperatureC: string;
  sopRef: string;
}

const EXTRA_SECTION_LABELS: Array<{ value: string; label: string }> = [
  { value: 'CONTROL_SAMPLE', label: 'Control sample record' },
  { value: 'LABEL_OF_PRODUCT', label: 'Label of the product' },
];

const OPTIONAL_STAGE_LABELS: Array<{ value: string; label: string }> = [
  { value: 'PACKING', label: 'Packing' },
  { value: 'SEALING', label: 'Sealing' },
];

function lines(list?: Array<{ name: string } | { step: string }>): string {
  if (!list || list.length === 0) return '';
  return list.map((item) => ('name' in item ? item.name : item.step)).join('\n');
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function initialState(t: Template) {
  return {
    name: t.name ?? '',
    docId: t.docId ?? '',
    bmrIssueNo: t.bmrIssueNo ?? '',
    bmrEffectiveDate: t.bmrEffectiveDate ?? '',
    manufacturingInstruction: t.manufacturingInstruction ?? '',
    rawMaterials: lines(t.rawMaterials),
    manufacturingSteps: lines(t.manufacturingSteps),
    sealingTemperatureC: String(t.sealingParams?.temperatureC ?? 200),
    sealingSopRef: t.sealingParams?.sopRef ?? 'SOP/MF/011',
    sealingModes: (t.sealingModes ?? []).map<ModeRow>((m) => ({
      mode: m.mode,
      temperatureC: String(m.temperatureC),
      sopRef: m.sopRef,
    })),
    packingType: t.packingType ?? '',
    sterilizationTemperatureC: String(t.sterilizationParams?.temperatureC ?? 55),
    sterilizationDurationHours: String(t.sterilizationParams?.durationHours ?? 4),
    etoCartridgeGrams: String(t.sterilizationParams?.etoCartridgeGrams ?? 40),
    sterilizationSopRef: t.sterilizationParams?.sopRef ?? 'SOP/MF/008',
    sterilitySop: t.sterilitySop ?? 'SOP/QC/004',
    betSop: t.betSop ?? 'SOP/QC/005',
    storageCondition: t.storageCondition ?? 'Store at Room Temperature',
    rmQcChecks: (t.rmQcChecks ?? []).join('\n'),
    ipqcChecks: (t.ipqcChecks ?? []).join('\n'),
    extraSections: t.extraSections ?? [],
    optionalStages: t.optionalStages ?? [],
  };
}

interface Props {
  product: Product;
  template: Template;
  onClose: () => void;
}

export function ProductTemplateEditor({ product, template, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialState(template));
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        docId: form.docId.trim() || undefined,
        bmrIssueNo: form.bmrIssueNo.trim() || undefined,
        bmrEffectiveDate: form.bmrEffectiveDate.trim() || undefined,
        manufacturingInstruction: form.manufacturingInstruction.trim() || undefined,
        rawMaterials: parseLines(form.rawMaterials),
        manufacturingSteps: parseLines(form.manufacturingSteps),
        sealingTemperatureC: Number(form.sealingTemperatureC),
        sealingSopRef: form.sealingSopRef.trim(),
        sealingModes: form.sealingModes
          .filter((m) => m.sopRef.trim() && Number(m.temperatureC) > 0)
          .map((m) => ({
            mode: m.mode as 'paper' | 'tyvek' | 'blister',
            temperatureC: Number(m.temperatureC),
            sopRef: m.sopRef.trim(),
          })),
        packingType: form.packingType ? (form.packingType as 'pouch' | 'blisterTray') : undefined,
        sterilizationTemperatureC: Number(form.sterilizationTemperatureC),
        sterilizationDurationHours: Number(form.sterilizationDurationHours),
        etoCartridgeGrams: Number(form.etoCartridgeGrams),
        sterilizationSopRef: form.sterilizationSopRef.trim(),
        sterilitySop: form.sterilitySop.trim(),
        betSop: form.betSop.trim(),
        storageCondition: form.storageCondition.trim(),
        rmQcChecks: parseLines(form.rmQcChecks),
        ipqcChecks: parseLines(form.ipqcChecks),
        extraSections: form.extraSections,
        optionalStages: form.optionalStages,
      };
      const { data } = await api.put<ApiResponse<unknown>>(
        `/products/${product._id}/template`,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setError('');
      onClose();
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to save template',
      );
    },
  });

  function setField(key: keyof ReturnType<typeof initialState>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleList(key: 'extraSections' | 'optionalStages', value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  function setMode(index: number, patch: Partial<ModeRow>) {
    setForm((prev) => ({
      ...prev,
      sealingModes: prev.sealingModes.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.mutate();
  }

  const input =
    'mt-1 w-full rounded-md border border-line px-3 py-2 outline-none ring-brand-800 focus:ring-2';
  const label = 'text-sm font-medium';

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-accent-600/40 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            BMR template — {product.catalogueNo}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Changes apply to batches created from now on; batches already created keep their
            snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-brand-50"
        >
          Close
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Document control
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Template name
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} className={input} />
          </label>
          <label className={label}>
            Doc ID
            <input
              value={form.docId}
              onChange={(e) => setField('docId', e.target.value)}
              placeholder="e.g. SU/BMR/001"
              className={input}
            />
          </label>
          <label className={label}>
            Issue No.
            <input value={form.bmrIssueNo} onChange={(e) => setField('bmrIssueNo', e.target.value)} className={input} />
          </label>
          <label className={label}>
            Effective date
            <input
              value={form.bmrEffectiveDate}
              onChange={(e) => setField('bmrEffectiveDate', e.target.value)}
              placeholder="e.g. 27/11/2021"
              className={input}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Manufacturing (product-specific)
        </h3>
        <label className={label}>
          Manufacturing instruction
          <textarea
            value={form.manufacturingInstruction}
            onChange={(e) => setField('manufacturingInstruction', e.target.value)}
            rows={2}
            className={input}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Raw materials (one per line)
            <textarea
              value={form.rawMaterials}
              onChange={(e) => setField('rawMaterials', e.target.value)}
              rows={5}
              className={`${input} font-mono text-xs`}
            />
          </label>
          <label className={label}>
            Manufacturing steps (one per line)
            <textarea
              value={form.manufacturingSteps}
              onChange={(e) => setField('manufacturingSteps', e.target.value)}
              rows={5}
              className={`${input} font-mono text-xs`}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Sealing</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Default temperature (°C)
            <input
              type="number"
              min={1}
              value={form.sealingTemperatureC}
              onChange={(e) => setField('sealingTemperatureC', e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            Default SOP reference
            <input
              value={form.sealingSopRef}
              onChange={(e) => setField('sealingSopRef', e.target.value)}
              className={input}
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sealing modes</p>
          {form.sealingModes.map((m, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_7rem_1fr_auto]">
              <select
                value={m.mode}
                onChange={(e) => setMode(i, { mode: e.target.value })}
                className="rounded-md border border-line px-3 py-2 text-sm"
              >
                <option value="paper">Paper pouch</option>
                <option value="tyvek">Tyvek</option>
                <option value="blister">Blister</option>
              </select>
              <input
                type="number"
                min={1}
                value={m.temperatureC}
                onChange={(e) => setMode(i, { temperatureC: e.target.value })}
                placeholder="°C"
                className="rounded-md border border-line px-3 py-2 text-sm"
              />
              <input
                value={m.sopRef}
                onChange={(e) => setMode(i, { sopRef: e.target.value })}
                placeholder="SOP/MF/011"
                className="rounded-md border border-line px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    sealingModes: prev.sealingModes.filter((_, idx) => idx !== i),
                  }))
                }
                className="rounded-md border border-line px-3 py-2 text-sm text-danger hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                sealingModes: [
                  ...prev.sealingModes,
                  { mode: 'paper', temperatureC: form.sealingTemperatureC, sopRef: form.sealingSopRef },
                ],
              }))
            }
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-brand-50"
          >
            + Add sealing mode
          </button>
        </div>

        <label className={`${label} block`}>
          Packing type
          <select
            value={form.packingType}
            onChange={(e) => setField('packingType', e.target.value)}
            className={input}
          >
            <option value="">— not set —</option>
            <option value="pouch">Pouch</option>
            <option value="blisterTray">Blister tray</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Sterilization &amp; testing
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={label}>
            ETO temperature (°C)
            <input
              type="number"
              min={1}
              value={form.sterilizationTemperatureC}
              onChange={(e) => setField('sterilizationTemperatureC', e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            Duration (hours)
            <input
              type="number"
              min={1}
              value={form.sterilizationDurationHours}
              onChange={(e) => setField('sterilizationDurationHours', e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            ETO cartridge (g)
            <input
              type="number"
              min={1}
              value={form.etoCartridgeGrams}
              onChange={(e) => setField('etoCartridgeGrams', e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            Sterilization SOP
            <input
              value={form.sterilizationSopRef}
              onChange={(e) => setField('sterilizationSopRef', e.target.value)}
              className={input}
            />
          </label>
          <label className={label}>
            Sterility SOP
            <input value={form.sterilitySop} onChange={(e) => setField('sterilitySop', e.target.value)} className={input} />
          </label>
          <label className={label}>
            BET SOP
            <input value={form.betSop} onChange={(e) => setField('betSop', e.target.value)} className={input} />
          </label>
          <label className={label}>
            Storage condition
            <input
              value={form.storageCondition}
              onChange={(e) => setField('storageCondition', e.target.value)}
              className={input}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            RM QC checks (one per line)
            <textarea
              value={form.rmQcChecks}
              onChange={(e) => setField('rmQcChecks', e.target.value)}
              rows={4}
              className={`${input} font-mono text-xs`}
            />
          </label>
          <label className={label}>
            In-process QC checks (one per line)
            <textarea
              value={form.ipqcChecks}
              onChange={(e) => setField('ipqcChecks', e.target.value)}
              rows={4}
              className={`${input} font-mono text-xs`}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Batch record options
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted">Extra sections in the PDF</p>
            <div className="mt-2 space-y-1.5">
              {EXTRA_SECTION_LABELS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.extraSections.includes(opt.value)}
                    onChange={() => toggleList('extraSections', opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Stages not applicable to this product</p>
            <div className="mt-2 space-y-1.5">
              {OPTIONAL_STAGE_LABELS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.optionalStages.includes(opt.value)}
                    onChange={() => toggleList('optionalStages', opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Skipped stages are marked &ldquo;not applicable&rdquo; on every batch and omitted
              from the BMR PDF.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line px-4 py-2.5 text-sm hover:bg-brand-50 sm:py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60 sm:py-2"
        >
          {save.isPending ? 'Saving…' : 'Save template'}
        </button>
      </div>
    </form>
  );
}
