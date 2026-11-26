import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Dispatch } from '../models/Dispatch.js';
import { IBatch } from '../models/Batch.js';

/**
 * Template-driven BMR renderer (flow layout) that follows the SURETECH
 * batch manufacturing record master exactly:
 *
 *   common header  -> company, address, title, doc id / issue / effective date, page x of y
 *   common footer  -> PRODUCTION ENGG | QUALITY ANALYSIS signature block, on every page
 *   body           -> configurable sections, each with heading, instruction block,
 *                     clearance line, table with blank rows and fill-in fields.
 *
 * Every printed string (section heading, instruction heading, instruction lines,
 * table heading, table columns and field labels) can be overridden per template.
 * Blank values fall back to the standard text; a single "-" removes the item.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = { left: 42, right: 42, top: 152, bottom: 128 };
const CONTENT_W = PAGE_W - M.left - M.right;
const OUTER = { x: 24.5, y: 24.0, w: 546.25, h: 793.85 };
const BLACK = '#000000';

type Snap = Record<string, any>;
type Stage = Record<string, any>;

interface SectionCfg {
  title?: string;
  instructionHeading?: string;
  instructions?: string[];
  tableHeading?: string;
  columns?: string[];
  fields?: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>;
  labels?: Record<string, string>;
}

/** Standard print order, matching the approved BMR master. */
export const DEFAULT_SECTION_ORDER = [
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
];

function str(v: unknown, fallback = ''): string {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function dt(v?: string | Date | null): string {
  if (!v) return '';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB');
}

function sig(v: unknown): string {
  if (!v || typeof v !== 'object') return str(v);
  const x = v as { name?: string; employeeId?: string; signedAt?: string | Date };
  if (!x.name) return '';
  return `${x.name}${x.employeeId ? ` (${x.employeeId})` : ''}${
    x.signedAt ? ` @ ${dt(x.signedAt)}` : ''
  }`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Trimmed custom text, with "-" meaning "do not print". */
function headingText(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  return text === '-' ? '' : text;
}

function labelOf(cfg: SectionCfg, snap: Snap, id: string, fallback: string): string {
  const own = cfg.labels?.[id];
  if (own !== undefined) return headingText(own, fallback);
  const global = (snap.pdfLabels ?? {})[id];
  if (global !== undefined && global !== null && String(global).trim()) {
    return headingText(global, fallback);
  }
  return fallback;
}

/**
 * Resolve a section's saved configuration. Returns null when the section is
 * disabled, and {} when the template has no section list at all (legacy).
 */
function sectionConfig(snap: Snap, key: string): SectionCfg | null {
  const list =
    Array.isArray(snap.sections) && snap.sections.length > 0
      ? (snap.sections as Array<Record<string, unknown>>)
      : null;
  if (!list) return {};
  const found = list.find((item) => String(item?.key ?? '') === key);
  if (!found || found.enabled === false) return null;

  const instructions = Array.isArray(found.instructions)
    ? (found.instructions as unknown[]).map((line) => String(line ?? '').trim()).filter(Boolean)
    : [];
  const columns = Array.isArray(found.columns)
    ? (found.columns as unknown[]).map((col) => String(col ?? '').trim())
    : [];
  const labels =
    found.labels && typeof found.labels === 'object'
      ? (found.labels as Record<string, string>)
      : undefined;

  return {
    title: found.title == null ? undefined : String(found.title).trim(),
    instructionHeading:
      found.instructionHeading == null ? undefined : String(found.instructionHeading).trim(),
    instructions: instructions.length ? instructions : undefined,
    tableHeading: found.tableHeading == null ? undefined : String(found.tableHeading).trim(),
    columns: columns.length ? columns : undefined,
    fields: Array.isArray(found.fields)
      ? (found.fields as Array<Record<string, unknown>>).map((field) => ({
          key: String(field.key ?? ''),
          label: String(field.label ?? ''),
          type: String(field.type ?? 'text'),
          options: Array.isArray(field.options)
            ? (field.options as unknown[]).map((option) => String(option))
            : undefined,
          required: field.required === true,
        }))
      : undefined,
    labels,
  };
}

/** True when the section should be printed for this snapshot. */
function sectionEnabled(snap: Snap, key: string): boolean {
  if (Array.isArray(snap.sections) && snap.sections.length > 0) {
    return sectionConfig(snap, key) !== null;
  }
  // Legacy snapshots had no section list; only the optional extras were togglable.
  if (key === 'CONTROL_SAMPLE' || key === 'LABEL_OF_PRODUCT') {
    const extras: string[] = Array.isArray(snap.extraSections) ? snap.extraSections : [];
    return extras.includes(key);
  }
  return true;
}

/** Print order: saved order first, then any missing default sections. */
function sectionOrder(snap: Snap): string[] {
  const configured =
    Array.isArray(snap.sections) && snap.sections.length > 0
      ? (snap.sections as Array<Record<string, unknown>>).map((item) => String(item?.key ?? ''))
      : [];
  const ordered: string[] = [];
  for (const key of configured) {
    if (key && !ordered.includes(key)) ordered.push(key);
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

/* ------------------------------------------------------------------ */
/* drawing primitives                                                   */
/* ------------------------------------------------------------------ */

function times(doc: PDFKit.PDFDocument, size = 9) {
  doc.font('Times-Roman').fontSize(size).fillColor(BLACK);
}

function timesBold(doc: PDFKit.PDFDocument, size = 9) {
  doc.font('Times-Bold').fontSize(size).fillColor(BLACK);
}

function t(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w?: number,
  opts: PDFKit.Mixins.TextOptions = {},
) {
  doc.text(text, x, y, { width: w, lineGap: 0, ...opts });
}

interface RenderCtx {
  pageNo: number;
  chrome: boolean;
  totalPages: number;
  batch: IBatch;
  snap: Snap;
}

let ctx: RenderCtx | null = null;

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: 'A4', margin: 0 });
  if (ctx) {
    ctx.pageNo += 1;
    if (ctx.chrome) drawChrome(doc, ctx.batch, ctx.snap, ctx.pageNo, ctx.totalPages);
  }
  doc.x = M.left;
  doc.y = M.top;
}

function line(doc: PDFKit.PDFDocument, x1: number, y1: number, x2: number, y2: number, w = 0.5) {
  doc.save().strokeColor(BLACK).lineWidth(w).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
}

function rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, lw = 0.5) {
  doc.save().strokeColor(BLACK).lineWidth(lw).rect(x, y, w, h).stroke().restore();
}

