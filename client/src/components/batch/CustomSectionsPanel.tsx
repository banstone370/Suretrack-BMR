import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox';

interface SectionField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
}

interface SectionConfig {
  key: string;
  title?: string;
  instructionHeading?: string;
  instructions?: string[];
  tableHeading?: string;
  fields?: SectionField[];
  enabled?: boolean;
}

type RowData = Record<string, unknown>;

const BUILTIN_KEYS = new Set([
  'RAW_MATERIAL_QC',
  'RAW_MATERIAL_CONSUMPTION',
  'MANUFACTURING',
  'IN_PROCESS_QC',
  'PACKING',
  'SEALING',
  'VISUAL_INSPECTION',
  'STERILIZATION',
  'LABELLING',
  'STERILITY_TEST',
  'BET_TEST',
  'CONTROL_SAMPLE',
  'FINISHED_GOODS',
  'LABEL_OF_PRODUCT',
  'DISPATCH',
]);

const inputClass =
  'mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none ring-brand-800 focus:ring-2';

interface Props {
  batchId: string;
  processParamsSnapshot: Record<string, unknown>;
  stages: Record<string, unknown>;
  canEdit: boolean;
}

/**
 * Generic data entry for administrator-defined BMR sections. Each section's
 * column definitions come from the batch's template snapshot, and rows are
 * stored under `stages.customSections[sectionKey].rows`.
 */
export function CustomSectionsPanel({
  batchId,
  processParamsSnapshot,
  stages,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const sections = useMemo<SectionConfig[]>(() => {
    const list = processParamsSnapshot.sections;
    if (!Array.isArray(list)) return [];
    return (list as SectionConfig[]).filter(
      (section) =>
        section?.enabled !== false &&
        Array.isArray(section.fields) &&
        section.fields.length > 0 &&
        !BUILTIN_KEYS.has(section.key),
    );
  }, [processParamsSnapshot.sections]);

  const initialRows = useMemo(() => {
    const custom = (stages.customSections ?? {}) as Record<string, { rows?: RowData[] }>;
    const next: Record<string, RowData[]> = {};
    for (const section of sections) {
      const rows = custom[section.key]?.rows;
      next[section.key] = Array.isArray(rows) && rows.length > 0 ? rows : [{}];
    }
    return next;
  }, [sections, stages.customSections]);

  const [rows, setRows] = useState<Record<string, RowData[]>>(initialRows);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/batches/${batchId}/custom-sections`, {
        sections: Object.fromEntries(
          Object.entries(rows).map(([key, value]) => [key, { rows: value }]),
        ),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      setMsg('Additional records saved.');
    },
    onError: () => setMsg('Could not save additional records.'),
  });

  if (sections.length === 0) return null;

  function updateRow(sectionKey: string, rowIndex: number, fieldKey: string, value: unknown) {
    setRows((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map((row, i) =>
        i === rowIndex ? { ...row, [fieldKey]: value } : row,
      ),
    }));
  }

  function addRow(sectionKey: string) {
    setRows((prev) => ({ ...prev, [sectionKey]: [...(prev[sectionKey] ?? []), {}] }));
  }

  function removeRow(sectionKey: string, rowIndex: number) {
    setRows((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).filter((_, i) => i !== rowIndex),
    }));
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Additional Records
        </h2>
        {canEdit && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            <Save size={13} /> {save.isPending ? 'Saving…' : 'Save records'}
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-accent-600">{msg}</p>}

      {sections.map((section) => {
        const fields = section.fields ?? [];
        const list = rows[section.key] ?? [];
        return (
          <div key={section.key} className="space-y-2 rounded-lg border border-line/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-950">
                {section.title || section.key.replace(/_/g, ' ')}
              </h3>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => addRow(section.key)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-brand-50"
                >
                  <Plus size={12} /> Add row
                </button>
              )}
            </div>

            <div className="table-scroll">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    {fields.map((field) => (
                      <th key={field.key} className="px-2 py-1.5">
                        {field.label}
                      </th>
                    ))}
                    {canEdit && <th className="px-2 py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-line/70 align-top">
                      <td className="px-2 py-1.5 text-muted">{rowIndex + 1}</td>
                      {fields.map((field) => {
                        const value = row[field.key];
                        const set = (v: unknown) =>
                          updateRow(section.key, rowIndex, field.key, v);
                        return (
                          <td key={field.key} className="px-2 py-1.5">
                            {field.type === 'textarea' ? (
                              <textarea
                                disabled={!canEdit}
                                rows={2}
                                value={String(value ?? '')}
                                onChange={(e) => set(e.target.value)}
                                className={inputClass}
                              />
                            ) : field.type === 'select' ? (
                              <select
                                disabled={!canEdit}
                                value={String(value ?? '')}
                                onChange={(e) => set(e.target.value)}
                                className={inputClass}
                              >
                                <option value="">Select</option>
                                {(field.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === 'radio' ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {(field.options ?? []).map((option) => (
                                  <label key={option} className="flex items-center gap-1 text-xs">
                                    <input
                                      type="radio"
                                      disabled={!canEdit}
                                      name={`${section.key}-${rowIndex}-${field.key}`}
                                      checked={value === option}
                                      onChange={() => set(option)}
                                    />
                                    {option}
                                  </label>
                                ))}
                              </div>
                            ) : field.type === 'checkbox' ? (
                              <input
                                type="checkbox"
                                disabled={!canEdit}
                                checked={Boolean(value)}
                                onChange={(e) => set(e.target.checked)}
                                className="mt-2 h-4 w-4"
                              />
                            ) : (
                              <input
                                type={
                                  field.type === 'number'
                                    ? 'number'
                                    : field.type === 'date'
                                      ? 'date'
                                      : field.type === 'time'
                                        ? 'time'
                                        : 'text'
                                }
                                disabled={!canEdit}
                                value={String(value ?? '')}
                                onChange={(e) =>
                                  set(
                                    field.type === 'number'
                                      ? Number(e.target.value)
                                      : e.target.value,
                                  )
                                }
                                className={inputClass}
                              />
                            )}
                          </td>
                        );
                      })}
                      {canEdit && (
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeRow(section.key, rowIndex)}
                            className="rounded border border-line px-2 py-1 text-danger hover:bg-red-50"
                            aria-label="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td
                        colSpan={fields.length + (canEdit ? 2 : 1)}
                        className="px-2 py-4 text-center text-muted"
                      >
                        No rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
