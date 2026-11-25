import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Dispatch } from '../models/Dispatch.js';
import { IBatch } from '../models/Batch.js';

/**
 * Template-driven BMR renderer (flow layout).
 * Used for batches whose processParamsSnapshot.docId exists — i.e. batches
 * created from a product-centric v2 template. Sections render per the
 * product's snapshot (raw materials, manufacturing steps, sealing modes,
 * optional packing/sealing, extra sections), so one generator covers all
 * products.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = { left: 42, right: 42, top: 152, bottom: 92 };
const CONTENT_W = PAGE_W - M.left - M.right;
const OUTER = { x: 24.5, y: 24.0, w: 546.25, h: 793.85 };
const BLACK = '#000000';

type Snap = Record<string, any>;
type Stage = Record<string, any>;

interface SectionCfg {
  title?: string;
  instructions?: string[];
}

/**
 * Resolve a section's per-template overrides. Returns null when the section is
 * disabled, `{}` when the template has no section config (defaults apply).
 */
function sectionConfig(snap: Snap, key: string): SectionCfg | null {
  const list =
    Array.isArray(snap.sections) && snap.sections.length > 0
      ? (snap.sections as Array<Record<string, unknown>>)
      : null;
  if (!list) return {};
  const found = list.find((item) => String(item?.key ?? '') === key);
  if (!found || found.enabled === false) return null;
  const title = found.title == null ? '' : String(found.title).trim();
  const instr = Array.isArray(found.instructions)
    ? (found.instructions as unknown[])
        .map((l) => String(l ?? '').trim())
        .filter(Boolean)
    : [];
  return {
    title: title || undefined,
    instructions: instr.length ? instr : undefined,
  };
}

/** Print order used when a template has no explicit section configuration. */
const DEFAULT_SECTION_ORDER = [
  'RAW_MATERIAL_QC',
  'RAW_MATERIAL_CONSUMPTION',
  'MANUFACTURING',
  'IN_PROCESS_QC',
  'VISUAL_INSPECTION',
  'PACKING',
  'SEALING',
  'STERILIZATION',
  'LABELLING',
  'STERILITY_TEST',
  'BET_TEST',
  'CONTROL_SAMPLE',
  'LABEL_OF_PRODUCT',
  'FINISHED_GOODS',
  'DISPATCH',
];

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

/** Print order for this snapshot: saved order first, then any missing defaults. */
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

