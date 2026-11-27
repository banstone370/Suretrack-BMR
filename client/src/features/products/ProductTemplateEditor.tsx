import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ApiResponse, Product } from '../../types';

type Template = Exclude<NonNullable<Product['processTemplateId']>, string>;

interface ModeRow {
  mode: string;
  temperatureC: string;
  sopRef: string;
}

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox';

interface SectionFieldRow {
  key: string;
  label: string;
  type: FieldType;
  options: string;
  roles: string;
}

interface SectionRow {
  key: string;
  custom: boolean;
  title: string;
  instructionHeading: string;
  instructions: string;
  tableHeading: string;
  fields: SectionFieldRow[];
  labels: Record<string, string>;
  enabled: boolean;
}

interface SectionDef {
  key: string;
  label: string;
  defaultTitle: string;
  instructionHeading?: string;
  tableHeading?: string;
  columns: string[];
  labels?: Array<{ key: string; label: string }>;
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Simple text' },
  { value: 'textarea', label: 'Text area' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio button' },
  { value: 'checkbox', label: 'Checkbox / multiple choice' },
];

/** Every built-in BMR PDF section with its default headings and table columns. */
const SECTION_DEFS: SectionDef[] = [
  {
    key: 'RAW_MATERIAL_QC',
    label: 'Raw material QC',
    defaultTitle: 'QUALITY CHECKING OF RAW MATERIAL',
    instructionHeading: 'GENERAL INSTRUCTION FOR QUALITY CHECKING',
    columns: [
      'Sr. No.',
      'PROCESS',
      'DONE ON',
      'START TIME',
      'END TIME',
      'OBSERVATION / NOTE',
      'DONE BY',
      'CHECKED BY',
    ],
    labels: [
      { key: 'defaultObservation', label: 'Default observation for new rows' },
      { key: 'defaultResult', label: 'Default result (PASS / FAIL / NA)' },
    ],
  },
  {
    key: 'RAW_MATERIAL_CONSUMPTION',
    label: 'Raw material consumption',
    defaultTitle: 'RAW MATERIAL CONSUMPTION RECORD',
    instructionHeading: 'GENERAL INSTRUCTION FOR ISSUE OF RAW MATERIAL',
    columns: [
      'Sr. No.',
      'RAW MATERIAL NAME',
      'BATCH NO',
      'QUALITY CHECKED ON',
      'QUANTITY',
      'DONE BY',
      'CHECKED BY',
    ],
  },
  {
    key: 'MANUFACTURING',
    label: 'Manufacturing',
    defaultTitle: 'MANUFACTURING PROCESS',
    instructionHeading: 'GENERAL INSTRUCTION FOR MANUFACTURING PROCESS',
    tableHeading: 'RECORD FOR AREA/EQUIPMENT LINE CLEARANCE FOR MANUFACTURING PROCESS',
    columns: ['Sr. No.', 'PROCESS', 'DONE ON', 'START TIME', 'END TIME', 'DONE BY'],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'totalManufactured', label: 'Total manufactured label' },
      { key: 'totalRejected', label: 'Total rejected label' },
      { key: 'verifiedBy', label: 'Verified by label' },
    ],
  },
  {
    key: 'IN_PROCESS_QC',
    label: 'In-process QC',
    defaultTitle: 'INPROCESS QUALITY CHECKING',
    instructionHeading: 'GENERAL INSTRUCTIONS FOR IN-PROCESS QUALITY CHECKING',
    columns: ['Sr. No.', 'PROCESS', 'DONE ON', 'OBSERVATION / NOTE', 'DONE BY'],
    labels: [
      { key: 'totalInspected', label: 'Total inspected label' },
      { key: 'totalRejected', label: 'Total rejected label' },
      { key: 'totalGood', label: 'Total good label' },
      { key: 'verifiedBy', label: 'Verified by label' },
    ],
  },
  {
    key: 'PACKING',
    label: 'Packing',
    defaultTitle: 'PACKING RECORD',
    instructionHeading: 'GENERAL INSTRUCTIONS FOR PACKING PROCESS',
    tableHeading: 'RECORD FOR LINE CLEARANCE FOR PACKING PROCESS',
    columns: [
      'Sr. No.',
      'Date of packing',
      'Quantity Of Pouch Taken',
      'Quantity Of Device Packed',
      'No. Of Pouches Damaged',
      'Done by',
      'Checked by',
    ],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'verifiedBy', label: 'Verified by label' },
    ],
  },
  {
    key: 'SEALING',
    label: 'Sealing',
    defaultTitle: 'SEALING RECORD',
    instructionHeading: 'GENERAL INSTRUCTIONS FOR SEALING PROCESS',
    tableHeading: 'RECORD FOR LINE CLEARANCE FOR SEALING PROCESS',
    columns: [
      'Sr. No.',
      'Date of sealing',
      'Quantity Of Devises Sealed',
      'Total Damages In The Process',
      'Done by',
      'Checked by',
    ],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'verifiedBy', label: 'Verified by label' },
    ],
  },
  {
    key: 'VISUAL_INSPECTION',
    label: 'Visual inspection',
    defaultTitle: 'VISUAL INSPECTION FOR DUST/FOREIGN PARTICLES',
    tableHeading: 'RECORD FOR LINE CLEARANCE FOR VISUAL INSPECTION PROCESS',
    columns: [
      'Sr. No.',
      'Date of visual inspection',
      'Total number of units checked',
      'Number of units with white particles found',
      'Total number of good units found',
      'Done by',
      'Checked by',
    ],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'verifiedBy', label: 'Verified by label' },
    ],
  },
  {
    key: 'STERILIZATION',
    label: 'Sterilization',
    defaultTitle: 'STERILIZATION RECORD',
    instructionHeading: 'GENERAL INSTRUCTIONS FOR STERILIZATION PROCESS',
    tableHeading: 'RECORD FOR LINE CLEARANCE FOR THE ETO STERILIZER',
    columns: [
      'DATE',
      'QUANTITY',
      'START TIME',
      'END TIME',
      'OPERATOR',
      'CHECKED BY',
      'BATCH NO',
      'RECEIVED ON',
      'EXPIRY DATE',
    ],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'verifiedBy', label: 'Verified by label' },
      { key: 'paramsHeading', label: 'Process parameters heading' },
      { key: 'cartridgeTitle', label: 'ETO cartridge table heading' },
    ],
  },
  {
    key: 'LABELLING',
    label: 'Labelling',
    defaultTitle: 'BATCH LABELLING RECORD',
    instructionHeading: 'GENERAL INSTRUCTIONS FOR LABELLING PROCESS',
    tableHeading: 'RECORD FOR LINE CLEARANCE FOR THE LABELLING PROCESS',
    columns: [],
    labels: [
      { key: 'checkedBy', label: 'Clearance label' },
      { key: 'verifiedBy', label: 'Verified by label' },
      { key: 'activityTitle', label: 'Activity heading' },
      { key: 'labelsPrintedBy', label: 'Labels printed by label' },
      { key: 'labelsPrinted', label: 'Labels printed label' },
      { key: 'devicesLabelled', label: 'Devices labelled label' },
      { key: 'labelsDestroyed', label: 'Labels destroyed label' },
      { key: 'doneOn', label: 'Done on label' },
    ],
  },
  {
    key: 'STERILITY_TEST',
    label: 'Sterility test',
    defaultTitle: 'STERILITY TEST RECORD',
    columns: [],
    labels: [
      { key: 'sop', label: 'SOP label' },
      { key: 'sampleQuantity', label: 'Sample quantity label' },
      { key: 'doneOn', label: 'Done on label' },
      { key: 'reportNo', label: 'Report no label' },
      { key: 'result', label: 'Result label' },
      { key: 'checkedBy', label: 'Checked by label' },
      { key: 'startTime', label: 'Start time label' },
      { key: 'endTime', label: 'End time label' },
    ],
  },
  {
    key: 'BET_TEST',
    label: 'BET test',
    defaultTitle: 'BET TEST RECORD',
    columns: [],
    labels: [
      { key: 'sop', label: 'SOP label' },
      { key: 'sampleQuantity', label: 'Sample quantity label' },
      { key: 'doneOn', label: 'Done on label' },
      { key: 'reportNo', label: 'Report no label' },
      { key: 'result', label: 'Result label' },
      { key: 'checkedBy', label: 'Checked by label' },
      { key: 'startTime', label: 'Start time label' },
      { key: 'endTime', label: 'End time label' },
    ],
  },
  {
    key: 'CONTROL_SAMPLE',
    label: 'Control sample',
    defaultTitle: 'CONTROL SAMPLE RECORD',
    columns: [],
    labels: [
      { key: 'sampleRetained', label: 'Sample retained label' },
      { key: 'sampleQuantity', label: 'Sample quantity label' },
      { key: 'doneBy', label: 'Done by label' },
      { key: 'checkedBy', label: 'Checked by label' },
    ],
  },
  {
    key: 'FINISHED_GOODS',
    label: 'Finished goods',
    defaultTitle: 'BATCH PACKING RECORD',
    tableHeading: 'AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS',
    columns: [],
    labels: [
      { key: 'quantity', label: 'Finished products label' },
      { key: 'transferDate', label: 'Transfer date label' },
      { key: 'transferNote', label: 'Transfer note label' },
    ],
  },
  {
    key: 'LABEL_OF_PRODUCT',
    label: 'Label of the product',
    defaultTitle: 'LABEL OF THE PRODUCT :-',
    columns: [],
  },
  {
    key: 'DISPATCH',
    label: 'Dispatch',
    defaultTitle: 'MATERIAL DISPATCH RECORD',
    columns: ['NAME OF CUSTOMER', 'BILL NO.', 'DATE OF DISPATCH', 'QTY DISPATCHED'],
    labels: [
      { key: 'authorizedSignatory', label: 'Authorized signatory label' },
      { key: 'signatoryRole', label: 'Signatory role label' },
    ],
  },
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
  return sectionDef(key)?.label ?? key.replace(/_/g, ' ');
}

