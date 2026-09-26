import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { IBatch } from '../models/Batch.js';

/**
 * Introducer Needle BMR PDF
 * ------------------------------------------------------------
 * This renderer intentionally uses fixed A4 coordinates instead of
 * PDFKit flow layout so the output follows the supplied reference:
 *
 * - A4 portrait
 * - thin black outer border
 * - black/white tables
 * - Times-style document heading
 * - Helvetica-style form labels
 * - centered underlined section headings
 * - five fixed pages
 * - bottom Production Chemist / Sign box on every page
 *
 * Reference layout: SURETECH MEDICAL INC.
 * 3/33 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063
 * Doc ID: SU/BMR/002
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const BORDER_X = 24;
const BORDER_Y = 24;
const BORDER_W = PAGE_W - BORDER_X * 2;
const BORDER_H = PAGE_H - BORDER_Y * 2;

const CONTENT_X = 50;
const CONTENT_W = PAGE_W - CONTENT_X * 2;

const TABLE_LINE = '#777777';
const BLACK = '#000000';
const WHITE = '#ffffff';

type Align = 'left' | 'center' | 'right';

type TableColumn = {
  header: string;
  width: number;
  align?: Align;
};

type TableRow = {
  cells: unknown[];
  height?: number;
  bold?: boolean;
};

function textValue(value: unknown, fallback = ''): string {
  if (value === undefined || value === null || value === '') return fallback;
  // Data may contain the two literal characters \\n instead of an actual line break.
  return String(value).replace(/\\n/g, '\n');
}

function dash(value: unknown): string {
  return textValue(value, '—');
}

function fmtDate(value?: Date | string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

function signature(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const s = value as {
    name?: string;
    employeeId?: string;
    signedAt?: string | Date;
  };

  if (!s.name) return '';

  return `${s.name}${s.employeeId ? ` (${s.employeeId})` : ''}${
    s.signedAt ? ` @ ${fmtDate(s.signedAt)}` : ''
  }`;
}

function fontNormal(doc: PDFKit.PDFDocument, size = 9) {
  doc.font('Helvetica').fontSize(size).fillColor(BLACK);
}

function fontBold(doc: PDFKit.PDFDocument, size = 9) {
  doc.font('Helvetica-Bold').fontSize(size).fillColor(BLACK);
}

function fontTimesBold(doc: PDFKit.PDFDocument, size = 12) {
  doc.font('Times-Bold').fontSize(size).fillColor(BLACK);
}

function drawOuterBorder(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.strokeColor(BLACK).lineWidth(0.8);
  doc.rect(BORDER_X, BORDER_Y, BORDER_W, BORDER_H).stroke();
  doc.restore();
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  pageNo: number,
) {
  // Company
  fontTimesBold(doc, 12);
  doc.text('SURETECH MEDICAL INC.', 0, 39, {
    width: PAGE_W,
    align: 'center',
  });

  fontTimesBold(doc, 9);
  doc.text(
    '3/33 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063',
    0,
    56,
    {
      width: PAGE_W,
      align: 'center',
    },
  );

  fontTimesBold(doc, 14);
  doc.text('BATCH MANUFACTURING RECORD', 0, 78, {
    width: PAGE_W,
    align: 'center',
  });

  fontTimesBold(doc, 11);
  doc.text('Doc ID:', 50, 109);
  fontNormal(doc, 11);
  doc.text('SU/BMR/002', 87, 109);

  fontTimesBold(doc, 11);
  doc.text(`Page ${pageNo} of 5`, 0, 109, {
    width: PAGE_W - 50,
    align: 'right',
  });
}

function beginPage(doc: PDFKit.PDFDocument, pageNo: number) {
  if (pageNo > 1) doc.addPage({ size: 'A4', margin: 0 });

  doc.x = CONTENT_X;
  doc.y = 130;

  drawOuterBorder(doc);
  drawHeader(doc, pageNo);
}

function sectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
  fontSize = 10,
) {
  fontBold(doc, fontSize);
  doc.text(title, CONTENT_X, y, {
    width: CONTENT_W,
    align: 'center',
    underline: true,
  });
}

function centeredNote(
  doc: PDFKit.PDFDocument,
  value: string,
  y: number,
  fontSize = 9,
) {
  fontBold(doc, fontSize);
  doc.text(value, CONTENT_X, y, {
    width: CONTENT_W,
    align: 'center',
  });
}

/**
 * Generic fixed-coordinate table.
 * Header is white, borders are thin grey/black, and no colored fill is used.
 */
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  columns: TableColumn[],
  rows: TableRow[],
  headerHeight = 42,
  bodyDefaultHeight = 38,
) {
  const totalW = columns.reduce((sum, c) => sum + c.width, 0);

  const drawCellText = (
    value: unknown,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
    bold: boolean,
    size: number,
  ) => {
    const content = textValue(value);
    if (!content) return;

    if (bold) fontBold(doc, size);
    else fontNormal(doc, size);

    const padding = 4;
    const textW = Math.max(1, cellW - padding * 2);
    const textH = doc.heightOfString(content, {
      width: textW,
      lineGap: 1.2,
    });

    // True vertical centering + horizontal centering inside every cell.
    const drawH = Math.min(textH, cellH - 4);
    const textY = cellY + Math.max(2, (cellH - drawH) / 2);

    doc.text(content, cellX + padding, textY, {
      width: textW,
      height: cellH - 4,
      align: 'center',
      lineGap: 1.2,
    });
  };

  // Header background is white.
  doc.save();
  doc.fillColor(WHITE);
  doc.rect(x, y, totalW, headerHeight).fill();
  doc.restore();

  let cx = x;
  columns.forEach((col) => {
    drawCellText(col.header, cx, y, col.width, headerHeight, true, 8.5);
    cx += col.width;
  });

  // Header borders.
  doc.save();
  doc.strokeColor(TABLE_LINE).lineWidth(0.55);
  doc.rect(x, y, totalW, headerHeight).stroke();
  cx = x;
  columns.forEach((col, index) => {
    cx += col.width;
    if (index < columns.length - 1) {
      doc.moveTo(cx, y).lineTo(cx, y + headerHeight).stroke();
    }
  });
  doc.restore();

  let cy = y + headerHeight;

  rows.forEach((row) => {
    const rowH = row.height ?? bodyDefaultHeight;

    doc.save();
    doc.fillColor(WHITE);
    doc.rect(x, cy, totalW, rowH).fill();
    doc.strokeColor(TABLE_LINE).lineWidth(0.55);
    doc.rect(x, cy, totalW, rowH).stroke();

    let cellX = x;
    row.cells.forEach((value, index) => {
      const col = columns[index];
      if (!col) return;

      drawCellText(value, cellX, cy, col.width, rowH, !!row.bold, 8.5);
      cellX += col.width;

      if (index < columns.length - 1) {
        doc.moveTo(cellX, cy).lineTo(cellX, cy + rowH).stroke();
      }
    });

    doc.restore();
    cy += rowH;
  });

  return cy;
}

function drawTwoColumnFields(
  doc: PDFKit.PDFDocument,
  fields: Array<{
    left: string;
    leftValue?: unknown;
    right: string;
    rightValue?: unknown;
  }>,
  x: number,
  y: number,
  rowHeight = 30,
) {
  // The reference pages visually have no boxes here, but using an invisible
  // 4-column grid keeps labels/values aligned and prevents collisions.
  const cols = [145, 115, 150, 85];
  const totalW = cols.reduce((a, b) => a + b, 0);

  fields.forEach((field, i) => {
    const yy = y + i * rowHeight;
    const values = [field.left, field.leftValue, field.right, field.rightValue];
    let xx = x;

    values.forEach((value, j) => {
      const w = cols[j];
      const isLabel = j === 0 || j === 2;
      const content = textValue(value);
      if (content) {
        if (isLabel) fontBold(doc, 8.5);
        else fontNormal(doc, 8.5);

        const pad = 3;
        const textW = w - pad * 2;
        const textH = doc.heightOfString(content, { width: textW, lineGap: 1.2 });
        const textY = yy + Math.max(1, (rowHeight - Math.min(textH, rowHeight - 2)) / 2);

        doc.text(content, xx + pad, textY, {
          width: textW,
          height: rowHeight - 2,
          align: 'center',
          lineGap: 1.2,
        });
      }
      xx += w;
    });
  });
}

function drawProductBlock(
  doc: PDFKit.PDFDocument,
  batch: IBatch,
) {
  const x = CONTENT_X;
  const y = 138;
  const w = CONTENT_W;
  const h = 128;

  doc.save();
  doc.strokeColor(BLACK).lineWidth(0.7);
  doc.rect(x, y, w, h).stroke();

  // Horizontal split after first product/category row.
  doc.moveTo(x, y + 61).lineTo(x + w, y + 61).stroke();

  // Vertical split in lower section.
  doc.moveTo(x + w / 2, y + 61).lineTo(x + w / 2, y + h).stroke();
  doc.restore();

  fontBold(doc, 8.8);
  doc.text(
    `PRODUCT NAME: ${textValue(batch.productName, 'INTRODUCER NEEDLE.')}`,
    x + 6,
    y + 6,
  );

  fontBold(doc, 8.8);
  doc.text('CATALOGUE NO. :', x + 6, y + 38);
  fontNormal(doc, 8.8);
  doc.text(textValue(batch.catalogueNo), x + 105, y + 38);

  fontBold(doc, 8.8);
  doc.text('BATCH NO. :', x + 6, y + 72);
  fontNormal(doc, 8.8);
  doc.text(textValue(batch.batchNo), x + 75, y + 72);

  fontBold(doc, 8.8);
  doc.text('MFG./ STR DATE:', x + w / 2 + 6, y + 72);
  fontNormal(doc, 8.8);
  doc.text(fmtDate(batch.manufacturingDate), x + w / 2 + 105, y + 72);

  fontBold(doc, 8.8);
  doc.text('BATCH SIZE :', x + 6, y + 102);
  fontNormal(doc, 8.8);
  doc.text(textValue(batch.batchSize), x + 80, y + 102);

  fontBold(doc, 8.8);
  doc.text('EXPIRY DATE:', x + w / 2 + 6, y + 102);
  fontNormal(doc, 8.8);
  doc.text(fmtDate(batch.expiryDate), x + w / 2 + 100, y + 102);
}

