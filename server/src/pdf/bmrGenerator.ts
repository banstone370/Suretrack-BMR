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

export function streamBmrPdf(batch: IBatch, res: Response) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `BMR-${batch.batchNo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).fillColor('#0b4f6c').text('SURETECH MEDICAL INC.', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(13).fillColor('#14212b').text('BATCH MANUFACTURING RECORD', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#5a6b76').text('Electronic BMR — Introducer Needle workflow', {
    align: 'center',
  });
  doc.moveDown(1);

  section(doc, 'BATCH INFORMATION');
  line(doc, 'Product', batch.productName);
  line(doc, 'Catalogue No.', batch.catalogueNo);
  line(doc, 'Batch No.', batch.batchNo);
  line(doc, 'Batch Size', batch.batchSize?.toLocaleString());
  line(doc, 'Manufacturing Date', fmtDate(batch.manufacturingDate));
  line(doc, 'Expiry Date', fmtDate(batch.expiryDate));
  line(doc, 'Status', batch.status);
  line(doc, 'Revision', `R${batch.currentRevision}`);

  const stages = (batch.stages ?? {}) as Record<string, Record<string, unknown>>;
  const snap = batch.processParamsSnapshot;

  section(doc, 'RAW MATERIAL QC');
  const rmQc = stages.rawMaterialQc ?? {};
  const checks = (rmQc.checks as Array<Record<string, unknown>>) ?? [];
  if (checks.length === 0) {
    doc.text('No entries.');
  } else {
    // Same columns as the on-screen Quality Check table. Date and times are centered.
    drawTable(
      doc,
      [
        { header: 'PROCESS', width: 140, align: 'left' },
        { header: 'DATE', width: 68, align: 'center' },
        { header: 'START', width: 48, align: 'center' },
        { header: 'END', width: 48, align: 'center' },
        { header: 'OBSERVATION', width: 140, align: 'left' },
        { header: 'RESULT', width: 51, align: 'center' },
      ],
      checks.map((c) => [
        cellText(c.process),
        fmtDate(c.processDate as string),
        cellText(c.startTime),
        cellText(c.endTime),
        cellText(c.observation),
        cellText(c.result),
      ]),
    );
  }
  line(doc, 'Overall', rmQc.overallResult);
  line(doc, 'Approved by', sig(rmQc.approvedBy));

  section(doc, 'RAW MATERIAL CONSUMPTION');
  const cons = stages.rawMaterialConsumption ?? {};
  const lines = (cons.lines as Array<Record<string, unknown>>) ?? [];
  if (lines.length === 0) doc.text('No entries.');
  else {
    lines.forEach((l, i) => {
      doc.text(
        `${i + 1}. ${l.rawMaterialName} | Supplier batch ${l.supplierBatchNo} | Qty ${l.quantityWithdrawn} ${l.unit ?? ''}`,
      );
    });
  }

  section(doc, 'MANUFACTURING');
  const mfg = stages.manufacturing ?? {};
  line(doc, 'Process', mfg.process);
  line(doc, 'Date', fmtDate(mfg.processDate as string));
  line(doc, 'Start / End', `${mfg.startTime ?? '—'} – ${mfg.endTime ?? '—'}`);
  line(doc, 'Operator', sig(mfg.operator));
  line(doc, 'Remarks', mfg.remarks);

  section(doc, 'IN-PROCESS QC');
  const ipqc = stages.inProcessQc ?? {};
  line(doc, 'Dust free', ipqc.dustFree ? 'Yes' : 'No');
  line(doc, 'Burr free', ipqc.burrFree ? 'Yes' : 'No');
  line(doc, 'Foreign particle free', ipqc.foreignParticleFree ? 'Yes' : 'No');
  line(doc, 'Result', ipqc.result);
  line(doc, 'Observation', ipqc.observation);
  line(doc, 'Checked by', sig(ipqc.qcCheckedBy ?? ipqc.checkedBy));

  section(doc, 'VISUAL INSPECTION');
  const vis = stages.visualInspection ?? {};
  line(doc, 'Units checked', vis.unitsChecked);
  line(doc, 'Particles found', vis.particlesFound);
  line(doc, 'Particles %', vis.particlesFoundPercent);
  line(doc, 'Inspection date', fmtDate(vis.inspectionDate as string));
  line(doc, 'Done by', sig(vis.doneBy));

  section(doc, 'PACKING');
  const pack = stages.packing ?? {};
  line(doc, 'Pouches taken', pack.pouchesTaken);
  line(doc, 'Devices packed', pack.devicesPacked);
  line(doc, 'Pouches damaged', pack.pouchesDamaged);
  line(doc, 'Good pouches', pack.goodPouches);
  line(doc, 'Packing date', fmtDate(pack.packingDate as string));
  line(doc, 'Operator', sig(pack.operator));

  section(doc, 'SEALING');
  const seal = stages.sealing ?? {};
  line(
    doc,
    'Configured / Actual temp',
    `${seal.configuredTemperatureC ?? snap?.sealingParams?.temperatureC ?? 200}°C / ${seal.actualTemperatureC ?? '—'}°C`,
  );
  line(doc, 'SOP', seal.sopRef ?? snap?.sealingParams?.sopRef ?? 'SOP/MF/011');
  line(doc, 'Devices sealed', seal.devicesSealed);
  line(doc, 'Operator', sig(seal.operator));

  section(doc, 'ETO STERILIZATION');
  const ster = stages.sterilization ?? {};
  line(
    doc,
    'Setpoints',
    `${ster.configuredTemperatureC ?? snap?.sterilizationParams?.temperatureC ?? 55}°C / ${ster.requiredDurationHours ?? snap?.sterilizationParams?.durationHours ?? 4}h / ${ster.etoCartridgeGrams ?? snap?.sterilizationParams?.etoCartridgeGrams ?? 40}g`,
  );
  line(doc, 'SOP', ster.sopRef ?? snap?.sterilizationParams?.sopRef ?? 'SOP/MF/008');
  line(doc, 'Quantity', ster.quantity);
  line(doc, 'Machine ID', ster.machineId);
  line(doc, 'Cartridge', ster.cartridgeBatchNo);
  line(doc, 'Start', `${fmtDate(ster.startDate as string)} ${ster.startTime ?? ''}`);
  line(doc, 'End', `${fmtDate(ster.endDate as string)} ${ster.endTime ?? ''}`);
  line(doc, 'Operator', sig(ster.operator));

  section(doc, 'LABELLING');
  const lab = stages.labelling ?? {};
  line(doc, 'Printed / Used / Destroyed', `${lab.labelsPrinted ?? '—'} / ${lab.labelsUsed ?? '—'} / ${lab.labelsDestroyed ?? '—'}`);
  line(doc, 'Devices labelled', lab.devicesLabelled);
  line(doc, 'Done on', fmtDate(lab.doneOn as string));
  line(doc, 'Printed by', sig(lab.printedBy));

  section(doc, 'STERILITY TEST');
  const st = stages.sterilityTest ?? {};
  line(doc, 'SOP', st.sopRef ?? snap?.sterilitySop ?? 'SOP/QC/004');
  line(doc, 'Report No.', st.reportNo);
  line(doc, 'Result', st.result);
  line(doc, 'Test date', fmtDate((st.testDate ?? st.doneOn) as string));
  line(doc, 'Tested by', sig(st.testedBy));

  section(doc, 'BET TEST');
  const bet = stages.betTest ?? {};
  line(doc, 'SOP', bet.sopRef ?? snap?.betSop ?? 'SOP/QC/005');
  line(doc, 'Report No.', bet.reportNo);
  line(doc, 'Result', bet.result);
  line(doc, 'Test date', fmtDate((bet.testDate ?? bet.doneOn) as string));
  line(doc, 'Tested by', sig(bet.testedBy));

  section(doc, 'QA RELEASE');
  const qa = stages.qaReview ?? {};
  line(doc, 'Decision', qa.decision);
  line(doc, 'Review notes', qa.reviewNotes);
  line(doc, 'Released by', sig(qa.approvedBy ?? qa.reviewedBy));

  section(doc, 'FINISHED GOODS / STORAGE');
  const fg = stages.finishedGoods ?? {};
  line(doc, 'Quantity', fg.quantity);
  line(doc, 'Transfer date', fmtDate(fg.transferDate as string));
  line(doc, 'Storage', fg.storageCondition ?? snap?.storageCondition ?? 'Store at Room Temperature');
  line(doc, 'Transferred by', sig(fg.transferredBy));

  doc.moveDown(1.2);
  doc.fontSize(8).fillColor('#5a6b76').text(
    `Generated ${new Date().toLocaleString('en-GB')} · SureTech eBMR · Batch ${batch.batchNo}`,
    { align: 'center' },
  );

  doc.end();
}