function instructionHint(key: string, custom: boolean): string {
  if (custom) return 'Blank = no instructions are printed for this section.';
  if (key === 'SEALING') {
    return 'Blank = sealing instructions are generated from the sealing modes above.';
  }
  if (NO_DEFAULT_INSTRUCTIONS.has(key)) {
    return 'Blank = no instructions are printed for this section.';
  }
  return 'Blank = the standard instructions for this section are printed.';
}

function makeFields(labels: string[]): SectionFieldRow[] {
  return labels.map((label, index) => ({
    key: `col${index + 1}`,
    label,
    type: 'text',
    options: '',
    roles: '',
  }));
}

/** Merge the saved section list with the full catalogue, keeping saved order. */
function initialSections(t: Template): SectionRow[] {
  const saved = t.sections ?? [];
  const rows: SectionRow[] = [];
  for (const section of saved) {
    const key = String(section?.key ?? '');
    if (!key || rows.some((row) => row.key === key)) continue;
    const def = sectionDef(key);
    const savedFields = (section.fields ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      options: (field.options ?? []).join(', '),
      roles: (field.roles ?? []).join(', '),
    }));
    const fields =
      savedFields.length > 0
        ? savedFields
        : def
          ? makeFields(section.columns?.length ? section.columns : def.columns)
          : makeFields(['Column 1', 'Column 2']);
    rows.push({
      key,
      custom: !def,
      title: section.title ?? '',
      instructionHeading: section.instructionHeading ?? '',
      instructions: (section.instructions ?? []).join('\n'),
      tableHeading: section.tableHeading ?? '',
      fields,
      labels: { ...(section.labels ?? {}) },
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
    rows.push({
      key: def.key,
      custom: false,
      title: '',
      instructionHeading: '',
      instructions: '',
      tableHeading: '',
      fields: makeFields(def.columns),
      labels: {},
      enabled: !legacyExtraOff,
    });
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
    sealingDurationSeconds: String(t.sealingParams?.dwellSeconds ?? 3),
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

type FormState = ReturnType<typeof initialState>;

/**
 * BMR template editor. Opens as a separate dialog window so the full template
 * can be edited without squashing it into the product card.
 */
export function ProductTemplateEditor({ product, template, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(template));
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [handleArmed, setHandleArmed] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function buildPayload() {
    return {
      name: form.name.trim(),
      docId: form.docId.trim() || undefined,
      bmrIssueNo: form.bmrIssueNo.trim() || undefined,
      bmrEffectiveDate: form.bmrEffectiveDate.trim() || undefined,
      manufacturingInstruction: form.manufacturingInstruction.trim() || undefined,
      rawMaterials: parseLines(form.rawMaterials),
      manufacturingSteps: parseLines(form.manufacturingSteps),
      sealingTemperatureC: Number(form.sealingTemperatureC),
      sealingSopRef: form.sealingSopRef.trim(),
      sealingDurationSeconds: Number(form.sealingDurationSeconds),
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
      sections: form.sections.map((section) => {
        const fields = section.fields
          .filter((field) => field.label.trim())
          .map((field) => ({
            key: field.key.trim() || field.label.trim().toLowerCase().replace(/\W+/g, '_'),
            label: field.label.trim(),
            type: field.type,
            options:
              field.type === 'select' || field.type === 'radio'
                ? field.options
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                : undefined,
            roles: field.roles
              .split(',')
              .map((role) => role.trim())
              .filter(Boolean),
          }));
        return {
          key: section.key,
          title: section.title.trim() || undefined,
          instructionHeading: section.instructionHeading.trim() || undefined,
          instructions: parseLines(section.instructions),
          tableHeading: section.tableHeading.trim() || undefined,
          columns: fields.map((field) => field.label),
          fields,
          labels: Object.fromEntries(
            Object.entries(section.labels)
              .map(([key, value]) => [key, value.trim()])
              .filter(([, value]) => value),
          ),
          enabled: section.enabled,
        };
      }),
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<ApiResponse<unknown>>(
        `/products/${product._id}/template`,
        buildPayload(),
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

  async function preview() {
    setError('');
    setPreviewing(true);
    const win = window.open('', '_blank');
    try {
      const response = await api.post(`/products/${product._id}/template/preview`, {
        ...buildPayload(),
        name: form.name.trim() || 'Template preview',
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      if (win) win.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to render preview',
      );
    } finally {
      setPreviewing(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSection(index: number, patch: Partial<SectionRow>) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function setFieldRow(sectionIndex: number, fieldIndex: number, patch: Partial<SectionFieldRow>) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) =>
        i === sectionIndex
          ? {
              ...row,
              fields: row.fields.map((field, j) =>
                j === fieldIndex ? { ...field, ...patch } : field,
              ),
            }
          : row,
      ),
    }));
  }

  function setLabel(sectionIndex: number, key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) =>
        i === sectionIndex ? { ...row, labels: { ...row.labels, [key]: value } } : row,
      ),
    }));
  }

  function addColumn(sectionIndex: number) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) =>
        i === sectionIndex
          ? {
              ...row,
              fields: [
                ...row.fields,
                { key: `col${row.fields.length + 1}_${Date.now()}`, label: 'New column', type: 'text', options: '', roles: '' },
              ],
            }
          : row,
      ),
    }));
  }

  function removeColumn(sectionIndex: number, fieldIndex: number) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.map((row, i) =>
        i === sectionIndex
          ? { ...row, fields: row.fields.filter((_, j) => j !== fieldIndex) }
          : row,
      ),
    }));
  }

  function addSection() {
    const id = `CUSTOM_${Date.now()}`;
    setForm((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          key: id,
          custom: true,
          title: 'NEW RECORD SECTION',
          instructionHeading: 'GENERAL INSTRUCTIONS',
          instructions: '',
          tableHeading: '',
          fields: [
            { key: 'col1', label: 'Sr. No.', type: 'text', options: '', roles: '' },
            { key: 'col2', label: 'Details', type: 'textarea', options: '', roles: '' },
          ],
          labels: {},
          enabled: true,
        },
      ],
    }));
    setOpenSections((prev) => ({ ...prev, [id]: true }));
  }

  function removeSection(index: number) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
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
  const smallInput =
    'w-full rounded-md border border-line px-2 py-1.5 text-xs outline-none ring-brand-800 focus:ring-2';

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
                  PDF sections — wording, tables &amp; order
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
                              {row.custom ? row.title || 'Custom section' : sectionLabel(row.key)}
                            </span>
                            {row.custom && (
                              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-800">
                                custom
                              </span>
                            )}
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
                            {instructionCount ? `Content (${instructionCount})` : 'Content'}
                          </button>
                          {row.custom && (
                            <button
                              type="button"
                              onClick={() => removeSection(index)}
                              className="rounded p-1.5 text-danger hover:bg-red-50"
                              aria-label={`Remove ${sectionLabel(row.key)}`}
                              title="Remove custom section"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-3 border-t border-line/70 pt-3 sm:pl-7">
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Instruction heading
                            <input
                              value={row.instructionHeading}
                              onChange={(e) =>
                                setSection(index, { instructionHeading: e.target.value })
                              }
                              placeholder={def?.instructionHeading ?? 'GENERAL INSTRUCTIONS'}
                              className={smallInput}
                            />
                          </label>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Instructions (one per line)
                            <textarea
                              value={row.instructions}
                              onChange={(e) => setSection(index, { instructions: e.target.value })}
                              rows={4}
                              placeholder="One instruction per line…"
                              className="mt-1 w-full rounded-md border border-line px-2.5 py-1.5 font-mono text-xs outline-none ring-brand-800 focus:ring-2"
                            />
                          </label>
                          <p className="text-[11px] text-muted">
                            {instructionHint(row.key, row.custom)}
                          </p>

                          <details className="rounded-md border border-line/80 bg-brand-50/30 px-3 py-2">
                            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-brand-900">
                              <Settings2 size={14} />
                              Table columns, data types &amp; labels
                              <span className="font-normal text-muted">
                                ({row.fields.length} column{row.fields.length === 1 ? '' : 's'})
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">
                                Table heading
                                <input
                                  value={row.tableHeading}
                                  onChange={(e) =>
                                    setSection(index, { tableHeading: e.target.value })
                                  }
                                  placeholder={def?.tableHeading ?? 'Optional table heading'}
                                  className={smallInput}
                                />
                              </label>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                    Columns
                                  </p>
                                  {(row.custom || row.fields.length === 0) && (
                                    <button
                                      type="button"
                                      onClick={() => addColumn(index)}
                                      className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-[11px] hover:bg-brand-50"
                                    >
                                      <Plus size={12} /> Add column
                                    </button>
                                  )}
                                </div>
                                {row.fields.length === 0 && (
                                  <p className="text-xs text-muted">
                                    This section has no table. Add a column to create one.
                                  </p>
                                )}
                                {row.fields.map((field, fieldIndex) => (
                                  <div
                                    key={`${row.key}-${fieldIndex}`}
                                    className="grid gap-1.5 sm:grid-cols-[1.2fr_0.9fr_1fr_1fr_auto]"
                                  >
                                    <input
                                      value={field.label}
                                      onChange={(e) =>
                                        setFieldRow(index, fieldIndex, { label: e.target.value })
                                      }
                                      placeholder="Column name"
                                      className={smallInput}
                                      aria-label={`Column ${fieldIndex + 1} name`}
                                    />
                                    <select
                                      value={field.type}
                                      onChange={(e) =>
                                        setFieldRow(index, fieldIndex, {
                                          type: e.target.value as FieldType,
                                        })
                                      }
                                      className={smallInput}
                                      aria-label={`Column ${fieldIndex + 1} data type`}
                                    >
                                      {FIELD_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>
                                          {type.label}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      value={field.options}
                                      onChange={(e) =>
                                        setFieldRow(index, fieldIndex, { options: e.target.value })
                                      }
                                      placeholder={
                                        field.type === 'select' || field.type === 'radio'
                                          ? 'Options, comma separated'
                                          : 'Options (n/a)'
                                      }
                                      disabled={field.type !== 'select' && field.type !== 'radio'}
                                      className={`${smallInput} disabled:bg-brand-50/50 disabled:text-muted`}
                                      aria-label={`Column ${fieldIndex + 1} options`}
                                    />
                                    <input
                                      value={field.roles}
                                      onChange={(e) =>
                                        setFieldRow(index, fieldIndex, { roles: e.target.value })
                                      }
                                      placeholder="Roles (comma separated)"
                                      className={smallInput}
                                      aria-label={`Column ${fieldIndex + 1} authorized roles`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeColumn(index, fieldIndex)}
                                      disabled={!row.custom && row.fields.length <= 1}
                                      className="rounded border border-line px-2 py-1 text-danger hover:bg-red-50 disabled:opacity-30"
                                      aria-label={`Remove column ${fieldIndex + 1}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                                {!row.custom && row.fields.length > 0 && (
                                  <p className="text-[11px] text-muted">
                                    Built-in tables keep their fixed column count; names and
                                    types are still saved. Use a custom section for a freely
                                    resizable table.
                                  </p>
                                )}
                              </div>

                              {(def?.labels?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                    Fill-in labels
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {def!.labels!.map((item) => (
                                      <label key={item.key} className="text-xs text-muted">
                                        {item.label}
                                        <input
                                          value={row.labels[item.key] ?? ''}
                                          onChange={(e) =>
                                            setLabel(index, item.key, e.target.value)
                                          }
                                          placeholder={item.key}
                                          className={smallInput}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addSection}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-brand-800/40 bg-brand-50/50 px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
              >
                <Plus size={15} /> Add section
              </button>
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
              <div className="grid gap-3 sm:grid-cols-3">
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
                <label className={label}>
                  Sealing time (seconds)
                  <input
                    type="number"
                    min={1}
                    value={form.sealingDurationSeconds}
                    onChange={(e) => setField('sealingDurationSeconds', e.target.value)}
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

          <div className="flex flex-col-reverse gap-2 border-t border-line bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-2.5 text-sm hover:bg-brand-50 sm:py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={preview}
              disabled={previewing}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-800/30 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-100 disabled:opacity-60 sm:py-2"
            >
              <Eye size={15} />
              {previewing ? 'Rendering…' : 'Preview PDF'}
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