function s(v: unknown, fallback = ''): string {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function d(v?: string | Date | null): string {
  if (!v) return '';
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB');
}

function sig(v: unknown): string {
  if (!v || typeof v !== 'object') return s(v);
  const x = v as { name?: string; employeeId?: string; signedAt?: string | Date };
  if (!x.name) return '';
  return `${x.name}${x.employeeId ? ` (${x.employeeId})` : ''}${
    x.signedAt ? ` @ ${d(x.signedAt)}` : ''
  }`;
}

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
    if (ctx.chrome) {
      drawChrome(doc, ctx.batch, ctx.snap, ctx.pageNo, ctx.totalPages);
    }
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
  if (doc.y + needed > bottomLimit()) {
    newPage(doc);
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string, size = 10) {
  ensureSpace(doc, 60);
  doc.moveDown(0.4);
  timesBold(doc, size);
  doc.text(text, M.left, doc.y, { width: CONTENT_W, align: 'center', underline: true });
  doc.x = M.left;
}

function instructions(doc: PDFKit.PDFDocument, title: string, lines: string[]) {
  timesBold(doc, 8);
  doc.text(title, M.left, doc.y, { width: CONTENT_W, align: 'center', underline: true });
  doc.x = M.left;
  times(doc, 7.6);
  for (const l of lines) {
    doc.text(l, M.left + 24, doc.y + 1, { width: CONTENT_W - 48 });
    doc.x = M.left;
  }
  doc.moveDown(0.3);
}

function clearanceLine(doc: PDFKit.PDFDocument, label = 'Checked by', verifiedBy?: unknown) {
  ensureSpace(doc, 30);
  timesBold(doc, 7.8);
  doc.text(`${label}:`, M.left + 24, doc.y, { width: 70 });
  times(doc, 7.8);
  doc.text(sig(verifiedBy), M.left + 96, doc.y, { width: 150, underline: true });
  timesBold(doc, 7.8);
  doc.text('Verified by:', M.left + 260, doc.y, { width: 70 });
  times(doc, 7.8);
  doc.text('', M.left + 330, doc.y, { width: 150, underline: true });
  doc.x = M.left;
  doc.moveDown(0.5);
}

interface Col {
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

function table(
  doc: PDFKit.PDFDocument,
  cols: Col[],
  rows: string[][],
  opts: { headerH?: number; minRowH?: number; cellSize?: number; headerSize?: number } = {},
) {
  const headerH = opts.headerH ?? 26;
  const minRowH = opts.minRowH ?? 24;
  const cellSize = opts.cellSize ?? 7.4;
  const headerSize = opts.headerSize ?? 7.2;
  const totalW = cols.reduce((a, c) => a + c.width, 0);
  const x = M.left;

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
  let cx = M.left;
  for (const p of pairs) {
    timesBold(doc, 7.8);
    doc.text(`${p.label}:`, cx, doc.y, { width: colW * 0.5 });
    times(doc, 7.8);
    doc.text(p.value, cx + colW * 0.5, doc.y, { width: colW * 0.5, underline: true });
    cx += colW;
  }
  doc.x = M.left;
  doc.y += 14;
}

function totalsLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  times(doc, 8);
  doc.text(`${label} ${value}`, M.left + 24, doc.y, { width: CONTENT_W - 48 });
  doc.x = M.left;
}

const MODE_LABEL: Record<string, string> = {
  paper: 'Paper Pouch',
  tyvek: 'Tyvek Pouch',
  blister: 'Blister Tray',
};

function drawChrome(
  doc: PDFKit.PDFDocument,
  batch: IBatch,
  snap: Snap,
  pageNo: number,
  totalPages: number,
) {
  rect(doc, OUTER.x, OUTER.y, OUTER.w, OUTER.h, 0.8);

  timesBold(doc, 10.2);
  doc.text('SURETECH MEDICAL INC.', 0, 37, { width: PAGE_W, align: 'center' });
  times(doc, 8.2);
  doc.text(
    '333 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063',
    0,
    51,
    { width: PAGE_W, align: 'center' },
  );
  timesBold(doc, 11.8);
  doc.text('BATCH MANUFACTURING RECORD', 0, 76, { width: PAGE_W, align: 'center' });

  timesBold(doc, 8.8);
  t(doc, 'Doc ID:', 49.6, 104, 50);
  times(doc, 8.8);
  t(doc, s(snap.docId), 88, 104, 100);
  times(doc, 8.8);
  t(doc, `Issue No.-${s(snap.bmrIssueNo, '01')}`, 49.6, 118, 130);
  t(
    doc,
    snap.bmrEffectiveDate ? `Effective Date :${s(snap.bmrEffectiveDate)}` : '',
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
  t(doc, 'PRODUCTION ENGG', 50.5, 758.2, 230);
  t(doc, 'QUALITY ANALYSIS', 303, 758.2, 230);
}

function productBlock(doc: PDFKit.PDFDocument, batch: IBatch) {
  const x = M.left;
  const y = M.top;
  const h = 118;
  rect(doc, x, y, CONTENT_W, h, 0.65);
  line(doc, x, y + 40, x + CONTENT_W, y + 40);
  line(doc, x, y + 79, x + CONTENT_W, y + 79);
  line(doc, x + CONTENT_W / 2, y + 40, x + CONTENT_W / 2, y + h);

  timesBold(doc, 9);
  doc.text(`PRODUCT NAME: ${s(batch.productName)}`, x + 6, y + 6, { width: CONTENT_W - 12 });
  doc.text('CATALOGUE NO. :', x + 6, y + 24, { width: 110 });
  times(doc, 9);
  t(doc, s(batch.catalogueNo), x + 110, y + 24, 130);

  timesBold(doc, 9);
  t(doc, 'BATCH NO. :', x + 6, y + 46, 85);
  t(doc, 'MFG./ STR DATE:', x + CONTENT_W / 2 + 6, y + 46, 100);
  times(doc, 9);
  t(doc, s(batch.batchNo), x + 80, y + 46, 160);
  t(doc, d(batch.manufacturingDate), x + CONTENT_W / 2 + 110, y + 46, 110);

  timesBold(doc, 9);
  t(doc, 'BATCH SIZE :', x + 6, y + 86, 85);
  t(doc, 'EXPIRY DATE:', x + CONTENT_W / 2 + 6, y + 86, 100);
  times(doc, 9);
  t(doc, s(batch.batchSize), x + 80, y + 86, 160);
  t(doc, d(batch.expiryDate), x + CONTENT_W / 2 + 110, y + 86, 110);

  doc.y = y + h;
  doc.x = M.left;
}

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

function rmQcSection(doc: PDFKit.PDFDocument, stages: Record<string, Stage>, cfg: SectionCfg = {}) {
  const qc = stages.rawMaterialQc ?? {};
  const checks = Array.isArray(qc.checks) ? qc.checks : [];
  if (checks.length === 0) return;

  sectionTitle(doc, cfg.title || 'QUALITY CHECKING OF RAW MATERIAL');
  instructions(
    doc,
    'GENERAL INSTRUCTION FOR QUALITY CHECKING',
    cfg.instructions ?? RM_QC_INSTRUCTIONS,
  );
  table(
    doc,
    [
      { label: 'Sr. No.', width: 30 },
      { label: 'PROCESS', width: 116 },
      { label: 'DONE ON', width: 48, align: 'center' },
      { label: 'START TIME', width: 46, align: 'center' },
      { label: 'END TIME', width: 46, align: 'center' },
      { label: 'OBSERVATION / NOTE', width: 76 },
      { label: 'RESULT', width: 40, align: 'center' },
      { label: 'DONE BY', width: 53 },
      { label: 'CHECKED BY', width: 56 },
    ],
    checks.map((c: Stage, i: number) => [
      `${String(i + 1).padStart(2, '0')}.`,
      s(c.process),
      d(c.processDate),
      s(c.startTime),
      s(c.endTime),
      s(c.observation),
      s(c.result).toUpperCase(),
      sig(c.doneBy),
      sig(c.checkedBy),
    ]),
  );
  fieldRow(doc, [
    { label: 'Overall Result', value: s((qc as Stage).overallResult, '') },
    { label: 'Approved By', value: sig((qc as Stage).approvedBy) },
  ]);
}

function consumptionSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  cfg: SectionCfg = {},
) {
  const cons = stages.rawMaterialConsumption ?? {};
  const lines = Array.isArray(cons.lines) ? cons.lines : [];

  sectionTitle(doc, cfg.title || 'RAW MATERIAL CONSUMPTION RECORD');
  instructions(
    doc,
    'GENERAL INSTRUCTION FOR ISSUE OF RAW MATERIAL',
    cfg.instructions ?? FIFO_INSTRUCTIONS,
  );

  const rows: string[][] = lines.map((l: Stage, i: number) => [
    `${String(i + 1).padStart(2, '0')}.`,
    s(l.rawMaterialName),
    s(l.supplierBatchNo),
    d(l.qualityCheckedDate),
    s(l.quantityWithdrawn),
    s(l.requirementSlipNo),
    sig(l.doneBy),
    sig(l.checkedBy),
  ]);
  for (let i = rows.length; i < Math.max(3, lines.length + 1); i++) {
    rows.push([`${String(i + 1).padStart(2, '0')}.`, '', '', '', '', '', '', '']);
  }

  table(
    doc,
    [
      { label: 'Sr. No.', width: 28 },
      { label: 'RAW MATERIAL NAME', width: 138 },
      { label: 'BATCH NO', width: 56 },
      { label: 'QUALITY CHECKED ON', width: 60, align: 'center' },
      { label: 'QUANTITY', width: 52, align: 'center' },
      { label: 'REQ. SLIP NO', width: 48, align: 'center' },
      { label: 'ISSUED BY', width: 62 },
      { label: 'CHECKED BY', width: 67 },
    ],
    rows,
  );
}

function manufacturingSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  snap: Snap,
  cfg: SectionCfg = {},
) {
  const mfg = stages.manufacturing ?? {};

  sectionTitle(doc, cfg.title || 'MANUFACTURING PROCESS');
  const mfgInstructions =
    cfg.instructions ??
    (s(snap.manufacturingInstruction) ? [s(snap.manufacturingInstruction)] : MFG_INSTRUCTIONS);
  instructions(doc, 'GENERAL INSTRUCTION FOR MANUFACTURING PROCESS', mfgInstructions);
  clearanceLine(doc, 'Checked by', (mfg as Stage).verifiedBy);

  const steps = Array.isArray((mfg as Stage).steps)
    ? ((mfg as Stage).steps as Stage[])
    : [];

  const rows: string[][] = steps.map((st, i) => [
    `${String(i + 1).padStart(2, '0')}.`,
    s(st.step),
    d(st.processDate),
    s(st.startTime),
    s(st.endTime),
    s(st.observation),
    sig(st.doneBy ?? (mfg as Stage).operator),
  ]);
  if (rows.length === 0) {
    rows.push([
      '01.',
      s((mfg as Stage).process),
      d((mfg as Stage).processDate),
      s((mfg as Stage).startTime),
      s((mfg as Stage).endTime),
      s((mfg as Stage).observation),
      sig((mfg as Stage).operator ?? (mfg as Stage).doneBy),
    ]);
  }

  table(
    doc,
    [
      { label: 'Sr. No.', width: 30 },
      { label: 'PROCESS / STEP', width: 180 },
      { label: 'DONE ON', width: 50, align: 'center' },
      { label: 'START TIME', width: 48, align: 'center' },
      { label: 'END TIME', width: 48, align: 'center' },
      { label: 'OBSERVATION', width: 92 },
      { label: 'DONE BY', width: 63 },
    ],
    rows,
  );

  totalsLine(doc, 'Total quantity manufactured:', s((mfg as Stage).totalManufactured, '________'));
  totalsLine(
    doc,
    'Total quantity rejected during manufacturing process:',
    s((mfg as Stage).totalRejected, '________'),
  );
  totalsLine(doc, 'Verified by:', sig((mfg as Stage).verifiedBy) || '________');
}