function drawSignBox(doc: PDFKit.PDFDocument) {
  const x = 41;
  const y = 763;
  const w = PAGE_W - 82;
  const h = 29;
  const split = x + w / 2;

  doc.save();
  doc.strokeColor(BLACK).lineWidth(0.7);
  doc.rect(x, y, w, h).stroke();
  doc.moveTo(split, y).lineTo(split, y + h).stroke();
  doc.restore();

  fontTimesBold(doc, 10);
  doc.text('PRODUCTION CHEMIST', x + 6, y + 7);
  doc.text('SIGN:', split + 6, y + 7);
}

function rawMaterialRows(stages: Record<string, any>): TableRow[] {
  const rmQc = stages.rawMaterialQc ?? {};
  const checks = Array.isArray(rmQc.checks)
    ? rmQc.checks
    : [];

  const defaults = [
    'Hub checking',
    'Bevel checking',
    'Guide Wire passing',
    'Visual Inspection: -\nFor Dust, Burrs and\nForeign Particles.',
  ];

  const rows: TableRow[] = defaults.map((name, i) => {
    const c = checks[i] ?? {};
    return {
      cells: [
        `${String(i + 1).padStart(2, '0')}.`,
        textValue(c.process, name),
        fmtDate(c.processDate),
        textValue(c.startTime),
        textValue(c.endTime),
        textValue(c.observation),
        signature(c.doneBy),
        signature(c.checkedBy),
      ],
      height: i === 3 ? 63 : 38,
      bold: true,
    };
  });

  // Reference has one additional blank row.
  rows.push({
    cells: ['', '', '', '', '', '', '', ''],
    height: 28,
  });

  return rows;
}

