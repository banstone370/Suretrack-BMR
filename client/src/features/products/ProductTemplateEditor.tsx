import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { ApiResponse, Product } from '../../types';

type Template = Exclude<NonNullable<Product['processTemplateId']>, string>;

interface ModeRow {
  mode: string;
  temperatureC: string;
  sopRef: string;
}

interface SectionRow {
  key: string;
  title: string;
  instructions: string;
  enabled: boolean;
}

interface SectionDef {
  key: string;
  label: string;
  defaultTitle: string;
}

/** Every BMR PDF section, with the heading the renderer prints by default. */
const SECTION_DEFS: SectionDef[] = [
  { key: 'RAW_MATERIAL_QC', label: 'Raw material QC', defaultTitle: 'QUALITY CHECKING OF RAW MATERIAL' },
  {
    key: 'RAW_MATERIAL_CONSUMPTION',
    label: 'Raw material consumption',
    defaultTitle: 'RAW MATERIAL CONSUMPTION RECORD',
  },
  { key: 'MANUFACTURING', label: 'Manufacturing', defaultTitle: 'MANUFACTURING PROCESS' },
  { key: 'IN_PROCESS_QC', label: 'In-process QC', defaultTitle: 'IN-PROCESS QUALITY CHECKING' },
  {
    key: 'VISUAL_INSPECTION',
    label: 'Visual inspection',
    defaultTitle: 'VISUAL INSPECTION FOR DUST / FOREIGN PARTICLES',
  },
  { key: 'PACKING', label: 'Packing', defaultTitle: 'PACKING RECORD' },
  { key: 'SEALING', label: 'Sealing', defaultTitle: 'SEALING RECORD' },
  { key: 'STERILIZATION', label: 'Sterilization', defaultTitle: 'STERILIZATION RECORD' },
  { key: 'LABELLING', label: 'Labelling', defaultTitle: 'BATCH LABELLING RECORD' },
  { key: 'STERILITY_TEST', label: 'Sterility test', defaultTitle: 'STERILITY TEST RECORD' },
  { key: 'BET_TEST', label: 'BET test', defaultTitle: 'BET TEST RECORD' },
  { key: 'CONTROL_SAMPLE', label: 'Control sample', defaultTitle: 'CONTROL SAMPLE RECORD' },
  { key: 'LABEL_OF_PRODUCT', label: 'Label of the product', defaultTitle: 'LABEL OF THE PRODUCT' },
  { key: 'FINISHED_GOODS', label: 'Finished goods', defaultTitle: 'BATCH PACKING RECORD' },
  { key: 'DISPATCH', label: 'Dispatch', defaultTitle: 'MATERIAL DISPATCH RECORD' },
];

/** Sections that print no instruction text unless the template supplies some. */
const NO_DEFAULT_INSTRUCTIONS = new Set([
  'IN_PROCESS_QC',
  'STERILITY_TEST',
  'BET_TEST',
  'CONTROL_SAMPLE',
  'LABEL_OF_PRODUCT',
  'FINISHED_GOODS',
  'DISPATCH',
]);

function sectionDef(key: string): SectionDef | undefined {
  return SECTION_DEFS.find((def) => def.key === key);
}

function sectionLabel(key: string): string {
  return sectionDef(key)?.label ?? key;
}

function instructionHint(key: string): string {
  if (key === 'SEALING') {
    return 'Blank = sealing instructions are generated from the sealing modes above.';
  }
  if (NO_DEFAULT_INSTRUCTIONS.has(key)) {
    return 'Blank = no instructions are printed for this section.';
  }
  return 'Blank = the standard instructions for this section are printed.';
}