function ipqcSection(doc: PDFKit.PDFDocument, stages: Record<string, Stage>, cfg: SectionCfg = {}) {
  const ip = stages.inProcessQc ?? {};
  const checks = Array.isArray((ip as Stage).checks) ? ((ip as Stage).checks as Stage[]) : [];
  if (checks.length === 0) return;

  sectionTitle(doc, cfg.title || 'IN-PROCESS QUALITY CHECKING');
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS FOR IN-PROCESS QUALITY CHECKING', cfg.instructions);
  }
  table(
    doc,
    [
      { label: 'Sr. No.', width: 30 },
      { label: 'CHECK', width: 190 },
      { label: 'RESULT', width: 48, align: 'center' },
      { label: 'DONE ON', width: 52, align: 'center' },
      { label: 'OBSERVATION', width: 108 },
      { label: 'DONE BY', width: 83 },
    ],
    checks.map((c, i) => [
      `${String(i + 1).padStart(2, '0')}.`,
      s(c.check),
      s(c.result).toUpperCase(),
      d(c.doneOn ?? (ip as Stage).date),
      s(c.observation),
      sig(c.doneBy ?? (ip as Stage).qcCheckedBy),
    ]),
  );
  fieldRow(doc, [
    { label: 'Overall Result', value: s((ip as Stage).result, '') },
    { label: 'Checked By', value: sig((ip as Stage).qcCheckedBy ?? (ip as Stage).checkedBy) },
  ]);
}