function bottomLimit(): number {
  return PAGE_H - M.bottom;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > bottomLimit()) newPage(doc);
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string, size = 10) {
  if (!text) return;
  ensureSpace(doc, 56);
  doc.moveDown(0.4);
  timesBold(doc, size);
  doc.text(text, M.left, doc.y, { width: CONTENT_W, align: 'center', underline: true });
  doc.x = M.left;
}

/** The smaller underlined heading used for "RECORD FOR ..." sub-blocks. */
function subHeading(doc: PDFKit.PDFDocument, text: string) {
  if (!text) return;
  ensureSpace(doc, 46);
  doc.moveDown(0.25);
  timesBold(doc, 8.6);
  doc.text(text, M.left, doc.y, { width: CONTENT_W, align: 'center', underline: true });
  doc.x = M.left;
  doc.moveDown(0.3);
}

function instructionBlock(doc: PDFKit.PDFDocument, heading: string, lines: string[]) {
  if (heading) {
    ensureSpace(doc, 42);
    timesBold(doc, 8.2);
    doc.text(heading, M.left, doc.y, { width: CONTENT_W, align: 'center', underline: true });
    doc.x = M.left;
    doc.moveDown(0.25);
  }
  times(doc, 8);
  for (const instruction of lines) {
    ensureSpace(doc, 22);
    doc.text(instruction, M.left + 24, doc.y, { width: CONTENT_W - 48 });
    doc.x = M.left;
    doc.moveDown(0.12);
  }
  doc.moveDown(0.3);
}

function clearanceLine(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  cfg: SectionCfg,
  verifiedBy?: unknown,
) {
  ensureSpace(doc, 30);
  const checked = labelOf(cfg, snap, 'checkedBy', 'Checked by');
  const verified = labelOf(cfg, snap, 'verifiedBy', 'Verified by');
  const y = doc.y;
  timesBold(doc, 7.8);
  doc.text(`${checked}:`, M.left + 24, y, { width: 90, lineBreak: false });
  times(doc, 7.8);
  doc.text(sig(verifiedBy), M.left + 118, y, { width: 150, underline: true });
  timesBold(doc, 7.8);
  doc.text(`${verified}:`, M.left + 286, y, { width: 80, lineBreak: false });
  times(doc, 7.8);
  doc.text('', M.left + 362, y, { width: 140, underline: true });
  doc.x = M.left;
  doc.y = y + 16;
}

interface Col {
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

/** Apply saved column captions by position; blank entries keep the default. */
function applyColumns(cols: Col[], overrides?: string[]): Col[] {
  if (!overrides || overrides.length === 0) return cols;
  return cols.map((col, index) => {
    const custom = overrides[index]?.trim();
    if (!custom || custom === '-') return col;
    return { ...col, label: custom };
  });
}

function table(
  doc: PDFKit.PDFDocument,
  cols: Col[],
  rows: string[][],
  opts: { headerH?: number; minRowH?: number; cellSize?: number; headerSize?: number } = {},
) {
  const minRowH = opts.minRowH ?? 24;
  const cellSize = opts.cellSize ?? 7.4;
  const headerSize = opts.headerSize ?? 7.2;
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  const x = M.left;

  timesBold(doc, headerSize);
  const headerH =
    opts.headerH ??
    Math.max(26, ...cols.map((c) => doc.heightOfString(c.label, { width: c.width - 8 }) + 8));

  const drawHeader = (y: number): number => {
    timesBold(doc, headerSize);
    let cx = x;
    for (const c of cols) {
      doc.text(c.label, cx + 4, y + 4, { width: c.width - 8, align: c.align ?? 'left', lineGap: 0 });
      cx += c.width;
    }
    rect(doc, x, y, totalW, headerH);
    cx = x;
    for (let i = 0; i < cols.length - 1; i++) {
      cx += cols[i].width;
      line(doc, cx, y, cx, y + headerH);
    }
    doc.x = M.left;
    return y + headerH;
  };

  ensureSpace(doc, headerH + minRowH * 2);
  let y = drawHeader(doc.y);

  for (const row of rows) {
    times(doc, cellSize);
    const heights = row.map((cell, i) =>
      doc.heightOfString(String(cell ?? ''), { width: cols[i].width - 8 }),
    );
    const rowH = Math.max(minRowH, ...heights.map((h) => h + 8));
    if (y + rowH > bottomLimit()) {
      newPage(doc);
      y = drawHeader(M.top);
    }
    times(doc, cellSize);
    let cx = x;
    row.forEach((cell, i) => {
      const c = cols[i];
      doc.text(String(cell ?? ''), cx + 4, y + 4, {
        width: c.width - 8,
        align: c.align ?? 'left',
        lineGap: 0,
      });
      cx += c.width;
    });
    rect(doc, x, y, totalW, rowH);
    cx = x;
    for (let i = 0; i < cols.length - 1; i++) {
      cx += cols[i].width;
      line(doc, cx, y, cx, y + rowH);
    }
    doc.x = M.left;
    y += rowH;
  }

  doc.x = M.left;
  doc.y = y;
  doc.moveDown(0.4);
}

function fieldRow(doc: PDFKit.PDFDocument, pairs: Array<{ label: string; value: string }>) {
  ensureSpace(doc, 22);
  const colW = CONTENT_W / pairs.length;
  const y = doc.y;
  let cx = M.left + 4;
  for (const pair of pairs) {
    timesBold(doc, 7.8);
    doc.text(pair.label, cx, y, { width: colW * 0.56, lineGap: 0 });
    times(doc, 7.8);
    doc.text(pair.value, cx + colW * 0.56, y, {
      width: colW * 0.44 - 8,
      underline: true,
      lineGap: 0,
    });
    cx += colW;
  }
  doc.x = M.left;
  doc.y = y + 16;
}

/** "Label: ______" with the value underlined, used for the totals lines. */
function fillLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 18);
  const y = doc.y;
  const x = M.left + 24;
  const width = CONTENT_W - 48;
  timesBold(doc, 8);
  doc.text(label, x, y, { width, lineGap: 0, lineBreak: false });
  const labelW = doc.widthOfString(label);
  times(doc, 8);
  doc.text(value, x + labelW + 4, y, { width: width - labelW - 8, underline: true });
  doc.x = M.left;
  doc.y = y + 15;
}

