import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { IBatch } from '../models/Batch.js';

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  doc.fontSize(11).fillColor('#0b4f6c').text(title, { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#14212b');
}

function line(doc: PDFKit.PDFDocument, label: string, value: unknown) {
  const text = value === undefined || value === null || value === '' ? '—' : String(value);
  doc.text(`${label}: ${text}`);
}

function fmtDate(value?: Date | string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB');
}

type Col = {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
};

function cellText(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

/** Draws a bordered table. Date/time columns should use align: 'center'. */
function drawTable(
  doc: PDFKit.PDFDocument,
  columns: Col[],
  rows: string[][],
) {
  const startX = doc.page.margins.left;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const headerH = 18;
  const pad = 3;

  const paintHeader = (y: number) => {
    let x = startX;
    doc.save();
    doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), headerH).fill('#e8f4f8');
    doc.restore();
    doc.fontSize(7).fillColor('#0b4f6c');
    for (const col of columns) {
      doc.text(col.header, x + pad, y + 5, {
        width: col.width - pad * 2,
        align: col.align ?? 'left',
        lineBreak: false,
      });
      x += col.width;
    }
    doc.strokeColor('#d5dee5').lineWidth(0.4);
    x = startX;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    doc.rect(startX, y, totalW, headerH).stroke();
    for (const col of columns) {
      x += col.width;
      doc.moveTo(x, y).lineTo(x, y + headerH).stroke();
    }
    return y + headerH;
  };

  let y = doc.y;
  if (y + headerH + 20 > pageBottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y = paintHeader(y);

  doc.fontSize(8).fillColor('#14212b');
  for (const row of rows) {
    const heights = row.map((text, i) =>
      doc.heightOfString(cellText(text), { width: columns[i].width - pad * 2 }),
    );
    const rowH = Math.max(16, ...heights) + 6;
    if (y + rowH > pageBottom) {
      doc.addPage();
      y = paintHeader(doc.page.margins.top);
    }
    let x = startX;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    doc.strokeColor('#d5dee5').lineWidth(0.4);
    doc.rect(startX, y, totalW, rowH).stroke();
    row.forEach((text, i) => {
      const col = columns[i];
      doc.fillColor('#14212b').text(cellText(text), x + pad, y + 4, {
        width: col.width - pad * 2,
        align: col.align ?? 'left',
      });
      x += col.width;
      if (i < row.length - 1) {
        doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
      }
    });
    y += rowH;
  }
  doc.y = y + 6;
  doc.x = startX;
}

function sig(value: unknown) {
  if (!value || typeof value !== 'object') return '—';
  const s = value as { name?: string; employeeId?: string; signedAt?: string | Date };
  if (!s.name) return '—';
  return `${s.name}${s.employeeId ? ` (${s.employeeId})` : ''}${
    s.signedAt ? ` @ ${fmtDate(s.signedAt)}` : ''
  }`;
}

const PAGE_W = 495;

function pageBanner(doc: PDFKit.PDFDocument, batch: IBatch, page: number) {
  doc.fontSize(13).fillColor('#0b4f6c').text('SURETECH MEDICAL INC.', { align: 'center' });
  doc.fontSize(11).fillColor('#14212b').text('BATCH MANUFACTURING RECORD', { align: 'center' });
  doc.fontSize(8).fillColor('#5a6b76').text(
    `${batch.productName}  ·  Cat. ${batch.catalogueNo}  ·  Batch ${batch.batchNo}  ·  Page ${page} of 5`,
    { align: 'center' },
  );
  doc.moveDown(0.4);
  doc.fillColor('#14212b');
}

function orDashRows(rows: string[][], cols: number): string[][] {
  if (rows.length > 0) return rows;
  return [Array.from({ length: cols }, () => '—')];
}

export function streamBmrPdf(batch: IBatch, res: Response) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `BMR-${batch.batchNo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const stages = (batch.stages ?? {}) as Record<string, Record<string, unknown>>;
  const snap = batch.processParamsSnapshot;

  // —— Page 1: identity + raw material ——
  pageBanner(doc, batch, 1);
  section(doc, '1. BATCH INFORMATION');
  drawTable(
    doc,
    [
      { header: 'PRODUCT', width: 120 },
      { header: 'CATALOGUE NO.', width: 80, align: 'center' },
      { header: 'BATCH NO.', width: 80, align: 'center' },
      { header: 'BATCH SIZE', width: 70, align: 'center' },
      { header: 'MFG DATE', width: 72, align: 'center' },
      { header: 'EXPIRY', width: 73, align: 'center' },
    ],
    [[
      cellText(batch.productName),
      cellText(batch.catalogueNo),
      cellText(batch.batchNo),
      cellText(batch.batchSize?.toLocaleString()),
      fmtDate(batch.manufacturingDate),
      fmtDate(batch.expiryDate),
    ]],
  );

  section(doc, '2. RAW MATERIAL QUALITY CHECK');
  const rmQc = stages.rawMaterialQc ?? {};
  const checks = (rmQc.checks as Array<Record<string, unknown>>) ?? [];
  drawTable(
    doc,
    [
      { header: 'PROCESS', width: 140 },
      { header: 'DATE', width: 68, align: 'center' },
      { header: 'START', width: 48, align: 'center' },
      { header: 'END', width: 48, align: 'center' },
      { header: 'OBSERVATION', width: 140 },
      { header: 'RESULT', width: 51, align: 'center' },
    ],
    orDashRows(
      checks.map((c) => [
        cellText(c.process),
        fmtDate(c.processDate as string),
        cellText(c.startTime),
        cellText(c.endTime),
        cellText(c.observation),
        cellText(c.result),
      ]),
      6,
    ),
  );
  line(doc, 'Overall', rmQc.overallResult);
  line(doc, 'Approved by', sig(rmQc.approvedBy));

  section(doc, '3. RAW MATERIAL CONSUMPTION');
  const cons = stages.rawMaterialConsumption ?? {};
  const consLines = (cons.lines as Array<Record<string, unknown>>) ?? [];
  drawTable(
    doc,
    [
      { header: 'RAW MATERIAL', width: 110 },
      { header: 'SUPPLIER BATCH', width: 90, align: 'center' },
      { header: 'QTY', width: 50, align: 'center' },
      { header: 'UNIT', width: 40, align: 'center' },
      { header: 'QC DATE', width: 70, align: 'center' },
      { header: 'REQ. SLIP', width: 70, align: 'center' },
      { header: 'DONE BY', width: 65 },
    ],
    orDashRows(
      consLines.map((l) => [
        cellText(l.rawMaterialName),
        cellText(l.supplierBatchNo),
        cellText(l.quantityWithdrawn),
        cellText(l.unit),
        fmtDate(l.qualityCheckedDate as string),
        cellText(l.requirementSlipNo),
        sig(l.doneBy),
      ]),
      7,
    ),
  );

  // —— Page 2: manufacturing + in-process + visual ——
  doc.addPage();
  pageBanner(doc, batch, 2);
  section(doc, '4. MANUFACTURING');
  const mfg = stages.manufacturing ?? {};
  drawTable(
    doc,
    [
      { header: 'PROCESS', width: 175 },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'START', width: 50, align: 'center' },
      { header: 'END', width: 50, align: 'center' },
      { header: 'STATUS', width: 70, align: 'center' },
      { header: 'OPERATOR', width: 80 },
    ],
    [[
      cellText(mfg.process ?? 'Needles made ready for sterilization'),
      fmtDate(mfg.processDate as string),
      cellText(mfg.startTime),
      cellText(mfg.endTime),
      cellText(mfg.status),
      sig(mfg.operator),
    ]],
  );
  line(doc, 'Remarks', mfg.remarks);

  section(doc, '5. IN-PROCESS QC');
  const ipqc = stages.inProcessQc ?? {};
  drawTable(
    doc,
    [
      { header: 'CHECK', width: 180 },
      { header: 'RESULT', width: 80, align: 'center' },
      { header: 'OBSERVATION', width: 155 },
      { header: 'CHECKED BY', width: 80 },
    ],
    [
      ['Dust free', ipqc.dustFree ? 'Yes' : 'No', cellText(ipqc.observation), sig(ipqc.qcCheckedBy ?? ipqc.checkedBy)],
      ['Burr free', ipqc.burrFree ? 'Yes' : 'No', '', ''],
      ['Foreign particle free', ipqc.foreignParticleFree ? 'Yes' : 'No', '', ''],
      ['Overall', cellText(ipqc.result), '', ''],
    ],
  );

  section(doc, '6. VISUAL INSPECTION');
  const vis = stages.visualInspection ?? {};
  drawTable(
    doc,
    [
      { header: 'UNITS CHECKED', width: 80, align: 'center' },
      { header: 'PARTICLES', width: 70, align: 'center' },
      { header: '%', width: 50, align: 'center' },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'START', width: 50, align: 'center' },
      { header: 'END', width: 50, align: 'center' },
      { header: 'DONE BY', width: 125 },
    ],
    [[
      cellText(vis.unitsChecked),
      cellText(vis.particlesFound),
      vis.particlesFoundPercent === undefined || vis.particlesFoundPercent === null
        ? '—'
        : String(vis.particlesFoundPercent),
      fmtDate(vis.inspectionDate as string),
      cellText(vis.startTime),
      cellText(vis.endTime),
      sig(vis.doneBy),
    ]],
  );

  // —— Page 3: packing + sealing ——
  doc.addPage();
  pageBanner(doc, batch, 3);
  section(doc, '7. PACKING');
  const pack = stages.packing ?? {};
  drawTable(
    doc,
    [
      { header: 'POUCHES TAKEN', width: 80, align: 'center' },
      { header: 'DEVICES PACKED', width: 85, align: 'center' },
      { header: 'DAMAGED', width: 70, align: 'center' },
      { header: 'GOOD POUCHES', width: 80, align: 'center' },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'OPERATOR', width: 110 },
    ],
    [[
      cellText(pack.pouchesTaken),
      cellText(pack.devicesPacked),
      cellText(pack.pouchesDamaged),
      cellText(pack.goodPouches),
      fmtDate(pack.packingDate as string),
      sig(pack.operator),
    ]],
  );

  section(doc, '8. SEALING');
  const seal = stages.sealing ?? {};
  drawTable(
    doc,
    [
      { header: 'SET °C', width: 55, align: 'center' },
      { header: 'ACTUAL °C', width: 65, align: 'center' },
      { header: 'SOP', width: 75, align: 'center' },
      { header: 'DEVICES', width: 60, align: 'center' },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'START', width: 50, align: 'center' },
      { header: 'END', width: 50, align: 'center' },
      { header: 'OPERATOR', width: 70 },
    ],
    [[
      cellText(seal.configuredTemperatureC ?? snap?.sealingParams?.temperatureC ?? 200),
      cellText(seal.actualTemperatureC),
      cellText(seal.sopRef ?? snap?.sealingParams?.sopRef ?? 'SOP/MF/011'),
      cellText(seal.devicesSealed),
      fmtDate(seal.sealingDate as string),
      cellText(seal.startTime),
      cellText(seal.endTime),
      sig(seal.operator),
    ]],
  );

  // —— Page 4: ETO + labelling ——
  doc.addPage();
  pageBanner(doc, batch, 4);
  section(doc, '9. ETO STERILIZATION');
  const ster = stages.sterilization ?? {};
  drawTable(
    doc,
    [
      { header: 'SET °C', width: 45, align: 'center' },
      { header: 'HOURS', width: 45, align: 'center' },
      { header: 'ETO g', width: 45, align: 'center' },
      { header: 'SOP', width: 70, align: 'center' },
      { header: 'QTY', width: 40, align: 'center' },
      { header: 'MACHINE', width: 60, align: 'center' },
      { header: 'CARTRIDGE', width: 80, align: 'center' },
      { header: 'OPERATOR', width: 110 },
    ],
    [[
      cellText(ster.configuredTemperatureC ?? snap?.sterilizationParams?.temperatureC ?? 55),
      cellText(ster.requiredDurationHours ?? snap?.sterilizationParams?.durationHours ?? 4),
      cellText(ster.etoCartridgeGrams ?? snap?.sterilizationParams?.etoCartridgeGrams ?? 40),
      cellText(ster.sopRef ?? snap?.sterilizationParams?.sopRef ?? 'SOP/MF/008'),
      cellText(ster.quantity),
      cellText(ster.machineId),
      cellText(ster.cartridgeBatchNo),
      sig(ster.operator),
    ]],
  );
  drawTable(
    doc,
    [
      { header: 'START DATE', width: 123, align: 'center' },
      { header: 'START', width: 124, align: 'center' },
      { header: 'END DATE', width: 124, align: 'center' },
      { header: 'END', width: 124, align: 'center' },
    ],
    [[
      fmtDate(ster.startDate as string),
      cellText(ster.startTime),
      fmtDate(ster.endDate as string),
      cellText(ster.endTime),
    ]],
  );

  section(doc, '10. LABELLING');
  const lab = stages.labelling ?? {};
  drawTable(
    doc,
    [
      { header: 'PRINTED', width: 70, align: 'center' },
      { header: 'USED', width: 60, align: 'center' },
      { header: 'DESTROYED', width: 75, align: 'center' },
      { header: 'DEVICES', width: 65, align: 'center' },
      { header: 'DONE ON', width: 75, align: 'center' },
      { header: 'PRINTED BY', width: 150 },
    ],
    [[
      cellText(lab.labelsPrinted),
      cellText(lab.labelsUsed),
      cellText(lab.labelsDestroyed),
      cellText(lab.devicesLabelled),
      fmtDate(lab.doneOn as string),
      sig(lab.printedBy),
    ]],
  );

  // —— Page 5: lab tests + release + storage ——
  doc.addPage();
  pageBanner(doc, batch, 5);
  section(doc, '11. STERILITY TEST');
  const st = stages.sterilityTest ?? {};
  drawTable(
    doc,
    [
      { header: 'SOP', width: 75, align: 'center' },
      { header: 'REPORT NO.', width: 80, align: 'center' },
      { header: 'RESULT', width: 60, align: 'center' },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'START', width: 50, align: 'center' },
      { header: 'END', width: 50, align: 'center' },
      { header: 'TESTED BY', width: 110 },
    ],
    [[
      cellText(st.sopRef ?? snap?.sterilitySop ?? 'SOP/QC/004'),
      cellText(st.reportNo),
      cellText(st.result),
      fmtDate((st.testDate ?? st.doneOn) as string),
      cellText(st.startTime),
      cellText(st.endTime),
      sig(st.testedBy),
    ]],
  );

  section(doc, '12. BACTERIAL ENDOTOXIN TEST (BET)');
  const bet = stages.betTest ?? {};
  drawTable(
    doc,
    [
      { header: 'SOP', width: 75, align: 'center' },
      { header: 'REPORT NO.', width: 80, align: 'center' },
      { header: 'RESULT', width: 60, align: 'center' },
      { header: 'DATE', width: 70, align: 'center' },
      { header: 'START', width: 50, align: 'center' },
      { header: 'END', width: 50, align: 'center' },
      { header: 'TESTED BY', width: 110 },
    ],
    [[
      cellText(bet.sopRef ?? snap?.betSop ?? 'SOP/QC/005'),
      cellText(bet.reportNo),
      cellText(bet.result),
      fmtDate((bet.testDate ?? bet.doneOn) as string),
      cellText(bet.startTime),
      cellText(bet.endTime),
      sig(bet.testedBy),
    ]],
  );

  section(doc, '13. QA RELEASE');
  const qa = stages.qaReview ?? {};
  drawTable(
    doc,
    [
      { header: 'DECISION', width: 90, align: 'center' },
      { header: 'REVIEW NOTES', width: 255 },
      { header: 'RELEASED BY', width: 150 },
    ],
    [[cellText(qa.decision), cellText(qa.reviewNotes), sig(qa.approvedBy ?? qa.reviewedBy)]],
  );

  section(doc, '14. FINISHED GOODS / STORAGE');
  const fg = stages.finishedGoods ?? {};
  drawTable(
    doc,
    [
      { header: 'QUANTITY', width: 80, align: 'center' },
      { header: 'TRANSFER DATE', width: 90, align: 'center' },
      { header: 'STORAGE', width: 200 },
      { header: 'TRANSFERRED BY', width: 125 },
    ],
    [[
      cellText(fg.quantity),
      fmtDate(fg.transferDate as string),
      cellText(fg.storageCondition ?? snap?.storageCondition ?? 'Store at Room Temperature'),
      sig(fg.transferredBy),
    ]],
  );

  doc.moveDown(0.8);
  doc.fontSize(8).fillColor('#5a6b76').text(
    `Generated ${new Date().toLocaleString('en-GB')} · SureTech eBMR · 5 pages · Date and time columns are centered`,
    { align: 'center', width: PAGE_W },
  );

  doc.end();
}