function consumptionRows(stages: Record<string, any>): TableRow[] {
  const cons = stages.rawMaterialConsumption ?? {};
  const lines = Array.isArray(cons.lines) ? cons.lines : [];

  const rows: TableRow[] = [];

  // Reference's explanatory first row.
  rows.push({
    cells: [
      '01.',
      'The Introducer needle are Purchased from other party and sent for further Processing.',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
    height: 38,
    bold: true,
  });

  for (let i = 0; i < 5; i++) {
    const item = lines[i] ?? {};
    rows.push({
      cells: [
        i === 0 ? '' : '',
        textValue(item.rawMaterialName),
        textValue(item.supplierBatchNo),
        fmtDate(item.qualityCheckedDate),
        textValue(item.quantityWithdrawn),
        textValue(item.requirementSlipNo),
        signature(item.doneBy),
        signature(item.checkedBy),
      ],
      height: 38,
    });
  }

  return rows;
}

function manufacturingRows(stages: Record<string, any>): TableRow[] {
  const mfg = stages.manufacturing ?? {};

  const rows: TableRow[] = [{
    cells: [
      '01.',
      textValue(mfg.process, 'The needles are made Ready for\nSterilization.'),
      fmtDate(mfg.processDate),
      textValue(mfg.startTime),
      textValue(mfg.endTime),
      signature(mfg.operator),
    ],
    height: 48,
    bold: true,
  }];

  for (let i = 0; i < 7; i++) {
    rows.push({
      cells: ['', '', '', '', '', ''],
      height: 29,
    });
  }

  return rows;
}

function inProcessRows(stages: Record<string, any>): TableRow[] {
  const ipqc = stages.inProcessQc ?? {};

  return [
    {
      cells: [
        '1.',
        'The Needles are checked Free from\nDust, Burrs and Foreign Particle.',
        fmtDate(ipqc.date ?? ipqc.checkedOn),
        textValue(ipqc.observation),
        signature(ipqc.qcCheckedBy ?? ipqc.checkedBy),
      ],
      height: 63,
      bold: true,
    },
    {
      cells: ['2.', '', '', '', ''],
      height: 72,
    },
  ];
}

export function streamBmrPdf(batch: IBatch, res: Response) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `BMR - ${batch.batchNo ?? 'Introducer Needle'}`,
      Author: 'SureTech Medical Inc.',
      Subject: 'Batch Manufacturing Record',
    },
  });

  const filename = `BMR-${batch.batchNo || 'INTRODUCER-NEEDLE'}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );

  doc.pipe(res);

  const stages = (batch.stages ?? {}) as Record<string, any>;
  const snap = batch.processParamsSnapshot as any;

  // ============================================================
  // PAGE 1
  // ============================================================
  beginPage(doc, 1);

  drawProductBlock(doc, batch);

  sectionTitle(doc, 'QUALITY CHECKING OF RAW MATERIAL', 268);

  drawTable(
    doc,
    CONTENT_X,
    291,
    [
      { header: 'Sr.\\nNo.', width: 36 },
      { header: 'PROCESS', width: 108 },
      { header: 'DONE\\nON', width: 49 },
      { header: 'START\\nTIME', width: 49 },
      { header: 'END\\nTIME', width: 54 },
      { header: 'OBSERVATION/\\nNOTE', width: 85 },
      { header: 'DONE BY', width: 59 },
      { header: 'CHECKED BY', width: 72 },
    ],
    rawMaterialRows(stages),
    42,
    38,
  );

  sectionTitle(doc, 'RAW MATERIAL CONSUMPTION RECORD', 493);

  drawTable(
    doc,
    CONTENT_X,
    520,
    [
      { header: 'Sr.\\nNo.', width: 36 },
      { header: 'RAW MATERIAL\\nNAME', width: 86 },
      { header: 'BATCH\\nNO', width: 58 },
      { header: 'QUALITY\\nCHECKED\\nON', width: 72 },
      { header: 'QUANTITY\\nWITHDRAWN', width: 90 },
      { header: 'REQ. SLIP\\nNO', width: 54 },
      { header: 'DONE BY', width: 55 },
      { header: 'CHECKED\\nBY', width: 69 },
    ],
    consumptionRows(stages),
    56,
    38,
  );

  drawSignBox(doc);

  // ============================================================
  // PAGE 2
  // ============================================================
  beginPage(doc, 2);

  sectionTitle(doc, 'MANUFACTURING PROCESS:', 166);

  drawTable(
    doc,
    47,
    190,
    [
      { header: 'Sr. No.', width: 54 },
      { header: 'PROCESS', width: 200 },
      { header: 'DONE ON', width: 60 },
      { header: 'START\\nTIME', width: 63 },
      { header: 'END TIME', width: 59 },
      { header: 'DONE BY', width: 67 },
    ],
    manufacturingRows(stages),
    42,
    29,
  );

  sectionTitle(doc, 'INPROCESS QUALITY CHECKING:', 482);

  drawTable(
    doc,
    47,
    518,
    [
      { header: 'Sr. No.', width: 55 },
      { header: 'PROCESS', width: 188 },
      { header: 'DONE ON', width: 60 },
      { header: 'OBSERVATION / NOTE:', width: 127 },
      { header: 'DONE BY', width: 59 },
    ],
    inProcessRows(stages),
    40,
    63,
  );

  drawSignBox(doc);

  // ============================================================
  // PAGE 3
  // ============================================================
  beginPage(doc, 3);

  const vis = stages.visualInspection ?? {};
  const pack = stages.packing ?? {};
  const seal = stages.sealing ?? {};
  const ster = stages.sterilization ?? {};

  sectionTitle(doc, 'VISUAL INSPECTION FOR DUST/FOREIGN PARTICLES', 166);

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'NO. OF UNITS CHECKED:',
        leftValue: vis.unitsChecked,
        right: 'NO. OF UNITS IN WHICH PARTICLES FOUND:',
        rightValue: vis.particlesFound,
      },
      {
        left: 'VISUAL INSPECTION DONE ON:',
        leftValue: fmtDate(vis.inspectionDate),
        right: 'DONE BY:',
        rightValue: signature(vis.doneBy),
      },
      {
        left: 'CHECKED BY:',
        leftValue: signature(vis.checkedBy),
        right: 'TIME:',
        rightValue: textValue(vis.time ?? vis.endTime),
      },
    ],
    55,
    193,
    34,
  );

  sectionTitle(doc, 'PACKING RECORD', 292);

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'QUANTITY OF POUCHES TAKEN:',
        leftValue: pack.pouchesTaken,
        right: 'PACKING DONE ON:',
        rightValue: fmtDate(pack.packingDate),
      },
      {
        left: 'QUANTITY OF DEVICES PACKED:',
        leftValue: pack.devicesPacked,
        right: 'NO. OF POUCHES DAMAGED',
        rightValue: pack.pouchesDamaged,
      },
      {
        left: 'DONE BY:',
        leftValue: signature(pack.operator ?? pack.doneBy),
        right: 'CHECKED BY:',
        rightValue: signature(pack.checkedBy),
      },
    ],
    55,
    330,
    34,
  );

  sectionTitle(doc, 'SEALING RECORD', 395);

  centeredNote(
    doc,
    `At ${textValue(
      seal.configuredTemperatureC ??
      snap?.sealingParams?.temperatureC ??
      200,
      '200',
    )}°C FOR PAPER POUCH, OPERATION DONE AS PER ${textValue(
      seal.sopRef ?? snap?.sealingParams?.sopRef,
      'SOP/MF/011',
    )}`,
    421,
    8.5,
  );

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'NO. OF DEVICES SEALED:',
        leftValue: seal.devicesSealed,
        right: 'SEALING DONE ON:',
        rightValue: fmtDate(seal.sealingDate),
      },
      {
        left: 'DONE BY:',
        leftValue: signature(seal.operator),
        right: 'CHECKED BY:',
        rightValue: signature(seal.checkedBy),
      },
    ],
    55,
    455,
    34,
  );

  sectionTitle(doc, 'STERILIZATION RECORD', 528);

  centeredNote(
    doc,
    `ETO STERILIZATION AT ${textValue(
      ster.configuredTemperatureC ??
      snap?.sterilizationParams?.temperatureC ??
      55,
      '55',
    )}°C, FOR ${textValue(
      ster.requiredDurationHours ??
      snap?.sterilizationParams?.durationHours ??
      4,
      '4',
    )} HOURS, ${textValue(
      ster.etoCartridgeGrams ??
      snap?.sterilizationParams?.etoCartridgeGrams ??
      40,
      '40',
    )}GM ETO GAS CARTRIDGE USED PER LOT`,
    552,
    8.5,
  );

  centeredNote(
    doc,
    `OPERATION OF ETO MACHINE AS PER ${textValue(
      ster.sopRef ?? snap?.sterilizationParams?.sopRef,
      'SOP/MF/008',
    )}`,
    575,
    9,
  );

  drawTable(
    doc,
    50,
    599,
    [
      { header: 'DATE', width: 60 },
      { header: 'QUANTITY', width: 63 },
      { header: 'START TIME', width: 90 },
      { header: 'END TIME', width: 86 },
      { header: 'OPERATOR', width: 94 },
      { header: 'CHECKED BY', width: 102 },
    ],
    [
      {
        cells: [
          fmtDate(ster.startDate ?? ster.date),
          textValue(ster.quantity),
          textValue(ster.startTime),
          textValue(ster.endTime),
          signature(ster.operator),
          signature(ster.checkedBy),
        ],
        height: 76,
      },
      {
        cells: ['', '', '', '', '', ''],
        height: 39,
      },
    ],
    40,
    76,
  );

  drawSignBox(doc);

  // ============================================================
  // PAGE 4
  // ============================================================
  beginPage(doc, 4);

  const lab = stages.labelling ?? {};
  const st = stages.sterilityTest ?? {};
  const bet = stages.betTest ?? {};

  sectionTitle(doc, 'ETO CARTRIDGE DETAILS', 166);

  drawTable(
    doc,
    47,
    209,
    [
      { header: 'BATCH NO', width: 118 },
      { header: 'RECEIVED ON', width: 123 },
      { header: 'EXPIRY DATE', width: 105 },
      { header: 'STORAGE CONDITION', width: 137 },
    ],
    [{
      cells: [
        textValue(ster.cartridgeBatchNo),
        fmtDate(ster.cartridgeReceivedOn),
        fmtDate(ster.cartridgeExpiryDate),
        textValue(
          ster.storageCondition ??
          snap?.storageCondition ??
          'Store at Room\nTemperature.',
        ),
      ],
      height: 52,
    }],
    27,
    52,
  );

  sectionTitle(doc, 'BATCH LABELLING RECORD', 291);

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'LABELS PRINTED BY:',
        leftValue: signature(lab.printedBy),
        right: 'NO. OF LABELS PRINTED:',
        rightValue: lab.labelsPrinted,
      },
      {
        left: 'NO. OF DEVICES LABELLED:',
        leftValue: lab.devicesLabelled,
        right: 'NO. OF LABELS DESTROYED:',
        rightValue: lab.labelsDestroyed,
      },
      {
        left: 'DONE ON:',
        leftValue: fmtDate(lab.doneOn),
        right: 'CHECKED BY:',
        rightValue: signature(lab.checkedBy),
      },
    ],
    55,
    330,
    34,
  );

  sectionTitle(doc, 'STERILITY TEST RECORD', 416);

  centeredNote(
    doc,
    `AS PER SOP NO. ${textValue(
      st.sopRef ?? snap?.sterilitySop,
      'SOP/QC/004',
    )}`,
    445,
    8.5,
  );

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'DONE ON:',
        leftValue: fmtDate(st.testDate ?? st.doneOn),
        right: 'REPORT NO:',
        rightValue: st.reportNo,
      },
      {
        left: 'RESULT:',
        leftValue: st.result,
        right: 'REPORTING DATE:',
        rightValue: fmtDate(st.reportingDate),
      },
      {
        left: 'START TIME:',
        leftValue: st.startTime,
        right: 'END TIME:',
        rightValue: st.endTime,
      },
      {
        left: 'TESTED BY:',
        leftValue: signature(st.testedBy),
        right: 'CHECKED BY:',
        rightValue: signature(st.checkedBy),
      },
    ],
    55,
    466,
    34,
  );

  sectionTitle(doc, 'BET TEST RECORD', 590);

  centeredNote(
    doc,
    `AS PER SOP NO. ${textValue(
      bet.sopRef ?? snap?.betSop,
      'SOP/QC/005',
    )}`,
    620,
    8.5,
  );

  drawTwoColumnFields(
    doc,
    [
      {
        left: 'DONE ON:',
        leftValue: fmtDate(bet.testDate ?? bet.doneOn),
        right: 'REPORT NO:',
        rightValue: bet.reportNo,
      },
      {
        left: 'RESULT:',
        leftValue: bet.result,
        right: 'REPORTING DATE:',
        rightValue: fmtDate(bet.reportingDate),
      },
      {
        left: 'START TIME:',
        leftValue: bet.startTime,
        right: 'END TIME:',
        rightValue: bet.endTime,
      },
      {
        left: 'TESTED BY:',
        leftValue: signature(bet.testedBy),
        right: 'CHECKED BY:',
        rightValue: signature(bet.checkedBy),
      },
    ],
    55,
    640,
    34,
  );

  drawSignBox(doc);

  // ============================================================
  // PAGE 5
  // ============================================================
  beginPage(doc, 5);

  const fg = stages.finishedGoods ?? {};
  const dispatch = stages.materialDispatch ?? stages.dispatch ?? {};
  const dispatchRows = Array.isArray(dispatch.rows)
    ? dispatch.rows
    : Array.isArray(dispatch.records)
      ? dispatch.records
      : [];

  sectionTitle(doc, 'BATCH PACKING RECORD', 145);

  centeredNote(
    doc,
    'AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS',
    171,
    9,
  );

  drawTwoColumnFields(
    doc,
    [{
      left: 'NO. OF FINISHED PRODUCTS:',
      leftValue: fg.quantity,
      right: 'DATE OF TRANSFER TO FINISHED GOODS:',
      rightValue: fmtDate(fg.transferDate),
    }],
    55,
    199,
    34,
  );

  sectionTitle(doc, 'MATERIAL DISPATCH RECORD', 225);

  const rows: TableRow[] = [];
  for (let i = 0; i < 4; i++) {
    const r = dispatchRows[i] ?? {};
    rows.push({
      cells: [
        textValue(r.customerName ?? r.nameOfCustomer),
        fmtDate(r.dispatchDate ?? r.dateOfDispatch),
        textValue(r.billNo),
        textValue(r.quantityDispatched ?? r.quantity),
        signature(r.dispatchedBy),
        signature(r.checkedBy),
      ],
      height: 76,
    });
  }

  drawTable(
    doc,
    40,
    242,
    [
      { header: 'NAME OF\\nCUSTOMER', width: 81 },
      { header: 'DATE OF\\nDISPATCH', width: 74 },
      { header: 'BILL NO.', width: 69 },
      { header: 'QTY\\nDISPATCHED', width: 84 },
      { header: 'DISPATCHED BY', width: 84 },
      { header: 'CHECKED BY', width: 72 },
    ],
    rows,
    42,
    76,
  );

  drawSignBox(doc);

  doc.end();
}


// import PDFDocument from "pdfkit";
// import { Response } from "express";
// import { IBatch } from "../models/Batch.js";

// /**
//  * Introducer Needle BMR PDF
//  * ------------------------------------------------------------
//  * This renderer intentionally uses fixed A4 coordinates instead of
//  * PDFKit flow layout so the output follows the supplied reference:
//  *
//  * - A4 portrait
//  * - thin black outer border
//  * - black/white tables
//  * - Times-style document heading
//  * - Helvetica-style form labels
//  * - centered underlined section headings
//  * - five fixed pages
//  * - bottom Production Chemist / Sign box on every page
//  *
//  * Reference layout: SURETECH MEDICAL INC.
//  * 3/33 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063
//  * Doc ID: SU/BMR/002
//  */

// const PAGE_W = 595.28;
// const PAGE_H = 841.89;

// const BORDER_X = 24;
// const BORDER_Y = 24;
// const BORDER_W = PAGE_W - BORDER_X * 2;
// const BORDER_H = PAGE_H - BORDER_Y * 2;

// const CONTENT_X = 50;
// const CONTENT_W = PAGE_W - CONTENT_X * 2;

// const TABLE_LINE = "#777777";
// const BLACK = "#000000";
// const WHITE = "#ffffff";

// type Align = "left" | "center" | "right";

// type TableColumn = {
//   header: string;
//   width: number;
//   align?: Align;
// };

// type TableRow = {
//   cells: unknown[];
//   height?: number;
//   bold?: boolean;
// };

// function textValue(value: unknown, fallback = ""): string {
//   if (value === undefined || value === null || value === "") return fallback;
//   return String(value);
// }

// function dash(value: unknown): string {
//   return textValue(value, "—");
// }

// function fmtDate(value?: Date | string | null): string {
//   if (!value) return "";
//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return "";
//   return d.toLocaleDateString("en-GB");
// }

// function signature(value: unknown): string {
//   if (!value || typeof value !== "object") return "";
//   const s = value as {
//     name?: string;
//     employeeId?: string;
//     signedAt?: string | Date;
//   };

//   if (!s.name) return "";

//   return `${s.name}${s.employeeId ? ` (${s.employeeId})` : ""}${
//     s.signedAt ? ` @ ${fmtDate(s.signedAt)}` : ""
//   }`;
// }

// function fontNormal(doc: PDFKit.PDFDocument, size = 9) {
//   doc.font("Helvetica").fontSize(size).fillColor(BLACK);
// }

// function fontBold(doc: PDFKit.PDFDocument, size = 9) {
//   doc.font("Helvetica-Bold").fontSize(size).fillColor(BLACK);
// }

// function fontTimesBold(doc: PDFKit.PDFDocument, size = 12) {
//   doc.font("Times-Bold").fontSize(size).fillColor(BLACK);
// }

// function drawOuterBorder(doc: PDFKit.PDFDocument) {
//   doc.save();
//   doc.strokeColor(BLACK).lineWidth(0.8);
//   doc.rect(BORDER_X, BORDER_Y, BORDER_W, BORDER_H).stroke();
//   doc.restore();
// }

// function drawHeader(doc: PDFKit.PDFDocument, pageNo: number) {
//   // Company
//   fontTimesBold(doc, 12);
//   doc.text("SURETECH MEDICAL INC.", 0, 39, {
//     width: PAGE_W,
//     align: "center",
//   });

//   fontTimesBold(doc, 9);
//   doc.text(
//     "3/33 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063",
//     0,
//     56,
//     {
//       width: PAGE_W,
//       align: "center",
//     },
//   );

//   fontTimesBold(doc, 14);
//   doc.text("BATCH MANUFACTURING RECORD", 0, 78, {
//     width: PAGE_W,
//     align: "center",
//   });

//   fontTimesBold(doc, 11);
//   doc.text("Doc ID:", 50, 109);
//   fontNormal(doc, 11);
//   doc.text("SU/BMR/002", 87, 109);

//   fontTimesBold(doc, 11);
//   doc.text(`Page ${pageNo} of 5`, 0, 109, {
//     width: PAGE_W - 50,
//     align: "right",
//   });
// }

// function beginPage(doc: PDFKit.PDFDocument, pageNo: number) {
//   if (pageNo > 1) doc.addPage({ size: "A4", margin: 0 });

//   doc.x = CONTENT_X;
//   doc.y = 130;

//   drawOuterBorder(doc);
//   drawHeader(doc, pageNo);
// }

// function sectionTitle(
//   doc: PDFKit.PDFDocument,
//   title: string,
//   y: number,
//   fontSize = 10,
// ) {
//   fontBold(doc, fontSize);
//   doc.text(title, CONTENT_X, y, {
//     width: CONTENT_W,
//     align: "center",
//     underline: true,
//   });
// }

// function centeredNote(
//   doc: PDFKit.PDFDocument,
//   value: string,
//   y: number,
//   fontSize = 9,
// ) {
//   fontBold(doc, fontSize);
//   doc.text(value, CONTENT_X, y, {
//     width: CONTENT_W,
//     align: "center",
//   });
// }

// /**
//  * Generic fixed-coordinate table.
//  * Header is white, borders are thin grey/black, and no colored fill is used.
//  */
// function drawTable(
//   doc: PDFKit.PDFDocument,
//   x: number,
//   y: number,
//   columns: TableColumn[],
//   rows: TableRow[],
//   headerHeight = 42,
//   bodyDefaultHeight = 38,
// ) {
//   const totalW = columns.reduce((sum, c) => sum + c.width, 0);

//   // Header background remains white, matching reference.
//   doc.save();
//   doc.fillColor(WHITE);
//   doc.rect(x, y, totalW, headerHeight).fill();
//   doc.restore();

//   // Header text.
//   let cx = x;
//   columns.forEach((col) => {
//     fontBold(doc, 8.5);
//     doc.text(col.header, cx + 5, y + 5, {
//       width: col.width - 10,
//       height: headerHeight - 8,
//       align: col.align ?? "left",
//       lineGap: 1.5,
//     });
//     cx += col.width;
//   });

//   // Header borders.
//   doc.save();
//   doc.strokeColor(TABLE_LINE).lineWidth(0.55);
//   doc.rect(x, y, totalW, headerHeight).stroke();

//   cx = x;
//   columns.forEach((col, index) => {
//     cx += col.width;
//     if (index < columns.length - 1) {
//       doc
//         .moveTo(cx, y)
//         .lineTo(cx, y + headerHeight)
//         .stroke();
//     }
//   });
//   doc.restore();

//   let cy = y + headerHeight;

//   rows.forEach((row) => {
//     const rowH = row.height ?? bodyDefaultHeight;

//     doc.save();
//     doc.fillColor(WHITE);
//     doc.rect(x, cy, totalW, rowH).fill();

//     doc.strokeColor(TABLE_LINE).lineWidth(0.55);
//     doc.rect(x, cy, totalW, rowH).stroke();

//     let cellX = x;

//     row.cells.forEach((value, index) => {
//       const col = columns[index];
//       const content = textValue(value);

//       if (row.bold) fontBold(doc, 8.5);
//       else fontNormal(doc, 8.5);

//       doc.text(content, cellX + 5, cy + 6, {
//         width: col.width - 10,
//         height: rowH - 9,
//         align: col.align ?? "left",
//         lineGap: 1.5,
//       });

//       cellX += col.width;

//       if (index < columns.length - 1) {
//         doc
//           .moveTo(cellX, cy)
//           .lineTo(cellX, cy + rowH)
//           .stroke();
//       }
//     });

//     doc.restore();
//     cy += rowH;
//   });

//   return cy;
// }

// function drawTwoColumnFields(
//   doc: PDFKit.PDFDocument,
//   fields: Array<{
//     left: string;
//     leftValue?: unknown;
//     right: string;
//     rightValue?: unknown;
//   }>,
//   x: number,
//   y: number,
//   rowHeight = 27,
// ) {
//   const half = CONTENT_W / 2;

//   fields.forEach((field, i) => {
//     const yy = y + i * rowHeight;

//     fontBold(doc, 8.8);
//     doc.text(`${field.left}`, x + 5, yy, {
//       width: half - 15,
//       align: "left",
//     });

//     if (field.leftValue !== undefined && field.leftValue !== "") {
//       fontNormal(doc, 8.8);
//       doc.text(textValue(field.leftValue), x + 115, yy, {
//         width: half - 125,
//       });
//     }

//     fontBold(doc, 8.8);
//     doc.text(`${field.right}`, x + half + 5, yy, {
//       width: half - 15,
//       align: "left",
//     });

//     if (field.rightValue !== undefined && field.rightValue !== "") {
//       fontNormal(doc, 8.8);
//       doc.text(textValue(field.rightValue), x + half + 115, yy, {
//         width: half - 125,
//       });
//     }
//   });
// }

// function drawProductBlock(doc: PDFKit.PDFDocument, batch: IBatch) {
//   const x = CONTENT_X;
//   const y = 138;
//   const w = CONTENT_W;
//   const h = 128;

//   doc.save();
//   doc.strokeColor(BLACK).lineWidth(0.7);
//   doc.rect(x, y, w, h).stroke();

//   // Horizontal split after first product/category row.
//   doc
//     .moveTo(x, y + 61)
//     .lineTo(x + w, y + 61)
//     .stroke();

//   // Vertical split in lower section.
//   doc
//     .moveTo(x + w / 2, y + 61)
//     .lineTo(x + w / 2, y + h)
//     .stroke();
//   doc.restore();

//   fontBold(doc, 8.8);
//   doc.text(
//     `PRODUCT NAME: ${textValue(batch.productName, "INTRODUCER NEEDLE.")}`,
//     x + 6,
//     y + 6,
//   );

//   fontBold(doc, 8.8);
//   doc.text("CATALOGUE NO. :", x + 6, y + 38);
//   fontNormal(doc, 8.8);
//   doc.text(textValue(batch.catalogueNo), x + 105, y + 38);

//   fontBold(doc, 8.8);
//   doc.text("BATCH NO. :", x + 6, y + 72);
//   fontNormal(doc, 8.8);
//   doc.text(textValue(batch.batchNo), x + 75, y + 72);

//   fontBold(doc, 8.8);
//   doc.text("MFG./ STR DATE:", x + w / 2 + 6, y + 72);
//   fontNormal(doc, 8.8);
//   doc.text(fmtDate(batch.manufacturingDate), x + w / 2 + 105, y + 72);

//   fontBold(doc, 8.8);
//   doc.text("BATCH SIZE :", x + 6, y + 102);
//   fontNormal(doc, 8.8);
//   doc.text(textValue(batch.batchSize), x + 80, y + 102);

//   fontBold(doc, 8.8);
//   doc.text("EXPIRY DATE:", x + w / 2 + 6, y + 102);
//   fontNormal(doc, 8.8);
//   doc.text(fmtDate(batch.expiryDate), x + w / 2 + 100, y + 102);
// }

// function drawSignBox(doc: PDFKit.PDFDocument) {
//   const x = 41;
//   const y = 763;
//   const w = PAGE_W - 82;
//   const h = 29;
//   const split = x + w / 2;

//   doc.save();
//   doc.strokeColor(BLACK).lineWidth(0.7);
//   doc.rect(x, y, w, h).stroke();
//   doc
//     .moveTo(split, y)
//     .lineTo(split, y + h)
//     .stroke();
//   doc.restore();

//   fontTimesBold(doc, 10);
//   doc.text("PRODUCTION CHEMIST", x + 6, y + 7);
//   doc.text("SIGN:", split + 6, y + 7);
// }

// function rawMaterialRows(stages: Record<string, any>): TableRow[] {
//   const rmQc = stages.rawMaterialQc ?? {};
//   const checks = Array.isArray(rmQc.checks) ? rmQc.checks : [];

//   const defaults = [
//     "Hub checking",
//     "Bevel checking",
//     "Guide Wire passing",
//     "Visual Inspection: -\\nFor Dust, Burrs and\\nForeign Particles.",
//   ];

//   const rows: TableRow[] = defaults.map((name, i) => {
//     const c = checks[i] ?? {};
//     return {
//       cells: [
//         `${String(i + 1).padStart(2, "0")}.`,
//         textValue(c.process, name),
//         fmtDate(c.processDate),
//         textValue(c.startTime),
//         textValue(c.endTime),
//         textValue(c.observation),
//         signature(c.doneBy),
//         signature(c.checkedBy),
//       ],
//       height: i === 3 ? 63 : 38,
//       bold: true,
//     };
//   });

//   // Reference has one additional blank row.
//   rows.push({
//     cells: ["", "", "", "", "", "", "", ""],
//     height: 28,
//   });

//   return rows;
// }

// function consumptionRows(stages: Record<string, any>): TableRow[] {
//   const cons = stages.rawMaterialConsumption ?? {};
//   const lines = Array.isArray(cons.lines) ? cons.lines : [];

//   const rows: TableRow[] = [];

//   // Reference's explanatory first row.
//   rows.push({
//     cells: [
//       "01.",
//       "The Introducer needle are Purchased from other party and sent for further Processing.",
//       "",
//       "",
//       "",
//       "",
//       "",
//       "",
//     ],
//     height: 38,
//     bold: true,
//   });

//   for (let i = 0; i < 5; i++) {
//     const item = lines[i] ?? {};
//     rows.push({
//       cells: [
//         i === 0 ? "" : "",
//         textValue(item.rawMaterialName),
//         textValue(item.supplierBatchNo),
//         textValue(item.unit),
//         fmtDate(item.qualityCheckedDate),
//         textValue(item.quantityWithdrawn),
//         textValue(item.requirementSlipNo),
//         signature(item.doneBy ?? item.checkedBy),
//       ],
//       height: 38,
//     });
//   }

//   return rows;
// }

// function manufacturingRows(stages: Record<string, any>): TableRow[] {
//   const mfg = stages.manufacturing ?? {};

//   const rows: TableRow[] = [
//     {
//       cells: [
//         "01.",
//         textValue(
//           mfg.process,
//           "The needles are made Ready for\\nSterilization.",
//         ),
//         fmtDate(mfg.processDate),
//         textValue(mfg.startTime),
//         textValue(mfg.endTime),
//         signature(mfg.operator),
//       ],
//       height: 48,
//       bold: true,
//     },
//   ];

//   for (let i = 0; i < 7; i++) {
//     rows.push({
//       cells: ["", "", "", "", "", ""],
//       height: 29,
//     });
//   }

//   return rows;
// }

// function inProcessRows(stages: Record<string, any>): TableRow[] {
//   const ipqc = stages.inProcessQc ?? {};

//   return [
//     {
//       cells: [
//         "1.",
//         "The Needles are checked Free from\\nDust, Burrs and Foreign Particle.",
//         fmtDate(ipqc.date ?? ipqc.checkedOn),
//         textValue(ipqc.observation),
//         signature(ipqc.qcCheckedBy ?? ipqc.checkedBy),
//       ],
//       height: 63,
//       bold: true,
//     },
//     {
//       cells: ["2.", "", "", "", ""],
//       height: 72,
//     },
//   ];
// }

// export function streamBmrPdf(batch: IBatch, res: Response) {
//   const doc = new PDFDocument({
//     size: "A4",
//     margin: 0,
//     autoFirstPage: true,
//     info: {
//       Title: `BMR - ${batch.batchNo ?? "Introducer Needle"}`,
//       Author: "SureTech Medical Inc.",
//       Subject: "Batch Manufacturing Record",
//     },
//   });

//   const filename = `BMR-${batch.batchNo || "INTRODUCER-NEEDLE"}.pdf`;

//   res.setHeader("Content-Type", "application/pdf");
//   res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

//   doc.pipe(res);

//   const stages = (batch.stages ?? {}) as Record<string, any>;
//   const snap = batch.processParamsSnapshot as any;

//   // ============================================================
//   // PAGE 1
//   // ============================================================
//   beginPage(doc, 1);

//   drawProductBlock(doc, batch);

//   sectionTitle(doc, "QUALITY CHECKING OF RAW MATERIAL", 268);

//   drawTable(
//     doc,
//     CONTENT_X,
//     291,
//     [
//       { header: "Sr.\\nNo.", width: 36 },
//       { header: "PROCESS", width: 108 },
//       { header: "DONE\\nON", width: 49 },
//       { header: "START\\nTIME", width: 49 },
//       { header: "END\\nTIME", width: 54 },
//       { header: "OBSERVATION/\\nNOTE", width: 85 },
//       { header: "DONE BY", width: 59 },
//       { header: "CHECKED BY", width: 72 },
//     ],
//     rawMaterialRows(stages),
//     42,
//     38,
//   );

//   sectionTitle(doc, "RAW MATERIAL CONSUMPTION RECORD", 493);

//   drawTable(
//     doc,
//     CONTENT_X,
//     520,
//     [
//       { header: "Sr.\\nNo.", width: 36 },
//       { header: "RAW MATERIAL\\nNAME", width: 86 },
//       { header: "BATCH\\nNO", width: 58 },
//       { header: "QUALITY\\nCHECKED\\nON", width: 72 },
//       { header: "QUANTITY\\nWITHDRAWN", width: 90 },
//       { header: "REQ. SLIP\\nNO", width: 54 },
//       { header: "DONE BY", width: 55 },
//       { header: "CHECKED\\nBY", width: 69 },
//     ],
//     consumptionRows(stages),
//     56,
//     38,
//   );

//   drawSignBox(doc);

//   // ============================================================
//   // PAGE 2
//   // ============================================================
//   beginPage(doc, 2);

//   sectionTitle(doc, "MANUFACTURING PROCESS:", 166);

//   drawTable(
//     doc,
//     47,
//     190,
//     [
//       { header: "Sr. No.", width: 54 },
//       { header: "PROCESS", width: 200 },
//       { header: "DONE ON", width: 60 },
//       { header: "START\\nTIME", width: 63 },
//       { header: "END TIME", width: 59 },
//       { header: "DONE BY", width: 67 },
//     ],
//     manufacturingRows(stages),
//     42,
//     29,
//   );

//   sectionTitle(doc, "INPROCESS QUALITY CHECKING:", 482);

//   drawTable(
//     doc,
//     47,
//     518,
//     [
//       { header: "Sr. No.", width: 55 },
//       { header: "PROCESS", width: 188 },
//       { header: "DONE ON", width: 60 },
//       { header: "OBSERVATION / NOTE:", width: 127 },
//       { header: "DONE BY", width: 59 },
//     ],
//     inProcessRows(stages),
//     40,
//     63,
//   );

//   drawSignBox(doc);

//   // ============================================================
//   // PAGE 3
//   // ============================================================
//   beginPage(doc, 3);

//   const vis = stages.visualInspection ?? {};
//   const pack = stages.packing ?? {};
//   const seal = stages.sealing ?? {};
//   const ster = stages.sterilization ?? {};

//   sectionTitle(doc, "VISUAL INSPECTION FOR DUST/FOREIGN PARTICLES", 166);

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "NO. OF UNITS CHECKED:",
//         leftValue: vis.unitsChecked,
//         right: "NO. OF UNITS IN WHICH PARTICLES FOUND:",
//         rightValue: vis.particlesFound,
//       },
//       {
//         left: "VISUAL INSPECTION DONE ON:",
//         leftValue: fmtDate(vis.inspectionDate),
//         right: "DONE BY:",
//         rightValue: signature(vis.doneBy),
//       },
//       {
//         left: "CHECKED BY:",
//         leftValue: signature(vis.checkedBy),
//         right: "TIME:",
//         rightValue: textValue(vis.time ?? vis.endTime),
//       },
//     ],
//     55,
//     193,
//     25,
//   );

//   sectionTitle(doc, "PACKING RECORD", 292);

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "QUANTITY OF POUCHES TAKEN:",
//         leftValue: pack.pouchesTaken,
//         right: "PACKING DONE ON:",
//         rightValue: fmtDate(pack.packingDate),
//       },
//       {
//         left: "QUANTITY OF DEVICES PACKED:",
//         leftValue: pack.devicesPacked,
//         right: "NO. OF POUCHES DAMAGED",
//         rightValue: pack.pouchesDamaged,
//       },
//       {
//         left: "DONE BY:",
//         leftValue: signature(pack.operator ?? pack.doneBy),
//         right: "CHECKED BY:",
//         rightValue: signature(pack.checkedBy),
//       },
//     ],
//     55,
//     330,
//     25,
//   );

//   sectionTitle(doc, "SEALING RECORD", 395);

//   centeredNote(
//     doc,
//     `At ${textValue(
//       seal.configuredTemperatureC ?? snap?.sealingParams?.temperatureC ?? 200,
//       "200",
//     )}°C FOR PAPER POUCH, OPERATION DONE AS PER ${textValue(
//       seal.sopRef ?? snap?.sealingParams?.sopRef,
//       "SOP/MF/011",
//     )}`,
//     421,
//     8.5,
//   );

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "NO. OF DEVICES SEALED:",
//         leftValue: seal.devicesSealed,
//         right: "SEALING DONE ON:",
//         rightValue: fmtDate(seal.sealingDate),
//       },
//       {
//         left: "DONE BY:",
//         leftValue: signature(seal.operator),
//         right: "CHECKED BY:",
//         rightValue: signature(seal.checkedBy),
//       },
//     ],
//     55,
//     455,
//     25,
//   );

//   sectionTitle(doc, "STERILIZATION RECORD", 528);

//   centeredNote(
//     doc,
//     `ETO STERILIZATION AT ${textValue(
//       ster.configuredTemperatureC ??
//         snap?.sterilizationParams?.temperatureC ??
//         55,
//       "55",
//     )}°C, FOR ${textValue(
//       ster.requiredDurationHours ??
//         snap?.sterilizationParams?.durationHours ??
//         4,
//       "4",
//     )} HOURS, ${textValue(
//       ster.etoCartridgeGrams ??
//         snap?.sterilizationParams?.etoCartridgeGrams ??
//         40,
//       "40",
//     )}GM ETO GAS CARTRIDGE USED PER LOT`,
//     552,
//     8.5,
//   );

//   centeredNote(
//     doc,
//     `OPERATION OF ETO MACHINE AS PER ${textValue(
//       ster.sopRef ?? snap?.sterilizationParams?.sopRef,
//       "SOP/MF/008",
//     )}`,
//     575,
//     9,
//   );

//   drawTable(
//     doc,
//     50,
//     599,
//     [
//       { header: "DATE", width: 60 },
//       { header: "QUANTITY", width: 63 },
//       { header: "START TIME", width: 90 },
//       { header: "END TIME", width: 86 },
//       { header: "OPERATOR", width: 94 },
//       { header: "CHECKED BY", width: 102 },
//     ],
//     [
//       {
//         cells: [
//           fmtDate(ster.startDate ?? ster.date),
//           textValue(ster.quantity),
//           textValue(ster.startTime),
//           textValue(ster.endTime),
//           signature(ster.operator),
//           signature(ster.checkedBy),
//         ],
//         height: 76,
//       },
//       {
//         cells: ["", "", "", "", "", ""],
//         height: 39,
//       },
//     ],
//     40,
//     76,
//   );

//   drawSignBox(doc);

//   // ============================================================
//   // PAGE 4
//   // ============================================================
//   beginPage(doc, 4);

//   const lab = stages.labelling ?? {};
//   const st = stages.sterilityTest ?? {};
//   const bet = stages.betTest ?? {};

//   sectionTitle(doc, "ETO CARTRIDGE DETAILS", 166);

//   drawTable(
//     doc,
//     47,
//     209,
//     [
//       { header: "BATCH NO", width: 118 },
//       { header: "RECEIVED ON", width: 123 },
//       { header: "EXPIRY DATE", width: 105 },
//       { header: "STORAGE CONDITION", width: 137 },
//     ],
//     [
//       {
//         cells: [
//           textValue(ster.cartridgeBatchNo),
//           fmtDate(ster.cartridgeReceivedOn),
//           fmtDate(ster.cartridgeExpiryDate),
//           textValue(
//             ster.storageCondition ??
//               snap?.storageCondition ??
//               "Store at Room\\nTemperature.",
//           ),
//         ],
//         height: 52,
//       },
//     ],
//     27,
//     52,
//   );

//   sectionTitle(doc, "BATCH LABELLING RECORD", 291);

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "LABELS PRINTED BY:",
//         leftValue: signature(lab.printedBy),
//         right: "NO. OF LABELS PRINTED:",
//         rightValue: lab.labelsPrinted,
//       },
//       {
//         left: "NO. OF DEVICES LABELLED:",
//         leftValue: lab.devicesLabelled,
//         right: "NO. OF LABELS DESTROYED:",
//         rightValue: lab.labelsDestroyed,
//       },
//       {
//         left: "DONE ON:",
//         leftValue: fmtDate(lab.doneOn),
//         right: "CHECKED BY:",
//         rightValue: signature(lab.checkedBy),
//       },
//     ],
//     55,
//     330,
//     25,
//   );

//   sectionTitle(doc, "STERILITY TEST RECORD", 419);

//   centeredNote(
//     doc,
//     `AS PER SOP NO. ${textValue(
//       st.sopRef ?? snap?.sterilitySop,
//       "SOP/QC/004",
//     )}`,
//     445,
//     8.5,
//   );

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "DONE ON:",
//         leftValue: fmtDate(st.testDate ?? st.doneOn),
//         right: "REPORT NO:",
//         rightValue: st.reportNo,
//       },
//       {
//         left: "RESULT:",
//         leftValue: st.result,
//         right: "REPORTING DATE:",
//         rightValue: fmtDate(st.reportingDate),
//       },
//       {
//         left: "START TIME:",
//         leftValue: st.startTime,
//         right: "END TIME:",
//         rightValue: st.endTime,
//       },
//       {
//         left: "TESTED BY:",
//         leftValue: signature(st.testedBy),
//         right: "CHECKED BY:",
//         rightValue: signature(st.checkedBy),
//       },
//     ],
//     55,
//     474,
//     25,
//   );

//   sectionTitle(doc, "BET TEST RECORD", 594);

//   centeredNote(
//     doc,
//     `AS PER SOP NO. ${textValue(bet.sopRef ?? snap?.betSop, "SOP/QC/005")}`,
//     620,
//     8.5,
//   );

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "DONE ON:",
//         leftValue: fmtDate(bet.testDate ?? bet.doneOn),
//         right: "REPORT NO:",
//         rightValue: bet.reportNo,
//       },
//       {
//         left: "RESULT:",
//         leftValue: bet.result,
//         right: "REPORTING DATE:",
//         rightValue: fmtDate(bet.reportingDate),
//       },
//       {
//         left: "START TIME:",
//         leftValue: bet.startTime,
//         right: "END TIME:",
//         rightValue: bet.endTime,
//       },
//       {
//         left: "TESTED BY:",
//         leftValue: signature(bet.testedBy),
//         right: "CHECKED BY:",
//         rightValue: signature(bet.checkedBy),
//       },
//     ],
//     55,
//     648,
//     25,
//   );

//   drawSignBox(doc);

//   // ============================================================
//   // PAGE 5
//   // ============================================================
//   beginPage(doc, 5);

//   const fg = stages.finishedGoods ?? {};
//   const dispatch = stages.materialDispatch ?? stages.dispatch ?? {};
//   const dispatchRows = Array.isArray(dispatch.rows)
//     ? dispatch.rows
//     : Array.isArray(dispatch.records)
//       ? dispatch.records
//       : [];

//   sectionTitle(doc, "BATCH PACKING RECORD", 145);

//   centeredNote(
//     doc,
//     "AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS",
//     171,
//     9,
//   );

//   drawTwoColumnFields(
//     doc,
//     [
//       {
//         left: "NO. OF FINISHED PRODUCTS:",
//         leftValue: fg.quantity,
//         right: "DATE OF TRANSFER TO FINISHED GOODS:",
//         rightValue: fmtDate(fg.transferDate),
//       },
//     ],
//     55,
//     199,
//     25,
//   );

//   sectionTitle(doc, "MATERIAL DISPATCH RECORD", 225);

//   const rows: TableRow[] = [];
//   for (let i = 0; i < 4; i++) {
//     const r = dispatchRows[i] ?? {};
//     rows.push({
//       cells: [
//         textValue(r.customerName ?? r.nameOfCustomer),
//         fmtDate(r.dispatchDate ?? r.dateOfDispatch),
//         textValue(r.billNo),
//         textValue(r.quantityDispatched ?? r.quantity),
//         signature(r.dispatchedBy),
//         signature(r.checkedBy),
//       ],
//       height: 76,
//     });
//   }

//   drawTable(
//     doc,
//     40,
//     242,
//     [
//       { header: "NAME OF\\nCUSTOMER", width: 81 },
//       { header: "DATE OF\\nDISPATCH", width: 74 },
//       { header: "BILL NO.", width: 69 },
//       { header: "QTY\\nDISPATCHED", width: 84 },
//       { header: "DISPATCHED BY", width: 84 },
//       { header: "CHECKED BY", width: 72 },
//     ],
//     rows,
//     42,
//     76,
//   );

//   drawSignBox(doc);

//   doc.end();
// }

// import PDFDocument from 'pdfkit';
// import { Response } from 'express';
// import { IBatch } from '../models/Batch.js';

// function section(doc: PDFKit.PDFDocument, title: string) {
//   doc.moveDown(0.6);
//   doc.fontSize(11).fillColor('#0b4f6c').text(title, { underline: true });
//   doc.moveDown(0.3);
//   doc.fontSize(9).fillColor('#14212b');
// }

// function line(doc: PDFKit.PDFDocument, label: string, value: unknown) {
//   const text = value === undefined || value === null || value === '' ? '—' : String(value);
//   doc.text(`${label}: ${text}`);
// }

// function fmtDate(value?: Date | string | null) {
//   if (!value) return '—';
//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return '—';
//   return d.toLocaleDateString('en-GB');
// }

// type Col = {
//   header: string;
//   width: number;
//   align?: 'left' | 'center' | 'right';
// };

// function cellText(value: unknown) {
//   if (value === undefined || value === null || value === '') return '—';
//   return String(value);
// }

// /** Draws a bordered table. Date/time columns should use align: 'center'. */
// function drawTable(
//   doc: PDFKit.PDFDocument,
//   columns: Col[],
//   rows: string[][],
// ) {
//   const startX = doc.page.margins.left;
//   const pageBottom = doc.page.height - doc.page.margins.bottom;
//   const headerH = 18;
//   const pad = 3;

//   const paintHeader = (y: number) => {
//     let x = startX;
//     doc.save();
//     doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), headerH).fill('#e8f4f8');
//     doc.restore();
//     doc.fontSize(7).fillColor('#0b4f6c');
//     for (const col of columns) {
//       doc.text(col.header, x + pad, y + 5, {
//         width: col.width - pad * 2,
//         align: col.align ?? 'left',
//         lineBreak: false,
//       });
//       x += col.width;
//     }
//     doc.strokeColor('#d5dee5').lineWidth(0.4);
//     x = startX;
//     const totalW = columns.reduce((s, c) => s + c.width, 0);
//     doc.rect(startX, y, totalW, headerH).stroke();
//     for (const col of columns) {
//       x += col.width;
//       doc.moveTo(x, y).lineTo(x, y + headerH).stroke();
//     }
//     return y + headerH;
//   };

//   let y = doc.y;
//   if (y + headerH + 20 > pageBottom) {
//     doc.addPage();
//     y = doc.page.margins.top;
//   }
//   y = paintHeader(y);

//   doc.fontSize(8).fillColor('#14212b');
//   for (const row of rows) {
//     const heights = row.map((text, i) =>
//       doc.heightOfString(cellText(text), { width: columns[i].width - pad * 2 }),
//     );
//     const rowH = Math.max(16, ...heights) + 6;
//     if (y + rowH > pageBottom) {
//       doc.addPage();
//       y = paintHeader(doc.page.margins.top);
//     }
//     let x = startX;
//     const totalW = columns.reduce((s, c) => s + c.width, 0);
//     doc.strokeColor('#d5dee5').lineWidth(0.4);
//     doc.rect(startX, y, totalW, rowH).stroke();
//     row.forEach((text, i) => {
//       const col = columns[i];
//       doc.fillColor('#14212b').text(cellText(text), x + pad, y + 4, {
//         width: col.width - pad * 2,
//         align: col.align ?? 'left',
//       });
//       x += col.width;
//       if (i < row.length - 1) {
//         doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
//       }
//     });
//     y += rowH;
//   }
//   doc.y = y + 6;
//   doc.x = startX;
// }

// function sig(value: unknown) {
//   if (!value || typeof value !== 'object') return '—';
//   const s = value as { name?: string; employeeId?: string; signedAt?: string | Date };
//   if (!s.name) return '—';
//   return `${s.name}${s.employeeId ? ` (${s.employeeId})` : ''}${
//     s.signedAt ? ` @ ${fmtDate(s.signedAt)}` : ''
//   }`;
// }

// const PAGE_W = 495;

// function pageBanner(doc: PDFKit.PDFDocument, batch: IBatch, page: number) {
//   doc.fontSize(13).fillColor('#0b4f6c').text('SURETECH MEDICAL INC.', { align: 'center' });
//   doc.fontSize(11).fillColor('#14212b').text('BATCH MANUFACTURING RECORD', { align: 'center' });
//   doc.fontSize(8).fillColor('#5a6b76').text(
//     `${batch.productName}  ·  Cat. ${batch.catalogueNo}  ·  Batch ${batch.batchNo}  ·  Page ${page} of 5`,
//     { align: 'center' },
//   );
//   doc.moveDown(0.4);
//   doc.fillColor('#14212b');
// }

// function orDashRows(rows: string[][], cols: number): string[][] {
//   if (rows.length > 0) return rows;
//   return [Array.from({ length: cols }, () => '—')];
// }

// export function streamBmrPdf(batch: IBatch, res: Response) {
//   const doc = new PDFDocument({ margin: 50, size: 'A4' });
//   const filename = `BMR-${batch.batchNo}.pdf`;

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//   doc.pipe(res);

//   const stages = (batch.stages ?? {}) as Record<string, Record<string, unknown>>;
//   const snap = batch.processParamsSnapshot;

//   // —— Page 1: identity + raw material ——
//   pageBanner(doc, batch, 1);
//   section(doc, '1. BATCH INFORMATION');
//   drawTable(
//     doc,
//     [
//       { header: 'PRODUCT', width: 120 },
//       { header: 'CATALOGUE NO.', width: 80, align: 'center' },
//       { header: 'BATCH NO.', width: 80, align: 'center' },
//       { header: 'BATCH SIZE', width: 70, align: 'center' },
//       { header: 'MFG DATE', width: 72, align: 'center' },
//       { header: 'EXPIRY', width: 73, align: 'center' },
//     ],
//     [[
//       cellText(batch.productName),
//       cellText(batch.catalogueNo),
//       cellText(batch.batchNo),
//       cellText(batch.batchSize?.toLocaleString()),
//       fmtDate(batch.manufacturingDate),
//       fmtDate(batch.expiryDate),
//     ]],
//   );

//   section(doc, '2. RAW MATERIAL QUALITY CHECK');
//   const rmQc = stages.rawMaterialQc ?? {};
//   const checks = (rmQc.checks as Array<Record<string, unknown>>) ?? [];
//   drawTable(
//     doc,
//     [
//       { header: 'PROCESS', width: 140 },
//       { header: 'DATE', width: 68, align: 'center' },
//       { header: 'START', width: 48, align: 'center' },
//       { header: 'END', width: 48, align: 'center' },
//       { header: 'OBSERVATION', width: 140 },
//       { header: 'RESULT', width: 51, align: 'center' },
//     ],
//     orDashRows(
//       checks.map((c) => [
//         cellText(c.process),
//         fmtDate(c.processDate as string),
//         cellText(c.startTime),
//         cellText(c.endTime),
//         cellText(c.observation),
//         cellText(c.result),
//       ]),
//       6,
//     ),
//   );
//   line(doc, 'Overall', rmQc.overallResult);
//   line(doc, 'Approved by', sig(rmQc.approvedBy));

//   section(doc, '3. RAW MATERIAL CONSUMPTION');
//   const cons = stages.rawMaterialConsumption ?? {};
//   const consLines = (cons.lines as Array<Record<string, unknown>>) ?? [];
//   drawTable(
//     doc,
//     [
//       { header: 'RAW MATERIAL', width: 110 },
//       { header: 'SUPPLIER BATCH', width: 90, align: 'center' },
//       { header: 'QTY', width: 50, align: 'center' },
//       { header: 'UNIT', width: 40, align: 'center' },
//       { header: 'QC DATE', width: 70, align: 'center' },
//       { header: 'REQ. SLIP', width: 70, align: 'center' },
//       { header: 'DONE BY', width: 65 },
//     ],
//     orDashRows(
//       consLines.map((l) => [
//         cellText(l.rawMaterialName),
//         cellText(l.supplierBatchNo),
//         cellText(l.quantityWithdrawn),
//         cellText(l.unit),
//         fmtDate(l.qualityCheckedDate as string),
//         cellText(l.requirementSlipNo),
//         sig(l.doneBy),
//       ]),
//       7,
//     ),
//   );

//   // —— Page 2: manufacturing + in-process + visual ——
//   doc.addPage();
//   pageBanner(doc, batch, 2);
//   section(doc, '4. MANUFACTURING');
//   const mfg = stages.manufacturing ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'PROCESS', width: 175 },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'START', width: 50, align: 'center' },
//       { header: 'END', width: 50, align: 'center' },
//       { header: 'STATUS', width: 70, align: 'center' },
//       { header: 'OPERATOR', width: 80 },
//     ],
//     [[
//       cellText(mfg.process ?? 'Needles made ready for sterilization'),
//       fmtDate(mfg.processDate as string),
//       cellText(mfg.startTime),
//       cellText(mfg.endTime),
//       cellText(mfg.status),
//       sig(mfg.operator),
//     ]],
//   );
//   line(doc, 'Remarks', mfg.remarks);

//   section(doc, '5. IN-PROCESS QC');
//   const ipqc = stages.inProcessQc ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'CHECK', width: 180 },
//       { header: 'RESULT', width: 80, align: 'center' },
//       { header: 'OBSERVATION', width: 155 },
//       { header: 'CHECKED BY', width: 80 },
//     ],
//     [
//       ['Dust free', ipqc.dustFree ? 'Yes' : 'No', cellText(ipqc.observation), sig(ipqc.qcCheckedBy ?? ipqc.checkedBy)],
//       ['Burr free', ipqc.burrFree ? 'Yes' : 'No', '', ''],
//       ['Foreign particle free', ipqc.foreignParticleFree ? 'Yes' : 'No', '', ''],
//       ['Overall', cellText(ipqc.result), '', ''],
//     ],
//   );

//   section(doc, '6. VISUAL INSPECTION');
//   const vis = stages.visualInspection ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'UNITS CHECKED', width: 80, align: 'center' },
//       { header: 'PARTICLES', width: 70, align: 'center' },
//       { header: '%', width: 50, align: 'center' },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'START', width: 50, align: 'center' },
//       { header: 'END', width: 50, align: 'center' },
//       { header: 'DONE BY', width: 125 },
//     ],
//     [[
//       cellText(vis.unitsChecked),
//       cellText(vis.particlesFound),
//       vis.particlesFoundPercent === undefined || vis.particlesFoundPercent === null
//         ? '—'
//         : String(vis.particlesFoundPercent),
//       fmtDate(vis.inspectionDate as string),
//       cellText(vis.startTime),
//       cellText(vis.endTime),
//       sig(vis.doneBy),
//     ]],
//   );

//   // —— Page 3: packing + sealing ——
//   doc.addPage();
//   pageBanner(doc, batch, 3);
//   section(doc, '7. PACKING');
//   const pack = stages.packing ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'POUCHES TAKEN', width: 80, align: 'center' },
//       { header: 'DEVICES PACKED', width: 85, align: 'center' },
//       { header: 'DAMAGED', width: 70, align: 'center' },
//       { header: 'GOOD POUCHES', width: 80, align: 'center' },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'OPERATOR', width: 110 },
//     ],
//     [[
//       cellText(pack.pouchesTaken),
//       cellText(pack.devicesPacked),
//       cellText(pack.pouchesDamaged),
//       cellText(pack.goodPouches),
//       fmtDate(pack.packingDate as string),
//       sig(pack.operator),
//     ]],
//   );

//   section(doc, '8. SEALING');
//   const seal = stages.sealing ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'SET °C', width: 55, align: 'center' },
//       { header: 'ACTUAL °C', width: 65, align: 'center' },
//       { header: 'SOP', width: 75, align: 'center' },
//       { header: 'DEVICES', width: 60, align: 'center' },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'START', width: 50, align: 'center' },
//       { header: 'END', width: 50, align: 'center' },
//       { header: 'OPERATOR', width: 70 },
//     ],
//     [[
//       cellText(seal.configuredTemperatureC ?? snap?.sealingParams?.temperatureC ?? 200),
//       cellText(seal.actualTemperatureC),
//       cellText(seal.sopRef ?? snap?.sealingParams?.sopRef ?? 'SOP/MF/011'),
//       cellText(seal.devicesSealed),
//       fmtDate(seal.sealingDate as string),
//       cellText(seal.startTime),
//       cellText(seal.endTime),
//       sig(seal.operator),
//     ]],
//   );

//   // —— Page 4: ETO + labelling ——
//   doc.addPage();
//   pageBanner(doc, batch, 4);
//   section(doc, '9. ETO STERILIZATION');
//   const ster = stages.sterilization ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'SET °C', width: 45, align: 'center' },
//       { header: 'HOURS', width: 45, align: 'center' },
//       { header: 'ETO g', width: 45, align: 'center' },
//       { header: 'SOP', width: 70, align: 'center' },
//       { header: 'QTY', width: 40, align: 'center' },
//       { header: 'MACHINE', width: 60, align: 'center' },
//       { header: 'CARTRIDGE', width: 80, align: 'center' },
//       { header: 'OPERATOR', width: 110 },
//     ],
//     [[
//       cellText(ster.configuredTemperatureC ?? snap?.sterilizationParams?.temperatureC ?? 55),
//       cellText(ster.requiredDurationHours ?? snap?.sterilizationParams?.durationHours ?? 4),
//       cellText(ster.etoCartridgeGrams ?? snap?.sterilizationParams?.etoCartridgeGrams ?? 40),
//       cellText(ster.sopRef ?? snap?.sterilizationParams?.sopRef ?? 'SOP/MF/008'),
//       cellText(ster.quantity),
//       cellText(ster.machineId),
//       cellText(ster.cartridgeBatchNo),
//       sig(ster.operator),
//     ]],
//   );
//   drawTable(
//     doc,
//     [
//       { header: 'START DATE', width: 123, align: 'center' },
//       { header: 'START', width: 124, align: 'center' },
//       { header: 'END DATE', width: 124, align: 'center' },
//       { header: 'END', width: 124, align: 'center' },
//     ],
//     [[
//       fmtDate(ster.startDate as string),
//       cellText(ster.startTime),
//       fmtDate(ster.endDate as string),
//       cellText(ster.endTime),
//     ]],
//   );

//   section(doc, '10. LABELLING');
//   const lab = stages.labelling ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'PRINTED', width: 70, align: 'center' },
//       { header: 'USED', width: 60, align: 'center' },
//       { header: 'DESTROYED', width: 75, align: 'center' },
//       { header: 'DEVICES', width: 65, align: 'center' },
//       { header: 'DONE ON', width: 75, align: 'center' },
//       { header: 'PRINTED BY', width: 150 },
//     ],
//     [[
//       cellText(lab.labelsPrinted),
//       cellText(lab.labelsUsed),
//       cellText(lab.labelsDestroyed),
//       cellText(lab.devicesLabelled),
//       fmtDate(lab.doneOn as string),
//       sig(lab.printedBy),
//     ]],
//   );

//   // —— Page 5: lab tests + release + storage ——
//   doc.addPage();
//   pageBanner(doc, batch, 5);
//   section(doc, '11. STERILITY TEST');
//   const st = stages.sterilityTest ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'SOP', width: 75, align: 'center' },
//       { header: 'REPORT NO.', width: 80, align: 'center' },
//       { header: 'RESULT', width: 60, align: 'center' },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'START', width: 50, align: 'center' },
//       { header: 'END', width: 50, align: 'center' },
//       { header: 'TESTED BY', width: 110 },
//     ],
//     [[
//       cellText(st.sopRef ?? snap?.sterilitySop ?? 'SOP/QC/004'),
//       cellText(st.reportNo),
//       cellText(st.result),
//       fmtDate((st.testDate ?? st.doneOn) as string),
//       cellText(st.startTime),
//       cellText(st.endTime),
//       sig(st.testedBy),
//     ]],
//   );

//   section(doc, '12. BACTERIAL ENDOTOXIN TEST (BET)');
//   const bet = stages.betTest ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'SOP', width: 75, align: 'center' },
//       { header: 'REPORT NO.', width: 80, align: 'center' },
//       { header: 'RESULT', width: 60, align: 'center' },
//       { header: 'DATE', width: 70, align: 'center' },
//       { header: 'START', width: 50, align: 'center' },
//       { header: 'END', width: 50, align: 'center' },
//       { header: 'TESTED BY', width: 110 },
//     ],
//     [[
//       cellText(bet.sopRef ?? snap?.betSop ?? 'SOP/QC/005'),
//       cellText(bet.reportNo),
//       cellText(bet.result),
//       fmtDate((bet.testDate ?? bet.doneOn) as string),
//       cellText(bet.startTime),
//       cellText(bet.endTime),
//       sig(bet.testedBy),
//     ]],
//   );

//   section(doc, '13. QA RELEASE');
//   const qa = stages.qaReview ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'DECISION', width: 90, align: 'center' },
//       { header: 'REVIEW NOTES', width: 255 },
//       { header: 'RELEASED BY', width: 150 },
//     ],
//     [[cellText(qa.decision), cellText(qa.reviewNotes), sig(qa.approvedBy ?? qa.reviewedBy)]],
//   );

//   section(doc, '14. FINISHED GOODS / STORAGE');
//   const fg = stages.finishedGoods ?? {};
//   drawTable(
//     doc,
//     [
//       { header: 'QUANTITY', width: 80, align: 'center' },
//       { header: 'TRANSFER DATE', width: 90, align: 'center' },
//       { header: 'STORAGE', width: 200 },
//       { header: 'TRANSFERRED BY', width: 125 },
//     ],
//     [[
//       cellText(fg.quantity),
//       fmtDate(fg.transferDate as string),
//       cellText(fg.storageCondition ?? snap?.storageCondition ?? 'Store at Room Temperature'),
//       sig(fg.transferredBy),
//     ]],
//   );

//   doc.moveDown(0.8);
//   doc.fontSize(8).fillColor('#5a6b76').text(
//     `Generated ${new Date().toLocaleString('en-GB')} · SureTech eBMR · 5 pages · Date and time columns are centered`,
//     { align: 'center', width: PAGE_W },
//   );

//   doc.end();
// }