const MODE_LABEL: Record<string, string> = {
  paper: 'Paper Pouch',
  tyvek: 'Tyvek Pouch',
  blister: 'Blister Tray',
};

const RM_QC_INSTRUCTIONS = [
  '1. Check quality of each material as per approved specification for the respective material.',
  '2. Material which is approved to be used for manufacturing.',
  '3. Rejected material should be kept separate with appropriate status labeling.',
];

const FIFO_INSTRUCTIONS = [
  '1. Please ensure that the area is clean and dust free.',
  '2. No previous batch material lying in the area.',
  '3. Issue material on the basis of First In First out (FIFO system).',
];

const MFG_INSTRUCTIONS = [
  '1. Ensure removal of previous lot material before start of manufacturing process for the next lot.',
  '2. Ensure that manufacturing area is cleaned as specified in the SOP.',
  '3. Ensure that equipment and machines are clean.',
  '4. Ensure that the required materials for manufacturing are issued.',
  '5. Use personnel protective wear like hand gloves, nose mask before the start of the manufacturing process.',
  '6. Ensure that AHU of the manufacturing area is ON.',
  '7. Take line clearance as specified in SOP before starting the manufacturing activity.',
];

const PACKING_INSTRUCTIONS = [
  '1. Follow the packing procedure as specified in the SOP.',
  '2. Ensure removal of previous lot material before start of packing process for the next lot.',
  '3. Take line clearance before starting any new packing operation and carry out in process checks during packing process.',
  '4. Ensure that the area for packing is clean as specified in the SOP.',
  '5. Ensure that the equipment required for packing process is clean.',
  '6. Use personnel protective wear like hand gloves, nose mask before the start of packing process.',
  '7. Ensure that AHU of the packing area is ON.',
];

const VISUAL_INSTRUCTIONS = [
  '1. Carry out visual inspection process as specified in the SOP.',
  '2. Ensure removal of previous lot material before start of visual inspection process for the next lot.',
];

const STERILE_INSTRUCTIONS = [
  '1. Carry out sterilization process as specified in the SOP.',
  '2. Ensure removal of previous lot material from the sterilizer before start of sterilization of the next lot.',
  '3. Verify the certificate of analysis of ETO cartridge.',
];

const LABELLING_INSTRUCTIONS = [
  '1. Carry out labeling process as specified in the SOP.',
  '2. Ensure removal of previous lot material from the labeling area before start of labeling of the next lot.',
  '3. Verify the correct labels and its required quantity is received.',
];

/** Merge template-defined names with entered records so blank forms print rows. */
function mergeRows<T extends Stage>(
  base: T[],
  entered: T[],
  minRows: number,
): Array<{ base?: T; entered?: T }> {
  const count = Math.max(base.length, entered.length, minRows);
  const rows: Array<{ base?: T; entered?: T }> = [];
  for (let i = 0; i < count; i++) rows.push({ base: base[i], entered: entered[i] });
  return rows;
}

function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/* ------------------------------------------------------------------ */
/* sections                                                             */
/* ------------------------------------------------------------------ */

function rmQcSection(doc: PDFKit.PDFDocument, snap: Snap, stages: Record<string, Stage>, cfg: SectionCfg) {
  const qc = stages.rawMaterialQc ?? {};
  const checks = listOf<Stage>((qc as Stage).checks);
  const templateChecks = listOf<string>(snap.rmQcChecks);

  sectionTitle(doc, headingText(cfg.title, 'QUALITY CHECKING OF RAW MATERIAL'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTION FOR QUALITY CHECKING'),
    cfg.instructions ?? RM_QC_INSTRUCTIONS,
  );

  const rows = mergeRows(
    templateChecks.map((process) => ({ process })),
    checks,
    4,
  ).map((row, index) => {
    const entered = row.entered ?? {};
    return [
      `${pad2(index + 1)}.`,
      str(entered.process, row.base?.process ?? ''),
      dt(entered.processDate),
      str(entered.startTime),
      str(entered.endTime),
      str(entered.observation),
      sig(entered.doneBy),
      sig(entered.checkedBy),
    ];
  });

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 30 },
        { label: 'PROCESS', width: 132 },
        { label: 'DONE ON', width: 48, align: 'center' },
        { label: 'START TIME', width: 46, align: 'center' },
        { label: 'END TIME', width: 46, align: 'center' },
        { label: 'OBSERVATION / NOTE', width: 87 },
        { label: 'DONE BY', width: 60 },
        { label: 'CHECKED BY', width: 62 },
      ],
      cfg.columns,
    ),
    rows,
  );
}

function consumptionSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const cons = stages.rawMaterialConsumption ?? {};
  const lines = listOf<Stage>((cons as Stage).lines);

  sectionTitle(doc, headingText(cfg.title, 'RAW MATERIAL CONSUMPTION RECORD'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTION FOR ISSUE OF RAW MATERIAL'),
    cfg.instructions ?? FIFO_INSTRUCTIONS,
  );

  const rows = lines.map((entry, index) => [
    `${pad2(index + 1)}.`,
    str(entry.rawMaterialName),
    str(entry.supplierBatchNo),
    dt(entry.qualityCheckedDate),
    str(entry.quantityWithdrawn),
    sig(entry.doneBy),
    sig(entry.checkedBy),
  ]);
  const targetRows = Math.max(3, rows.length + 1);
  for (let i = rows.length; i < targetRows; i++) {
    rows.push([`${pad2(i + 1)}.`, '', '', '', '', '', '']);
  }

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 28 },
        { label: 'RAW MATERIAL NAME', width: 155 },
        { label: 'BATCH NO', width: 62 },
        { label: 'QUALITY CHECKED ON', width: 66, align: 'center' },
        { label: 'QUANTITY', width: 58, align: 'center' },
        { label: 'DONE BY', width: 72 },
        { label: 'CHECKED BY', width: 70 },
      ],
      cfg.columns,
    ),
    rows,
  );
}

function manufacturingSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const mfg = stages.manufacturing ?? {};
  const templateSteps = listOf<{ step: string }>(snap.manufacturingSteps);
  const steps = listOf<Stage>((mfg as Stage).steps);

  sectionTitle(doc, headingText(cfg.title, 'MANUFACTURING PROCESS'));
  const defaultInstructions = str(snap.manufacturingInstruction)
    ? [str(snap.manufacturingInstruction)]
    : MFG_INSTRUCTIONS;
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTION FOR MANUFACTURING PROCESS'),
    cfg.instructions ?? defaultInstructions,
  );
  subHeading(
    doc,
    headingText(
      cfg.tableHeading,
      'RECORD FOR AREA/EQUIPMENT LINE CLEARANCE FOR MANUFACTURING PROCESS',
    ),
  );
  clearanceLine(doc, snap, cfg, (mfg as Stage).verifiedBy);

  const rows = mergeRows(
    templateSteps.map((entry) => ({ step: entry.step })),
    steps,
    1,
  ).map((row, index) => {
    const entered = row.entered ?? {};
    return [
      `${pad2(index + 1)}.`,
      str(entered.step, row.base?.step ?? ''),
      dt(entered.processDate),
      str(entered.startTime),
      str(entered.endTime),
      sig(entered.doneBy ?? (mfg as Stage).operator),
    ];
  });

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 32 },
        { label: 'PROCESS', width: 243 },
        { label: 'DONE ON', width: 60, align: 'center' },
        { label: 'START TIME', width: 58, align: 'center' },
        { label: 'END TIME', width: 56, align: 'center' },
        { label: 'DONE BY', width: 62 },
      ],
      cfg.columns,
    ),
    rows,
  );

  fillLine(
    doc,
    labelOf(cfg, snap, 'totalManufactured', 'Total quantity manufactured:'),
    str((mfg as Stage).totalManufactured),
  );
  fillLine(
    doc,
    labelOf(cfg, snap, 'totalRejected', 'Total quantity rejected during manufacturing process.'),
    str((mfg as Stage).totalRejected),
  );
  fillLine(
    doc,
    labelOf(cfg, snap, 'verifiedBy', 'Verified by:'),
    sig((mfg as Stage).verifiedBy),
  );
}

function ipqcSection(doc: PDFKit.PDFDocument, snap: Snap, stages: Record<string, Stage>, cfg: SectionCfg) {
  const ip = stages.inProcessQc ?? {};
  const checks = listOf<Stage>((ip as Stage).checks);
  const templateChecks = listOf<string>(snap.ipqcChecks);

  sectionTitle(doc, headingText(cfg.title, 'INPROCESS QUALITY CHECKING'));
  if (cfg.instructions?.length) {
    instructionBlock(
      doc,
      headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS FOR IN-PROCESS QUALITY CHECKING'),
      cfg.instructions,
    );
  }

  const rows = mergeRows(
    templateChecks.map((process) => ({ process })),
    checks,
    1,
  ).map((row, index) => {
    const entered = row.entered ?? {};
    return [
      `${pad2(index + 1)}.`,
      str(entered.check, row.base?.process ?? ''),
      dt(entered.doneOn ?? (ip as Stage).date),
      str(entered.observation ?? (ip as Stage).observation),
      sig(entered.doneBy ?? (ip as Stage).qcCheckedBy ?? (ip as Stage).checkedBy),
    ];
  });

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 34 },
        { label: 'PROCESS', width: 208 },
        { label: 'DONE ON', width: 66, align: 'center' },
        { label: 'OBSERVATION / NOTE', width: 122 },
        { label: 'DONE BY', width: 81 },
      ],
      cfg.columns,
    ),
    rows,
  );

  fillLine(
    doc,
    labelOf(cfg, snap, 'totalInspected', 'Total quantity inspected:'),
    str((ip as Stage).totalInspected),
  );
  fillLine(
    doc,
    labelOf(cfg, snap, 'totalRejected', 'Total quantity rejected during quality checking process.'),
    str((ip as Stage).totalRejected),
  );
  fillLine(
    doc,
    labelOf(cfg, snap, 'totalGood', 'Total good quantity:'),
    str((ip as Stage).totalGood),
  );
  fillLine(
    doc,
    labelOf(cfg, snap, 'verifiedBy', 'Verified by:'),
    sig((ip as Stage).verifiedBy),
  );
}

function visualSection(doc: PDFKit.PDFDocument, snap: Snap, stages: Record<string, Stage>, cfg: SectionCfg) {
  const vis = stages.visualInspection ?? {};

  sectionTitle(doc, headingText(cfg.title, 'VISUAL INSPECTION FOR DUST/FOREIGN PARTICLES'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, ''),
    cfg.instructions ?? VISUAL_INSTRUCTIONS,
  );
  subHeading(
    doc,
    headingText(cfg.tableHeading, 'RECORD FOR LINE CLEARANCE FOR VISUAL INSPECTION PROCESS'),
  );
  clearanceLine(doc, snap, cfg, (vis as Stage).verifiedBy);

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 30 },
        { label: 'Date of visual inspection', width: 78, align: 'center' },
        { label: 'Total number of units checked', width: 80, align: 'center' },
        { label: 'Number of units with white particles found', width: 90, align: 'center' },
        { label: 'Total number of good units found', width: 82, align: 'center' },
        { label: 'Done by', width: 76 },
        { label: 'Checked by', width: 75 },
      ],
      cfg.columns,
    ),
    [
      [
        '01.',
        dt((vis as Stage).inspectionDate),
        str((vis as Stage).unitsChecked),
        str((vis as Stage).particlesFound),
        str((vis as Stage).goodUnits ?? (vis as Stage).totalGood),
        sig((vis as Stage).doneBy),
        sig((vis as Stage).checkedBy),
      ],
    ],
  );
}

function packingSection(doc: PDFKit.PDFDocument, snap: Snap, stages: Record<string, Stage>, cfg: SectionCfg) {
  const pack = stages.packing ?? {};
  if ((pack as Stage).lockState === 'SKIPPED') return;

  sectionTitle(doc, headingText(cfg.title, 'PACKING RECORD'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS FOR PACKING PROCESS'),
    cfg.instructions ?? PACKING_INSTRUCTIONS,
  );
  subHeading(doc, headingText(cfg.tableHeading, 'RECORD FOR LINE CLEARANCE FOR PACKING PROCESS'));
  clearanceLine(doc, snap, cfg, (pack as Stage).verifiedBy);

  const pouchLabel =
    str(snap.packingType) === 'blisterTray' ? 'Quantity Of Pouch/Tray Taken' : 'Quantity Of Pouch Taken';

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 30 },
        { label: 'Date of packing', width: 72, align: 'center' },
        { label: pouchLabel, width: 78, align: 'center' },
        { label: 'Quantity Of Device Packed', width: 82, align: 'center' },
        { label: 'No. Of Pouches Damaged', width: 76, align: 'center' },
        { label: 'Done by', width: 82 },
        { label: 'Checked by', width: 91 },
      ],
      cfg.columns,
    ),
    [
      [
        '01.',
        dt((pack as Stage).packingDate),
        str((pack as Stage).pouchesTaken),
        str((pack as Stage).devicesPacked),
        str((pack as Stage).pouchesDamaged),
        sig((pack as Stage).operator ?? (pack as Stage).doneBy),
        sig((pack as Stage).checkedBy),
      ],
    ],
  );
}