/** Merge the saved section list with the full catalogue, keeping saved order. */
function initialSections(t: Template): SectionRow[] {
  const saved = t.sections ?? [];
  const rows: SectionRow[] = [];
  for (const section of saved) {
    const key = String(section?.key ?? '');
    if (!key || rows.some((row) => row.key === key)) continue;
    rows.push({
      key,
      title: section.title ?? '',
      instructions: (section.instructions ?? []).join('\n'),
      enabled: section.enabled !== false,
    });
  }
  for (const def of SECTION_DEFS) {
    if (rows.some((row) => row.key === def.key)) continue;
    // Legacy templates have no section list; control sample and product label
    // were opt-in via extraSections, so keep that off state.
    const legacyExtraOff =
      saved.length === 0 &&
      (def.key === 'CONTROL_SAMPLE' || def.key === 'LABEL_OF_PRODUCT') &&
      !(t.extraSections ?? []).includes(def.key);
    rows.push({ key: def.key, title: '', instructions: '', enabled: !legacyExtraOff });
  }
  return rows;
}

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
    sections: initialSections(t),
  };
}

interface Props {
  product: Product;
  template: Template;
  onClose: () => void;
}

/**
 * BMR template editor. Opens as a separate dialog window so the full template
 * can be edited without squashing it into the product card.
 */