function visualSection(doc: PDFKit.PDFDocument, stages: Record<string, Stage>, cfg: SectionCfg = {}) {
  const vis = stages.visualInspection ?? {};
  sectionTitle(doc, cfg.title || 'VISUAL INSPECTION FOR DUST / FOREIGN PARTICLES');
  instructions(
    doc,
    'GENERAL INSTRUCTIONS FOR VISUAL INSPECTION',
    cfg.instructions ?? [
      '1. Carry out visual inspection process as specified in the SOP.',
      '2. Ensure removal of previous lot material before start of visual inspection process for the next lot.',
    ],
  );
  clearanceLine(doc, 'Checked by', (vis as Stage).verifiedBy);
  table(
    doc,
    [
      { label: 'Sr. No.', width: 30 },
      { label: 'DATE OF VISUAL INSPECTION', width: 78, align: 'center' },
      { label: 'TOTAL UNITS CHECKED', width: 70, align: 'center' },
      { label: 'UNITS WITH PARTICLES FOUND', width: 82, align: 'center' },
      { label: 'TOTAL GOOD UNITS', width: 66, align: 'center' },
      { label: 'DONE BY', width: 88 },
      { label: 'CHECKED BY', width: 97 },
    ],
    [
      [
        '01.',
        d((vis as Stage).inspectionDate),
        s((vis as Stage).unitsChecked),
        s((vis as Stage).particlesFound),
        s((vis as Stage).goodUnits ?? (vis as Stage).totalGood),
        sig((vis as Stage).doneBy),
        sig((vis as Stage).checkedBy),
      ],
    ],
  );
}

function packingSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  snap: Snap,
  cfg: SectionCfg = {},
) {
  const pack = stages.packing ?? {};
  if ((pack as Stage).lockState === 'SKIPPED') return;

  sectionTitle(doc, cfg.title || 'PACKING RECORD');
  instructions(
    doc,
    'GENERAL INSTRUCTIONS FOR PACKING PROCESS',
    cfg.instructions ?? PACKING_INSTRUCTIONS,
  );
  clearanceLine(doc, 'Checked by', (pack as Stage).verifiedBy);

  const pouchLabel =
    s(snap.packingType) === 'blisterTray' ? 'QTY OF POUCH/TRAY TAKEN' : 'QUANTITY OF POUCH TAKEN';
  table(
    doc,
    [
      { label: 'Sr. No.', width: 30 },
      { label: 'DATE OF PACKING', width: 72, align: 'center' },
      { label: pouchLabel, width: 78, align: 'center' },
      { label: 'QUANTITY OF DEVICE PACKED', width: 82, align: 'center' },
      { label: 'NO. OF POUCHES DAMAGED', width: 76, align: 'center' },
      { label: 'DONE BY', width: 82 },
      { label: 'CHECKED BY', width: 91 },
    ],
    [
      [
        '01.',
        d((pack as Stage).packingDate),
        s((pack as Stage).pouchesTaken),
        s((pack as Stage).devicesPacked),
        s((pack as Stage).pouchesDamaged),
        sig((pack as Stage).operator ?? (pack as Stage).doneBy),
        sig((pack as Stage).checkedBy),
      ],
    ],
  );
}

function sealingSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  snap: Snap,
  cfg: SectionCfg = {},
) {
  const seal = stages.sealing ?? {};
  if ((seal as Stage).lockState === 'SKIPPED') return;

  sectionTitle(doc, cfg.title || 'SEALING RECORD');

  const modes = Array.isArray((seal as Stage).modes) ? ((seal as Stage).modes as Stage[]) : [];
  const lines: string[] = modes.map(
    (m, i) =>
      `${i + 1}. At ${s(m.configuredTemperatureC, '200')}°C For ${
        MODE_LABEL[s(m.mode)] ?? s(m.mode)
      }, Operation done As Per ${s(m.sopRef)}`,
  );
  lines.push(`${lines.length + 1}. Ensure removal of previous lot material before start of sealing process for the next lot.`);
  instructions(
    doc,
    'GENERAL INSTRUCTIONS FOR SEALING PROCESS',
    cfg.instructions ?? lines,
  );

  clearanceLine(doc, 'Checked by', (seal as Stage).verifiedBy);

  const rows: string[][] =
    modes.length > 0
      ? modes.map((m, i) => [
          `${String(i + 1).padStart(2, '0')}.`,
          MODE_LABEL[s(m.mode)] ?? s(m.mode),
          d(m.sealingDate),
          `${s(m.configuredTemperatureC)}°C`,
          s(m.actualTemperatureC) ? `${s(m.actualTemperatureC)}°C` : '',
          s(m.devicesSealed),
          s(m.damages ?? m.totalDamages),
          sig(m.doneBy ?? (seal as Stage).operator),
          sig(m.checkedBy ?? (seal as Stage).checkedBy),
        ])
      : [
          [
            '01.',
            '',
            d((seal as Stage).sealingDate),
            `${s((seal as Stage).configuredTemperatureC)}°C`,
            s((seal as Stage).actualTemperatureC) ? `${s((seal as Stage).actualTemperatureC)}°C` : '',
            s((seal as Stage).devicesSealed),
            s((seal as Stage).totalDamages ?? (seal as Stage).damages),
            sig((seal as Stage).operator ?? (seal as Stage).doneBy),
            sig((seal as Stage).checkedBy),
          ],
        ];

  table(
    doc,
    [
      { label: 'Sr. No.', width: 28 },
      { label: 'MODE', width: 58 },
      { label: 'DATE OF SEALING', width: 62, align: 'center' },
      { label: 'SET TEMP', width: 46, align: 'center' },
      { label: 'ACTUAL TEMP', width: 52, align: 'center' },
      { label: 'DEVICES SEALED', width: 62, align: 'center' },
      { label: 'DAMAGES', width: 52, align: 'center' },
      { label: 'DONE BY', width: 72 },
      { label: 'CHECKED BY', width: 79 },
    ],
    rows,
  );
}

function sterilizationSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  snap: Snap,
  cfg: SectionCfg = {},
) {
  const ster = stages.sterilization ?? {};
  const sp = snap.sterilizationParams ?? {};

  sectionTitle(doc, cfg.title || 'STERILIZATION RECORD');
  instructions(
    doc,
    'GENERAL INSTRUCTIONS FOR STERILIZATION PROCESS',
    cfg.instructions ?? STERILE_INSTRUCTIONS,
  );
  clearanceLine(doc, 'Checked by', (ster as Stage).verifiedBy);

  times(doc, 8);
  doc.text('ETO sterilization process parameters', M.left + 24, doc.y, { width: 250 });
  doc.x = M.left;
  timesBold(doc, 8);
  doc.text(
    `ETO STERILIZATION AT ${s(
      (ster as Stage).configuredTemperatureC ?? sp.temperatureC,
      '55',
    )}°C, for ${s((ster as Stage).requiredDurationHours ?? sp.durationHours, '4')} hrs`,
    M.left + 24,
    doc.y + 2,
    { width: 320 },
  );
  doc.text(
    `${s((ster as Stage).etoCartridgeGrams ?? sp.etoCartridgeGrams, '40')}gm ETO gas cartridge used per lot`,
    M.left + 24,
    doc.y + 14,
    { width: 320 },
  );
  times(doc, 8);
  doc.text(
    `OPERATION OF ETO MACHINE AS PER ${s((ster as Stage).sopRef ?? sp.sopRef, 'SOP/MF/008')}`,
    M.left + 24,
    doc.y + 28,
    { width: 350 },
  );
  doc.x = M.left;
  doc.moveDown(1.6);

  table(
    doc,
    [
      { label: 'DATE', width: 62, align: 'center' },
      { label: 'QUANTITY', width: 70, align: 'center' },
      { label: 'START TIME', width: 68, align: 'center' },
      { label: 'END TIME', width: 68, align: 'center' },
      { label: 'OPERATOR', width: 112 },
      { label: 'CHECKED BY', width: 131 },
    ],
    [
      [
        d((ster as Stage).startDate ?? (ster as Stage).date),
        s((ster as Stage).quantity),
        s((ster as Stage).startTime),
        s((ster as Stage).endTime),
        sig((ster as Stage).operator),
        sig((ster as Stage).checkedBy),
      ],
    ],
  );

  sectionTitle(doc, 'ETO CARTRIDGE DETAILS', 8.6);
  table(
    doc,
    [
      { label: 'BATCH NO', width: 170 },
      { label: 'RECEIVED ON', width: 170, align: 'center' },
      { label: 'EXPIRY DATE', width: 171, align: 'center' },
    ],
    [
      [
        s((ster as Stage).cartridgeBatchNo),
        d((ster as Stage).cartridgeReceivedOn),
        d((ster as Stage).cartridgeExpiryDate),
      ],
    ],
  );
}

function labellingSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  cfg: SectionCfg = {},
) {
  const lab = stages.labelling ?? {};

  sectionTitle(doc, cfg.title || 'BATCH LABELLING RECORD');
  instructions(
    doc,
    'GENERAL INSTRUCTIONS FOR LABELLING PROCESS',
    cfg.instructions ?? LABELLING_INSTRUCTIONS,
  );
  clearanceLine(doc, 'Checked by', (lab as Stage).verifiedBy);

  sectionTitle(doc, 'RECORD OF LABELLING ACTIVITY', 8.8);
  fieldRow(doc, [
    { label: 'Labels printed by', value: sig((lab as Stage).printedBy) },
    { label: 'No. of labels printed', value: s((lab as Stage).labelsPrinted) },
  ]);
  fieldRow(doc, [
    { label: 'No. of devices labelled', value: s((lab as Stage).devicesLabelled) },
    { label: 'No. of labels destroyed', value: s((lab as Stage).labelsDestroyed) },
  ]);
  fieldRow(doc, [
    { label: 'Done on', value: d((lab as Stage).doneOn) },
    { label: 'Checked by', value: sig((lab as Stage).checkedBy) },
  ]);
}

function labTestSection(
  doc: PDFKit.PDFDocument,
  title: string,
  stage: Stage,
  fallbackSop: string,
  cfg: SectionCfg = {},
) {
  sectionTitle(doc, cfg.title || title);
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS', cfg.instructions);
  }
  fieldRow(doc, [
    { label: 'As per SOP No.', value: s(stage.sopRef, fallbackSop) },
    { label: 'Sample quantity', value: s(stage.sampleQuantity) },
  ]);
  fieldRow(doc, [
    { label: 'Done on', value: d(stage.testDate ?? stage.doneOn) },
    { label: 'Report No.', value: s(stage.reportNo) },
  ]);
  fieldRow(doc, [
    { label: 'Result', value: s(stage.result) },
    { label: 'Checked by', value: sig(stage.checkedBy) },
  ]);
  fieldRow(doc, [
    { label: 'Start time', value: s(stage.startTime) },
    { label: 'End time', value: s(stage.endTime) },
  ]);
}

function controlSampleSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  cfg: SectionCfg = {},
) {
  const cs = stages.controlSample ?? {};
  sectionTitle(doc, cfg.title || 'CONTROL SAMPLE RECORD');
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS', cfg.instructions);
  }
  fieldRow(doc, [
    { label: 'Sample retained', value: s((cs as Stage).sampleRetained, 'YES') },
    { label: 'Done by', value: sig((cs as Stage).doneBy) },
  ]);
  fieldRow(doc, [
    { label: 'Sample quantity', value: s((cs as Stage).sampleQuantity) },
    { label: 'Checked by', value: sig((cs as Stage).checkedBy) },
  ]);
}

function labelOfProductSection(doc: PDFKit.PDFDocument, cfg: SectionCfg = {}) {
  sectionTitle(doc, cfg.title || 'LABEL OF THE PRODUCT');
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS', cfg.instructions);
  }
  ensureSpace(doc, 120);
  const y = doc.y;
  rect(doc, M.left + 20, y, CONTENT_W - 40, 100, 0.6);
  times(doc, 8);
  doc.text('(Affix product label here)', M.left, y + 42, {
    width: CONTENT_W,
    align: 'center',
  });
  doc.x = M.left;
  doc.y = y + 100;
}

function finishedGoodsSection(
  doc: PDFKit.PDFDocument,
  stages: Record<string, Stage>,
  cfg: SectionCfg = {},
) {
  const fg = stages.finishedGoods ?? {};
  sectionTitle(doc, cfg.title || 'BATCH PACKING RECORD');
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS', cfg.instructions);
  }
  timesBold(doc, 8);
  doc.text('AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS', M.left, doc.y, {
    width: CONTENT_W,
    align: 'center',
  });
  doc.x = M.left;
  doc.moveDown(0.6);
  fieldRow(doc, [
    { label: 'No. of finished products', value: s((fg as Stage).quantity) },
    { label: 'Date of transfer to F.G', value: d((fg as Stage).transferDate) },
  ]);
  fieldRow(doc, [
    { label: 'Transfer note no. and date', value: s((fg as Stage).transferNoteNo ?? (fg as Stage).transferNote) },
    { label: 'Transferred by', value: sig((fg as Stage).transferredBy) },
  ]);
}