function sealingSection(doc: PDFKit.PDFDocument, snap: Snap, stages: Record<string, Stage>, cfg: SectionCfg) {
  const seal = stages.sealing ?? {};
  if ((seal as Stage).lockState === 'SKIPPED') return;

  sectionTitle(doc, headingText(cfg.title, 'SEALING RECORD'));

  const modes = listOf<Stage>((seal as Stage).modes);
  const dwell = str(snap.sealingParams?.dwellSeconds, '3');
  const defaultLines: string[] = modes.map(
    (mode, index) =>
      `${index + 1}. At ${str(mode.configuredTemperatureC, '200')}°C For ${dwell} sec For ${
        MODE_LABEL[str(mode.mode)] ?? str(mode.mode)
      }, Operation done As Per ${str(mode.sopRef)}`,
  );
  if (defaultLines.length === 0) {
    const templateModes = listOf<{ mode: string; temperatureC: number; sopRef: string }>(
      snap.sealingModes,
    );
    templateModes.forEach((mode, index) => {
      defaultLines.push(
        `${index + 1}. At ${mode.temperatureC}°C For ${dwell} sec For ${MODE_LABEL[mode.mode] ?? mode.mode}, Operation done As Per ${mode.sopRef}`,
      );
    });
  }
  defaultLines.push(
    `${defaultLines.length + 1}. Ensure removal of previous lot material before start of sealing process for the next lot.`,
  );

  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS FOR SEALING PROCESS'),
    cfg.instructions ?? defaultLines,
  );
  subHeading(doc, headingText(cfg.tableHeading, 'RECORD FOR LINE CLEARANCE FOR SEALING PROCESS'));
  clearanceLine(doc, snap, cfg, (seal as Stage).verifiedBy);

  const rows: string[][] =
    modes.length > 0
      ? modes.map((mode, index) => [
          `${pad2(index + 1)}.`,
          dt(mode.sealingDate ?? (seal as Stage).sealingDate),
          str(mode.devicesSealed ?? (seal as Stage).devicesSealed),
          str(mode.damages ?? mode.totalDamages ?? (seal as Stage).totalDamages),
          sig(mode.doneBy ?? (seal as Stage).operator),
          sig(mode.checkedBy ?? (seal as Stage).checkedBy),
        ])
      : [
          [
            '01.',
            dt((seal as Stage).sealingDate),
            str((seal as Stage).devicesSealed),
            str((seal as Stage).totalDamages ?? (seal as Stage).damages),
            sig((seal as Stage).operator ?? (seal as Stage).doneBy),
            sig((seal as Stage).checkedBy),
          ],
        ];

  table(
    doc,
    applyColumns(
      [
        { label: 'Sr. No.', width: 30 },
        { label: 'Date of sealing', width: 100, align: 'center' },
        { label: 'Quantity Of Devises Sealed', width: 128, align: 'center' },
        { label: 'Total Damages In The Process', width: 120, align: 'center' },
        { label: 'Done by', width: 66 },
        { label: 'Checked by', width: 67 },
      ],
      cfg.columns,
    ),
    rows,
  );
}

function sterilizationSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const ster = stages.sterilization ?? {};
  const params = snap.sterilizationParams ?? {};

  sectionTitle(doc, headingText(cfg.title, 'STERILIZATION RECORD'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS FOR STERILIZATION PROCESS'),
    cfg.instructions ?? STERILE_INSTRUCTIONS,
  );
  subHeading(doc, headingText(cfg.tableHeading, 'RECORD FOR LINE CLEARANCE FOR THE ETO STERILIZER'));
  clearanceLine(doc, snap, cfg, (ster as Stage).verifiedBy);

  ensureSpace(doc, 90);
  times(doc, 8);
  doc.text(
    headingText(cfg.labels?.paramsHeading, 'ETO sterilization process parameters'),
    M.left + 24,
    doc.y,
    { width: CONTENT_W - 48 },
  );
  doc.x = M.left;
  doc.moveDown(0.25);
  timesBold(doc, 8);
  doc.text(
    `ETO STERILIZATION AT ${str((ster as Stage).configuredTemperatureC ?? params.temperatureC, '55')}°C, for ${str(
      (ster as Stage).requiredDurationHours ?? params.durationHours,
      '4',
    )}hrs`,
    M.left + 24,
    doc.y,
    { width: CONTENT_W - 48 },
  );
  doc.x = M.left;
  doc.moveDown(0.15);
  doc.text(
    `${str((ster as Stage).etoCartridgeGrams ?? params.etoCartridgeGrams, '40')}gm ETO gas cartridge used per lot`,
    M.left + 24,
    doc.y,
    { width: CONTENT_W - 48 },
  );
  doc.x = M.left;
  doc.moveDown(0.15);
  times(doc, 8);
  doc.text(
    `OPERATION OF ETO MACHINE AS PER ${str((ster as Stage).sopRef ?? params.sopRef, 'SOP/MF/008')}`,
    M.left + 24,
    doc.y,
    { width: CONTENT_W - 48 },
  );
  doc.x = M.left;
  doc.moveDown(0.6);

  table(
    doc,
    applyColumns(
      [
        { label: 'DATE', width: 62, align: 'center' },
        { label: 'QUANTITY', width: 70, align: 'center' },
        { label: 'START TIME', width: 68, align: 'center' },
        { label: 'END TIME', width: 68, align: 'center' },
        { label: 'OPERATOR', width: 112 },
        { label: 'CHECKED BY', width: 131 },
      ],
      cfg.columns?.slice(0, 6),
    ),
    [
      [
        dt((ster as Stage).startDate ?? (ster as Stage).date),
        str((ster as Stage).quantity),
        str((ster as Stage).startTime),
        str((ster as Stage).endTime),
        sig((ster as Stage).operator),
        sig((ster as Stage).checkedBy),
      ],
    ],
  );

  sectionTitle(
    doc,
    headingText(cfg.labels?.cartridgeTitle, 'ETO CARTRIDGE DETAILS'),
    8.8,
  );
  table(
    doc,
    applyColumns(
      [
        { label: 'BATCH NO', width: 170 },
        { label: 'RECEIVED ON', width: 170, align: 'center' },
        { label: 'EXPIRY DATE', width: 171, align: 'center' },
      ],
      cfg.columns?.slice(6, 9),
    ),
    [
      [
        str((ster as Stage).cartridgeBatchNo),
        dt((ster as Stage).cartridgeReceivedOn),
        dt((ster as Stage).cartridgeExpiryDate),
      ],
    ],
  );
}

function labellingSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const lab = stages.labelling ?? {};

  sectionTitle(doc, headingText(cfg.title, 'BATCH LABELLING RECORD'));
  instructionBlock(
    doc,
    headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS FOR LABELLING PROCESS'),
    cfg.instructions ?? LABELLING_INSTRUCTIONS,
  );
  subHeading(
    doc,
    headingText(cfg.tableHeading, 'RECORD FOR LINE CLEARANCE FOR THE LABELLING PROCESS'),
  );
  clearanceLine(doc, snap, cfg, (lab as Stage).verifiedBy);

  sectionTitle(
    doc,
    headingText(cfg.labels?.activityTitle, 'RECORD OF LABELLING ACTIVITY'),
    8.8,
  );
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'labelsPrintedBy', 'LABELS PRINTED BY:'),
      value: sig((lab as Stage).printedBy),
    },
    {
      label: labelOf(cfg, snap, 'labelsPrinted', 'NO. OF LABELS PRINTED:'),
      value: str((lab as Stage).labelsPrinted),
    },
  ]);
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'devicesLabelled', 'NO. OF DEVICES LABELLED:'),
      value: str((lab as Stage).devicesLabelled),
    },
    {
      label: labelOf(cfg, snap, 'labelsDestroyed', 'NO. OF LABELS DESTROYED:'),
      value: str((lab as Stage).labelsDestroyed),
    },
  ]);
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'doneOn', 'DONE ON:'),
      value: dt((lab as Stage).doneOn),
    },
    {
      label: labelOf(cfg, snap, 'checkedBy', 'Checked by:'),
      value: sig((lab as Stage).checkedBy),
    },
  ]);
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'verifiedBy', 'Verified by:'),
      value: sig((lab as Stage).verifiedBy),
    },
    { label: '', value: '' },
  ]);
}

/** Two-column label/value rows with values aligned on the same baseline. */
function alignedFieldRow(
  doc: PDFKit.PDFDocument,
  left: { label: string; value: string },
  right?: { label: string; value: string },
) {
  ensureSpace(doc, 28);
  const half = CONTENT_W / 2;
  const labelW = 96;
  const valueW = half - labelW - 12;
  const y = doc.y;
  const draw = (x: number, pair: { label: string; value: string }) => {
    timesBold(doc, 8);
    doc.text(pair.label, x, y, { width: labelW, lineBreak: false });
    times(doc, 8);
    doc.text(pair.value, x + labelW + 2, y, { width: valueW, underline: true });
  };
  times(doc, 8);
  const rowH =
    18 +
    Math.max(
      doc.heightOfString(left.value, { width: valueW }),
      right ? doc.heightOfString(right.value, { width: valueW }) : 0,
    );
  draw(M.left + 6, left);
  if (right) draw(M.left + half, right);
  doc.x = M.left;
  doc.y = y + rowH;
}

function labTestSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  title: string,
  stage: Stage,
  fallbackSop: string,
  sopLabel: string,
  cfg: SectionCfg,
) {
  sectionTitle(doc, headingText(cfg.title, title));
  if (cfg.instructions?.length) {
    instructionBlock(doc, headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS'), cfg.instructions);
  }
  alignedFieldRow(
    doc,
    {
      label: labelOf(cfg, snap, 'sop', sopLabel),
      value: str(stage.sopRef, fallbackSop),
    },
    {
      label: labelOf(cfg, snap, 'sampleQuantity', 'SAMPLE QUANTITY:'),
      value: str(stage.sampleQuantity),
    },
  );
  alignedFieldRow(
    doc,
    {
      label: labelOf(cfg, snap, 'doneOn', 'DONE ON:'),
      value: dt(stage.testDate ?? stage.doneOn),
    },
    {
      label: labelOf(cfg, snap, 'reportNo', 'REPORT NO:'),
      value: str(stage.reportNo),
    },
  );
  alignedFieldRow(
    doc,
    {
      label: labelOf(cfg, snap, 'result', 'RESULT:'),
      value: str(stage.result),
    },
    {
      label: labelOf(cfg, snap, 'checkedBy', 'CHECKED BY:'),
      value: sig(stage.checkedBy),
    },
  );
  alignedFieldRow(
    doc,
    {
      label: labelOf(cfg, snap, 'startTime', 'START TIME:'),
      value: str(stage.startTime),
    },
    {
      label: labelOf(cfg, snap, 'endTime', 'END TIME:'),
      value: str(stage.endTime),
    },
  );
}

function controlSampleSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const cs = stages.controlSample ?? {};
  sectionTitle(doc, headingText(cfg.title, 'CONTROL SAMPLE RECORD'));
  if (cfg.instructions?.length) {
    instructionBlock(doc, headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS'), cfg.instructions);
  }
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'sampleRetained', 'SAMPLE RETAINED:'),
      value: 'YES / NO',
    },
    {
      label: labelOf(cfg, snap, 'sampleQuantity', 'SAMPLE QUANTITY:'),
      value: str((cs as Stage).sampleQuantity),
    },
  ]);
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'doneBy', 'DONE BY:'),
      value: sig((cs as Stage).doneBy),
    },
    {
      label: labelOf(cfg, snap, 'checkedBy', 'CHECKED BY:'),
      value: sig((cs as Stage).checkedBy),
    },
  ]);
}