export function ProductTemplateEditor({ product, template, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => initialState(template));
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [handleArmed, setHandleArmed] = useState<number | null>(null);

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
        sections: form.sections.map((section) => ({
          key: section.key,
          title: section.title.trim() || undefined,
          instructions: parseLines(section.instructions),
          enabled: section.enabled,
        })),
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setField(key: keyof ReturnType<typeof initialState>, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSection(index: number, patch: Partial<SectionRow>) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function moveSection(from: number, to: number) {
    setForm((prev) => {
      if (from === to || from < 0 || to < 0) return prev;
      if (from >= prev.sections.length || to >= prev.sections.length) return prev;
      const sections = [...prev.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...prev, sections };
    });
  }

  function toggleSectionOpen(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-[2px]"
        aria-label="Close editor"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bmr-template-title"
        className="relative z-[71] flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="bmr-template-title"
              className="font-display text-xl font-semibold text-brand-950"
            >
              BMR template — {product.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {product.catalogueNo} · changes apply to batches created from now on; batches
              already created keep their snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted hover:bg-brand-50 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            {error && <p className="text-sm text-danger">{error}</p>}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Document control
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={label}>
                  Template name
                  <input
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className={input}
                  />
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
                  <input
                    value={form.bmrIssueNo}
                    onChange={(e) => setField('bmrIssueNo', e.target.value)}
                    className={input}
                  />
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
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  PDF sections — wording &amp; order
                </h3>
                <p className="text-xs text-muted">
                  {form.sections.filter((row) => row.enabled).length} of {form.sections.length}{' '}
                  printed · drag the handle or use the arrows
                </p>
              </div>

              <div className="space-y-2">
                {form.sections.map((row, index) => {
                  const def = sectionDef(row.key);
                  const expanded = Boolean(openSections[row.key]);
                  const instructionCount = parseLines(row.instructions).length;
                  return (
                    <div
                      key={row.key}
                      draggable={handleArmed === index}
                      onDragStart={(e) => {
                        setDragIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', row.key);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                        setHandleArmed(null);
                      }}
                      onDragOver={(e) => {
                        if (dragIndex === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIndex !== index) setDragOverIndex(index);
                      }}
                      onDrop={(e) => {
                        if (dragIndex === null) return;
                        e.preventDefault();
                        moveSection(dragIndex, index);
                        setDragIndex(null);
                        setDragOverIndex(null);
                        setHandleArmed(null);
                      }}
                      className={`rounded-lg border bg-white p-2.5 transition ${
                        dragOverIndex === index && dragIndex !== null && dragIndex !== index
                          ? 'border-brand-800 ring-2 ring-brand-800/20'
                          : 'border-line'
                      } ${dragIndex === index ? 'opacity-60' : ''} ${
                        row.enabled ? '' : 'bg-brand-50/60'
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                        <button
                          type="button"
                          onMouseDown={() => setHandleArmed(index)}
                          onMouseUp={() => setHandleArmed(null)}
                          onMouseLeave={() => setHandleArmed(null)}
                          className="mt-1 cursor-grab rounded p-1 text-muted hover:bg-brand-50 hover:text-ink active:cursor-grabbing"
                          aria-label={`Drag ${sectionLabel(row.key)} to reorder`}
                          title="Drag to reorder"
                        >
                          <GripVertical size={16} />
                        </button>

                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => setSection(index, { enabled: e.target.checked })}
                          className="mt-2.5"
                          aria-label={`Print ${sectionLabel(row.key)}`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-muted">{index + 1}.</span>
                            <span
                              className={`truncate text-sm font-medium ${
                                row.enabled ? '' : 'text-muted line-through'
                              }`}
                            >
                              {sectionLabel(row.key)}
                            </span>
                          </div>
                          <input
                            value={row.title}
                            onChange={(e) => setSection(index, { title: e.target.value })}
                            placeholder={def?.defaultTitle ?? 'Section heading'}
                            className="mt-1 w-full rounded-md border border-line px-2.5 py-1.5 text-xs outline-none ring-brand-800 focus:ring-2"
                            aria-label={`Heading for ${sectionLabel(row.key)}`}
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSection(index, index - 1)}
                            disabled={index === 0}
                            className="rounded p-1.5 text-muted hover:bg-brand-50 hover:text-ink disabled:opacity-30"
                            aria-label={`Move ${sectionLabel(row.key)} up`}
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(index, index + 1)}
                            disabled={index === form.sections.length - 1}
                            className="rounded p-1.5 text-muted hover:bg-brand-50 hover:text-ink disabled:opacity-30"
                            aria-label={`Move ${sectionLabel(row.key)} down`}
                          >
                            <ChevronDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSectionOpen(row.key)}
                            className={`rounded-md border px-2 py-1 text-xs ${
                              instructionCount
                                ? 'border-brand-800/30 bg-brand-50 text-brand-900'
                                : 'border-line text-muted hover:bg-brand-50'
                            }`}
                            aria-expanded={expanded}
                          >
                            {instructionCount ? `Instructions (${instructionCount})` : 'Instructions'}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-2 sm:pl-7">
                          <textarea
                            value={row.instructions}
                            onChange={(e) => setSection(index, { instructions: e.target.value })}
                            rows={4}
                            placeholder="One instruction per line…"
                            className="w-full rounded-md border border-line px-2.5 py-1.5 font-mono text-xs outline-none ring-brand-800 focus:ring-2"
                            aria-label={`Instructions for ${sectionLabel(row.key)}`}
                          />
                          <p className="mt-1 text-[11px] text-muted">{instructionHint(row.key)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Sealing modes
                </p>
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
                        {
                          mode: 'paper',
                          temperatureC: form.sealingTemperatureC,
                          sopRef: form.sealingSopRef,
                        },
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
                  <input
                    value={form.sterilitySop}
                    onChange={(e) => setField('sterilitySop', e.target.value)}
                    className={input}
                  />
                </label>
                <label className={label}>
                  BET SOP
                  <input
                    value={form.betSop}
                    onChange={(e) => setField('betSop', e.target.value)}
                    className={input}
                  />
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
                  <p className="text-xs font-semibold text-muted">Optional record sections</p>
                  <p className="mt-2 text-sm text-muted">
                    <strong className="font-medium text-ink">Control sample</strong> and{' '}
                    <strong className="font-medium text-ink">Label of the product</strong> are
                    toggled in the “PDF sections” list above, where they can also be reordered.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted">
                    Stages not applicable to this product
                  </p>
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
                    Skipped stages are marked &ldquo;not applicable&rdquo; on every batch and
                    omitted from the BMR PDF.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line bg-white px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
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
      </div>
    </div>,
    document.body,
  );
}