function dispatchSection(
  doc: PDFKit.PDFDocument,
  dispatchRows: Array<Record<string, unknown>>,
  cfg: SectionCfg = {},
) {
  const rows = dispatchRows.map((r) => [
    s(r.customerName),
    s(r.billNo),
    d(r.createdAt as string),
    s(r.quantity),
  ]);
  const targetRows = Math.max(4, rows.length + 1);
  for (let i = rows.length; i < targetRows; i++) {
    rows.push(['', '', '', '']);
  }
  // Keep title + header + every row + signatory together so the table never
  // leaves a lone header row stranded at the bottom of a page.
  ensureSpace(doc, 60 + 26 + rows.length * 24 + 50);

  sectionTitle(doc, cfg.title || 'MATERIAL DISPATCH RECORD');
  if (cfg.instructions?.length) {
    instructions(doc, 'GENERAL INSTRUCTIONS', cfg.instructions);
  }
  table(
    doc,
    [
      { label: 'NAME OF CUSTOMER', width: 220 },
      { label: 'BILL NO.', width: 90 },
      { label: 'DATE OF DISPATCH', width: 100, align: 'center' },
      { label: 'QTY DISPATCHED', width: 101, align: 'center' },
    ],
    rows,
  );

  ensureSpace(doc, 50);
  timesBold(doc, 8.6);
  doc.text('Authorized Signatory', M.left, doc.y + 10, { width: 220, align: 'center' });
  doc.text('(PRODUCTION ENGG)', M.left, doc.y + 24, { width: 220, align: 'center' });
  doc.x = M.left;
}

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
        rmQcSection(doc, stages, cfg);
        break;
      case 'RAW_MATERIAL_CONSUMPTION':
        consumptionSection(doc, stages, cfg);
        break;
      case 'MANUFACTURING':
        manufacturingSection(doc, stages, snap, cfg);
        break;
      case 'IN_PROCESS_QC':
        ipqcSection(doc, stages, cfg);
        break;
      case 'VISUAL_INSPECTION':
        visualSection(doc, stages, cfg);
        break;
      case 'PACKING':
        packingSection(doc, stages, snap, cfg);
        break;
      case 'SEALING':
        sealingSection(doc, stages, snap, cfg);
        break;
      case 'STERILIZATION':
        sterilizationSection(doc, stages, snap, cfg);
        break;
      case 'LABELLING':
        labellingSection(doc, stages, cfg);
        break;
      case 'STERILITY_TEST':
        labTestSection(
          doc,
          'STERILITY TEST RECORD',
          stages.sterilityTest ?? {},
          s(snap.sterilitySop, 'SOP/QC/018'),
          cfg,
        );
        break;
      case 'BET_TEST':
        labTestSection(
          doc,
          'BET TEST RECORD',
          stages.betTest ?? {},
          s(snap.betSop, 'SOP/QC/026'),
          cfg,
        );
        break;
      case 'CONTROL_SAMPLE':
        controlSampleSection(doc, stages, cfg);
        break;
      case 'LABEL_OF_PRODUCT':
        labelOfProductSection(doc, cfg);
        break;
      case 'FINISHED_GOODS':
        finishedGoodsSection(doc, stages, cfg);
        break;
      case 'DISPATCH':
        dispatchSection(doc, dispatchRows, cfg);
        break;
      default:
        break;
    }
  }

  doc.end();
  const count = ctx.pageNo;
  ctx = null;
  return count;
}

export async function streamTemplateBmrPdf(batch: IBatch, res: Response) {
  const snap = (batch.processParamsSnapshot ?? {}) as Snap;
  const stages = (batch.stages ?? {}) as Record<string, Stage>;
  const dispatches = await Dispatch.find({ batchId: batch._id }).sort({ createdAt: 1 }).lean();

  const safeBatch = String(batch.batchNo || 'BMR').replace(/[^a-zA-Z0-9._-]+/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="BMR-${safeBatch}.pdf"`);

  const total = await renderPass(batch, snap, stages, dispatches, null, false, 0);
  await renderPass(batch, snap, stages, dispatches, res, true, total);
}