function labelOfProductSection(doc: PDFKit.PDFDocument, snap: Snap, cfg: SectionCfg) {
  sectionTitle(doc, headingText(cfg.title, 'LABEL OF THE PRODUCT :-'), 9.4);
  if (cfg.instructions?.length) {
    instructionBlock(doc, headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS'), cfg.instructions);
  }
  // The master leaves the rest of the page blank so the printed label can be affixed.
  ensureSpace(doc, 420);
  doc.y += 380;
}

function finishedGoodsSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  cfg: SectionCfg,
) {
  const fg = stages.finishedGoods ?? {};
  sectionTitle(doc, headingText(cfg.title, 'BATCH PACKING RECORD'));
  subHeading(
    doc,
    headingText(
      cfg.tableHeading,
      'AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS',
    ),
  );
  fieldRow(doc, [
    {
      label: labelOf(cfg, snap, 'quantity', 'NO. OF FINISHED PRODUCTS:'),
      value: str((fg as Stage).quantity),
    },
    {
      label: labelOf(cfg, snap, 'transferDate', 'DATE OF TRANSFER TO F.G'),
      value: dt((fg as Stage).transferDate),
    },
  ]);

  ensureSpace(doc, 60);
  doc.moveDown(0.3);
  timesBold(doc, 7.8);
  doc.text(
    labelOf(cfg, snap, 'transferNote', 'Finished goods transfer note number and date'),
    M.left + 24,
    doc.y,
    { width: CONTENT_W - 48, underline: true },
  );
  doc.x = M.left;
  doc.y += 34;
}

function dispatchSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  dispatchRows: Array<Record<string, unknown>>,
  cfg: SectionCfg,
) {
  sectionTitle(doc, headingText(cfg.title, 'MATERIAL DISPATCH RECORD'));
  if (cfg.instructions?.length) {
    instructionBlock(doc, headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS'), cfg.instructions);
  }

  const rows = dispatchRows.map((row) => [
    str(row.customerName ?? row.nameOfCustomer),
    str(row.billNo),
    dt((row.createdAt ?? row.dispatchDate ?? row.dateOfDispatch) as string),
    str(row.quantityDispatched ?? row.quantity),
  ]);
  const targetRows = Math.max(8, rows.length + 1);
  for (let i = rows.length; i < targetRows; i++) rows.push(['', '', '', '']);

  ensureSpace(doc, 60 + 26 + rows.length * 24 + 60);

  table(
    doc,
    applyColumns(
      [
        { label: 'NAME OF CUSTOMER', width: 220 },
        { label: 'BILL NO.', width: 90 },
        { label: 'DATE OF DISPATCH', width: 100, align: 'center' },
        { label: 'QTY DISPATCHED', width: 101, align: 'center' },
      ],
      cfg.columns,
    ),
    rows,
  );

  ensureSpace(doc, 50);
  timesBold(doc, 8);
  doc.text(
    labelOf(cfg, snap, 'authorizedSignatory', 'Authorized Signatory'),
    M.left + 24,
    doc.y + 8,
    { width: 220, align: 'center' },
  );
  doc.text(labelOf(cfg, snap, 'signatoryRole', '(PRODUCTION ENGG)'), M.left + 24, doc.y + 20, {
    width: 220,
    align: 'center',
  });
  doc.x = M.left;
}

function customSection(
  doc: PDFKit.PDFDocument,
  snap: Snap,
  stages: Record<string, Stage>,
  key: string,
  cfg: SectionCfg,
) {
  const title = key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  sectionTitle(doc, headingText(cfg.title, title));
  if (cfg.instructions?.length) {
    instructionBlock(
      doc,
      headingText(cfg.instructionHeading, 'GENERAL INSTRUCTIONS'),
      cfg.instructions,
    );
  }
  if (cfg.tableHeading) subHeading(doc, headingText(cfg.tableHeading, ''));

  const fields = cfg.fields ?? [];
  if (fields.length === 0) return;

  const custom = (stages.customSections ?? {}) as Record<string, unknown>;
  const sectionData = (custom[key] ?? {}) as Record<string, unknown>;
  const rowsIn = listOf<Record<string, unknown>>(sectionData.rows);
  const width = CONTENT_W / fields.length;
  const format = (value: unknown, type: string): string => {
    if (value === undefined || value === null) return '';
    if (type === 'date') return dt(value as string);
    if (type === 'checkbox') return value ? 'YES' : 'NO';
    return String(value);
  };
  const rows = rowsIn.map((row) =>
    fields.map((field) => format(row[field.key], field.type)),
  );
  const targetRows = Math.max(3, rows.length + 1);
  while (rows.length < targetRows) rows.push(fields.map(() => ''));

  table(
    doc,
    fields.map((field) => ({
      label: field.label,
      width,
      align:
        field.type === 'number' || field.type === 'date' || field.type === 'time'
          ? 'center'
          : 'left',
    })),
    rows,
  );

  const verified = str((sectionData as Record<string, unknown>).verifiedBy);
  if (verified) clearanceLine(doc, snap, cfg, verified);
}

/* ------------------------------------------------------------------ */
/* page chrome                                                          */
/* ------------------------------------------------------------------ */

function drawChrome(
  doc: PDFKit.PDFDocument,
  batch: IBatch,
  snap: Snap,
  pageNo: number,
  totalPages: number,
) {
  rect(doc, OUTER.x, OUTER.y, OUTER.w, OUTER.h, 0.8);

  const labels = (snap.pdfLabels ?? {}) as Record<string, string>;
  const headerTitle = headingText(labels.headerTitle, 'BATCH MANUFACTURING RECORD');

  timesBold(doc, 10.2);
  doc.text('SURETECH MEDICAL INC.', 0, 37, { width: PAGE_W, align: 'center' });
  times(doc, 8.2);
  doc.text('333 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063', 0, 51, {
    width: PAGE_W,
    align: 'center',
  });
  if (headerTitle) {
    timesBold(doc, 11.8);
    doc.text(headerTitle, 0, 76, { width: PAGE_W, align: 'center' });
  }

  timesBold(doc, 8.8);
  t(doc, 'Doc ID:', 49.6, 104, 50);
  times(doc, 8.8);
  t(doc, str(snap.docId), 88, 104, 100);
  times(doc, 8.8);
  t(doc, `Issue No.-${str(snap.bmrIssueNo, '01')}`, 49.6, 118, 130);
  t(
    doc,
    snap.bmrEffectiveDate ? `Effective Date :${str(snap.bmrEffectiveDate)}` : '',
    49.6,
    132,
    200,
  );
  timesBold(doc, 8.8);
  t(doc, `Page ${pageNo} of ${totalPages}`, 455, 132, 67, { align: 'right' });

  const fy = 726.65;
  rect(doc, 45, fy, 504, 53.7);
  line(doc, 45, 757.25, 549, 757.25);
  line(doc, 297, fy, 297, fy + 53.7);
  timesBold(doc, 8.2);
  t(doc, headingText(labels.footerLeft, 'PRODUCTION ENGG'), 50.5, 758.2, 230);
  t(doc, headingText(labels.footerRight, 'QUALITY ANALYSIS'), 303, 758.2, 230);
}

function productBlock(doc: PDFKit.PDFDocument, batch: IBatch) {
  const x = M.left;
  const y = M.top;
  const w = CONTENT_W;
  const h = 126.5;
  rect(doc, x, y, w, h, 0.65);
  line(doc, x, y + 60, x + w, y + 60);
  line(doc, x + w / 2, y + 60, x + w / 2, y + h);

  timesBold(doc, 9);
  doc.text(
    `PRODUCT NAME: ${str(batch.productName)}${
      (batch as unknown as { size?: string }).size ? `  (${(batch as unknown as { size?: string }).size})` : ''
    }`,
    x + 6,
    y + 6,
    { width: w - 12 },
  );
  doc.text('CATALOGUE NO. :', x + 6, y + 32, { width: 110 });
  times(doc, 9);
  t(doc, str(batch.catalogueNo), x + 110, y + 32, 130);

  timesBold(doc, 9);
  t(doc, 'BATCH NO. :', x + 6, y + 68, 85);
  t(doc, 'STR DATE:', x + w / 2 + 6, y + 68, 100);
  times(doc, 9);
  t(doc, str(batch.batchNo), x + 80, y + 68, 160);
  t(doc, dt(batch.manufacturingDate), x + w / 2 + 110, y + 68, 110);

  timesBold(doc, 9);
  t(doc, 'BATCH SIZE :', x + 6, y + 98, 85);
  t(doc, 'EXPIRY DATE:', x + w / 2 + 6, y + 98, 100);
  times(doc, 9);
  t(doc, str(batch.batchSize), x + 80, y + 98, 160);
  t(doc, dt(batch.expiryDate), x + w / 2 + 110, y + 98, 110);

  doc.y = y + h;
  doc.x = M.left;
}

/* ------------------------------------------------------------------ */
/* document assembly                                                    */
/* ------------------------------------------------------------------ */

async function renderPass(
  batch: IBatch,
  snap: Snap,
  stages: Record<string, Stage>,
  dispatchRows: Array<Record<string, unknown>>,
  out: Response | null,
  chrome: boolean,
  totalPages: number,
): Promise<number> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `BMR - ${batch.batchNo ?? ''}`,
      Author: 'Suretech Medical Inc.',
      Subject: 'Batch Manufacturing Record',
    },
  });
  if (out) doc.pipe(out);

  ctx = { pageNo: 1, chrome, totalPages, batch, snap };
  doc.x = M.left;
  doc.y = M.top;
  if (chrome) drawChrome(doc, batch, snap, 1, totalPages);

  productBlock(doc, batch);

  for (const key of sectionOrder(snap)) {
    if (!sectionEnabled(snap, key)) continue;
    const cfg = sectionConfig(snap, key) ?? {};
    switch (key) {
      case 'RAW_MATERIAL_QC':
        rmQcSection(doc, snap, stages, cfg);
        break;
      case 'RAW_MATERIAL_CONSUMPTION':
        consumptionSection(doc, snap, stages, cfg);
        break;
      case 'MANUFACTURING':
        manufacturingSection(doc, snap, stages, cfg);
        break;
      case 'IN_PROCESS_QC':
        ipqcSection(doc, snap, stages, cfg);
        break;
      case 'VISUAL_INSPECTION':
        visualSection(doc, snap, stages, cfg);
        break;
      case 'PACKING':
        packingSection(doc, snap, stages, cfg);
        break;
      case 'SEALING':
        sealingSection(doc, snap, stages, cfg);
        break;
      case 'STERILIZATION':
        sterilizationSection(doc, snap, stages, cfg);
        break;
      case 'LABELLING':
        labellingSection(doc, snap, stages, cfg);
        break;
      case 'STERILITY_TEST':
        labTestSection(
          doc,
          snap,
          'STERILITY TEST RECORD',
          stages.sterilityTest ?? {},
          str(snap.sterilitySop, 'SOP/QC/018'),
          'AS PER SOP NO.',
          cfg,
        );
        break;
      case 'BET_TEST':
        labTestSection(
          doc,
          snap,
          'BET TEST RECORD',
          stages.betTest ?? {},
          str(snap.betSop, 'SOP/QC/026'),
          'AS PER SOP NO.-',
          cfg,
        );
        break;
      case 'CONTROL_SAMPLE':
        controlSampleSection(doc, snap, stages, cfg);
        break;
      case 'LABEL_OF_PRODUCT':
        labelOfProductSection(doc, snap, cfg);
        break;
      case 'FINISHED_GOODS':
        finishedGoodsSection(doc, snap, stages, cfg);
        break;
      case 'DISPATCH':
        dispatchSection(doc, snap, dispatchRows, cfg);
        break;
      default:
        customSection(doc, snap, stages, key, cfg);
        break;
    }
  }

  doc.end();
  const count = ctx.pageNo;
  ctx = null;
  return count;
}

export async function renderBmrPdf(opts: {
  batch: IBatch;
  snap: Snap;
  stages: Record<string, Stage>;
  dispatches: Array<Record<string, unknown>>;
  out: Response;
  inline?: boolean;
}) {
  const { batch, snap, stages, dispatches, out, inline } = opts;
  const safeBatch = String(batch.batchNo || 'BMR').replace(/[^a-zA-Z0-9._-]+/g, '-');
  out.setHeader('Content-Type', 'application/pdf');
  out.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="BMR-${safeBatch}.pdf"`,
  );

  const total = await renderPass(batch, snap, stages, dispatches, null, false, 0);
  await renderPass(batch, snap, stages, dispatches, out, true, total);
}

export async function streamTemplateBmrPdf(batch: IBatch, res: Response) {
  const snap = (batch.processParamsSnapshot ?? {}) as Snap;
  const stages = (batch.stages ?? {}) as Record<string, Stage>;
  const dispatches = await Dispatch.find({ batchId: batch._id }).sort({ createdAt: 1 }).lean();
  await renderBmrPdf({ batch, snap, stages, dispatches, out: res });
}
