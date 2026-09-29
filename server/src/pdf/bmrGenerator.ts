import PDFDocument from "pdfkit";
import { Response } from "express";
import { IBatch } from "../models/Batch.js";

/**
 * INTRODUCER NEEDLE - BATCH MANUFACTURING RECORD
 * 9-page fixed-coordinate renderer matching the revised Word master.
 *
 * Master document details:
 *   SURETECH MEDICAL PVT. LTD.
 *   333 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063
 *   Doc ID: SU/BMR/026
 *   Issue No.-01
 *   Effective Date :10/12/2026
 *
 * IMPORTANT:
 * - A4 portrait, fixed coordinates.
 * - Outer border on every page.
 * - Times family is used because it visually matches the Word master closely.
 * - Page 8 is intentionally almost blank, as in the master.
 * - Footer table is PRODUCTION ENGG / QUALITY ANALYSIS on every page.
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const OUTER = { x: 24.5, y: 24.0, w: 546.25, h: 793.85 };
const BLACK = "#000000";
const WHITE = "#ffffff";

const HEADER_LEFT = 49.6;
const FOOTER_X = 45;
const FOOTER_Y = 726.65;
const FOOTER_W = 504;
const FOOTER_H = 53.7;
const FOOTER_SPLIT = 297;
const FOOTER_ROW = 757.25;

function s(v: unknown, fallback = ""): string {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v);
}

function d(v?: string | Date | null): string {
  if (!v) return "";
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB");
}

function sig(v: unknown): string {
  if (!v || typeof v !== "object") return s(v);
  const x = v as { name?: string; employeeId?: string; signedAt?: string | Date };
  if (!x.name) return "";
  return `${x.name}${x.employeeId ? ` (${x.employeeId})` : ""}${
    x.signedAt ? ` @ ${d(x.signedAt)}` : ""
  }`;
}

function times(doc: PDFKit.PDFDocument, size = 10) {
  doc.font("Times-Roman").fontSize(size).fillColor(BLACK);
}
function timesBold(doc: PDFKit.PDFDocument, size = 10) {
  doc.font("Times-Bold").fontSize(size).fillColor(BLACK);
}

function line(doc: PDFKit.PDFDocument, x1: number, y1: number, x2: number, y2: number, width = 0.55) {
  doc.save().strokeColor(BLACK).lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
}

function rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, width = 0.55) {
  doc.save().strokeColor(BLACK).lineWidth(width).rect(x, y, w, h).stroke().restore();
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

function underlinedHeading(doc: PDFKit.PDFDocument, text: string, y: number, width = 500, x = 48, size = 10.5) {
  timesBold(doc, size);
  t(doc, text, x, y, width, { align: "center", underline: true });
}

function instructionLine(doc: PDFKit.PDFDocument, text: string, y: number, x = 90.1, width = 465, underline = true) {
  timesBold(doc, 8.2);
  t(doc, text, x, y, width, { underline });
}

function beginPage(doc: PDFKit.PDFDocument, pageNo: number) {
  if (pageNo > 1) doc.addPage({ size: "A4", margin: 0 });
  rect(doc, OUTER.x, OUTER.y, OUTER.w, OUTER.h, 0.8);
  drawHeader(doc, pageNo);
}

function drawHeader(doc: PDFKit.PDFDocument, pageNo: number) {
  timesBold(doc, 10.2);
  t(doc, "SURETECH MEDICAL PVT. LTD.", 0, 37, PAGE_W, { align: "center" });

  times(doc, 8.2);
  t(doc, "333 Khurana Compound, I.B. Patel Road, Goregaon East, Mumbai-400063", 0, 51, PAGE_W, {
    align: "center",
  });

  timesBold(doc, 11.8);
  t(doc, "BATCH MANUFACTURING RECORD", 0, 76, PAGE_W, { align: "center" });

  timesBold(doc, 8.8);
  t(doc, "Doc ID:", HEADER_LEFT, 108, 50);
  times(doc, 8.8);
  t(doc, "SU/BMR/026", 88, 108, 100);

  times(doc, 8.8);
  t(doc, "Issue No.-01", HEADER_LEFT, 122, 130);
  t(doc, "Effective Date :10/12/2026", HEADER_LEFT, 136, 180);
  t(doc, `Page ${pageNo} of 9`, 455, 136, 67, { align: "right" });
}

function drawFooter(doc: PDFKit.PDFDocument) {
  rect(doc, FOOTER_X, FOOTER_Y, FOOTER_W, FOOTER_H, 0.55);
  line(doc, FOOTER_X, FOOTER_ROW, FOOTER_X + FOOTER_W, FOOTER_ROW, 0.55);
  line(doc, FOOTER_SPLIT, FOOTER_Y, FOOTER_SPLIT, FOOTER_Y + FOOTER_H, 0.55);

  timesBold(doc, 8.2);
  t(doc, "PRODUCTION ENGG", 50.5, 758.2, 230);
  t(doc, "QUALITY ANALYSIS", 303, 758.2, 230);
}

function productBlock(doc: PDFKit.PDFDocument, batch: IBatch) {
  const x = 39.7;
  const y = 156.1;
  const w = 517.5;
  const h = 126.5;
  rect(doc, x, y, w, h, 0.65);
  line(doc, x, 215.5, x + w, 215.5, 0.55);
  line(doc, x + w / 2, 215.5, x + w / 2, y + h, 0.55);

  timesBold(doc, 9.5);
  t(doc, `PRODUCT NAME: ${s(batch.productName, "INTRODUCER NEEDLE.")}`, 45, 160, 505);
  t(doc, "CATALOGUE NO. :", 45, 188, 110);
  times(doc, 9.2);
  t(doc, s(batch.catalogueNo), 147, 188, 130);

  timesBold(doc, 9.2);
  t(doc, "BATCH NO. :", 45, 220, 85);
  t(doc, "MFG / STR DATE:", 364, 220, 130);
  t(doc, "BATCH SIZE :", 45, 250, 85);
  t(doc, "EXPIRY DATE:", 369, 250, 120);

  times(doc, 9.2);
  t(doc, s(batch.batchNo), 111, 220, 140);
  t(doc, d(batch.manufacturingDate), 458, 220, 92);
  t(doc, s(batch.batchSize), 115, 250, 140);
  t(doc, d(batch.expiryDate), 458, 250, 92);
}

function grid(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  widths: number[],
  heights: number[],
  lw = 0.5,
) {
  const w = widths.reduce((a, b) => a + b, 0);
  const h = heights.reduce((a, b) => a + b, 0);
  rect(doc, x, y, w, h, lw);
  let xx = x;
  for (let i = 0; i < widths.length - 1; i++) {
    xx += widths[i];
    line(doc, xx, y, xx, y + h, lw);
  }
  let yy = y;
  for (let i = 0; i < heights.length - 1; i++) {
    yy += heights[i];
    line(doc, x, yy, x + w, yy, lw);
  }
}

function page1(doc: PDFKit.PDFDocument, batch: IBatch, stages: Record<string, any>) {
  beginPage(doc, 1);
  productBlock(doc, batch);

  underlinedHeading(doc, "QUALITY CHECKING OF RAW MATERIAL", 285.6, 500, 48, 10.4);
  underlinedHeading(doc, "GENERAL INSTRUCTION FOR QUALITY CHECKING", 314.0, 430, 82, 8.4);

  instructionLine(doc, "1. Check quality of each material as per approved specification for the respective material.", 339.7);
  instructionLine(doc, "2. Material which is approved to be used for manufacturing.", 364.2);
  times(doc, 8.0);
  t(doc, "3. Rejected material should be kept separate with appropriate status labeling", 90.1, 388.3, 450);

  const qx = 45;
  const qy = 414.05;
  const qWidths = [36, 108, 49.5, 49.5, 54, 85.5, 58.5, 72];
  const qHeights = [39.5, 25, 25, 25, 54];
  grid(doc, qx, qy, qWidths, qHeights);

  const headers = ["Sr.\nNo.", "PROCESS", "DONE\nON", "START\nTIME", "END\nTIME", "OBSERVATIO\nN/NOTE", "DONE\nBY", "CHECKED\nBY"];
  let xx = qx;
  timesBold(doc, 7.7);
  headers.forEach((h, i) => {
    t(doc, h, xx + 5, qy + 4, qWidths[i] - 8);
    xx += qWidths[i];
  });

  const qc = stages.rawMaterialQc ?? {};
  const checks = Array.isArray(qc.checks) ? qc.checks : [];
  const names = [
    "Hub checking",
    "Bevel checking",
    "Guide Wire passing",
    "Visual Inspection: -\nFor Dust, Burrs and\nForeign Particles.",
  ];
  const rowYs = [453.55, 478.55, 503.55, 528.55];
  const rowHs = [25, 25, 25, 54];
  for (let i = 0; i < 4; i++) {
    const c = checks[i] ?? {};
    const yy = rowYs[i];
    timesBold(doc, 7.5);
    t(doc, `${String(i + 1).padStart(2, "0")}.`, qx + 5, yy + 5, 28);
    t(doc, s(c.process, names[i]), qx + 42, yy + 5, 100);
    times(doc, 7.2);
    t(doc, d(c.processDate), 194, yy + 5, 40);
    t(doc, s(c.startTime), 243, yy + 5, 40);
    t(doc, s(c.endTime), 292, yy + 5, 43);
    t(doc, s(c.observation), 347, yy + 5, 75);
    t(doc, sig(c.doneBy), 432, yy + 5, 50);
    t(doc, sig(c.checkedBy), 491, yy + 5, 61);
  }

  underlinedHeading(doc, "RAW MATERIAL CONSUMPTION RECORD", 583.4, 500, 50, 10.1);
  underlinedHeading(doc, "GENERAL INSTRUCTION FOR ISSUE OF RAW MATERIAL", 610.4, 470, 72, 8.4);
  instructionLine(doc, "1. Please ensure that the area is clean and dust free.", 635.5);
  instructionLine(doc, "2. No previous batch material lying in the area", 660.0);
  instructionLine(doc, "3. Issue material on the basis of First In First out (FIFO system)", 684.5);

  drawFooter(doc);
}

function page2(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 2);

  const x = 45;
  const y = 200.45;
  const widths = [36.2, 86, 57.8, 72, 90, 54, 54, 66];
  const heights = [56.8, 25.2];
  grid(doc, x, y, widths, heights);
  const hs = ["Sr.\nNo.", "RAW\nMATERIAL\nNAME", "BATCH\nNO", "QUALITY\nCHECKED\nON", "QUANTITY\nWITHDRAWN", "REQ.\nSLIP\nNO", "DONE\nBY", "CHECKE\nD BY"];
  let xx = x;
  timesBold(doc, 7.2);
  hs.forEach((h, i) => {
    t(doc, h, xx + 4, y + 5, widths[i] - 8, { align: i === 0 ? "left" : "center" });
    xx += widths[i];
  });

  const cons = stages.rawMaterialConsumption ?? {};
  const items = Array.isArray(cons.lines) ? cons.lines : [];
  const first = items[0] ?? {};
  timesBold(doc, 7.1);
  t(doc, "01.", 50.5, 259, 28);
  t(
    doc,
    s(first.rawMaterialName, "The Introducer needle  are Purchased from other party and sent for further Processing."),
    86,
    259,
    405,
  );
  times(doc, 7.0);
  t(doc, s(first.supplierBatchNo), 171, 259, 50);
  t(doc, d(first.qualityCheckedDate), 229, 259, 64);
  t(doc, s(first.quantityWithdrawn), 301, 259, 82);
  t(doc, s(first.requirementSlipNo), 391, 259, 47);
  t(doc, sig(first.doneBy), 445, 259, 47);
  t(doc, sig(first.checkedBy), 499, 259, 57);

  underlinedHeading(doc, "MANUFACTURING PROCESS:", 307.2, 500, 48, 10.0);
  underlinedHeading(doc, "GENERAL INSTRUCTION FOR MANUFACTURING PROCESS", 334.0, 460, 70, 8.1);
  const inst = [
    "1. Ensure removal of previous lot material before start of manufacturing process for the next lot.",
    "2. Ensure that manufacturing area is cleaned as specified in the SOP",
    "3. Ensure that equipment and machines are clean.",
    "4. Ensure that the required materials for manufacturing are issued.",
    "5. Use personnel protective wear like hand gloves, nose mask before the start of the manufacturing process.",
    "6. Ensure that AHU of the manufacturing area is ON.",
    "7. Take line clearance as specified in SOP before starting the manufacturing activity",
  ];
  const ys = [358.0, 382.5, 407.0, 431.5, 456.0, 495.0, 519.5];
  inst.forEach((v, i) => instructionLine(doc, v, ys[i], 90.1, 470, true));

  underlinedHeading(doc, "RECORD FOR AREA/EQUIPMENT LINE CLEARANCE FOR MANUFACTURING PROCESS", 544.0, 490, 56, 7.8);
  timesBold(doc, 7.5);
  t(doc, "Checked by:", 90.1, 571.5, 85);
  t(doc, "Verified by", 355, 571.5, 80);

  const mx = 42;
  const my = 625.4;
  const mw = [54, 199.8, 59.9, 63, 58.5, 67.5];
  const mh = [39.5, 25];
  grid(doc, mx, my, mw, mh);
  const mHeaders = ["Sr. No.", "PROCESS", "DONE\nON", "START\nTIME", "END\nTIME", "DONE BY"];
  xx = mx;
  timesBold(doc, 7.2);
  mHeaders.forEach((h, i) => {
    t(doc, h, xx + 5, my + 5, mw[i] - 10, { align: i === 1 ? "left" : "center" });
    xx += mw[i];
  });

  const mfg = stages.manufacturing ?? {};
  timesBold(doc, 7.1);
  t(doc, "01.", mx + 5, 669, 45);
  t(doc, s(mfg.process, "The Introducer needle are Purchased from other party and sent for further Processing."), 101, 669, 188);
  times(doc, 7.0);
  t(doc, d(mfg.processDate), 300, 669, 52);
  t(doc, s(mfg.startTime), 360, 669, 52);
  t(doc, s(mfg.endTime), 423, 669, 50);
  t(doc, sig(mfg.operator ?? mfg.doneBy), 481, 669, 58);

  drawFooter(doc);
}

function page3(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 3);
  const mfg = stages.manufacturing ?? {};
  const ip = stages.inProcessQc ?? {};

  timesBold(doc, 8.0);
  t(doc, `Total quantity manufactured: ${s(mfg.totalManufactured, "______________")}`, 90.1, 172.1, 300, { underline: false });
  t(doc, `Total quantity rejected during manufacturing process.${s(mfg.totalRejected, "_______________")}`, 90.1, 196.6, 360);
  t(doc, `Verified by:${sig(mfg.verifiedBy) || "____________"}`, 90.1, 221.1, 180);

  underlinedHeading(doc, "INPROCESS QUALITY CHECKING:", 270.3, 500, 50, 10.0);

  const x = 42.5;
  const y = 310.5;
  const widths = [56, 192.5, 62.9, 128.7, 73.8];
  const heights = [39.5, 49.5];
  grid(doc, x, y, widths, heights);
  const hs = ["Sr. No.", "PROCESS", "DONE ON", "OBSERVATION /\nNOTE:", "DONE BY"];
  let xx = x;
  timesBold(doc, 7.3);
  hs.forEach((h, i) => {
    t(doc, h, xx + 5, y + 5, widths[i] - 10);
    xx += widths[i];
  });

  timesBold(doc, 7.2);
  t(doc, "1.", 48, 354, 45);
  t(doc, "The Needles are checked Free from\nDust, Burrs and Foreign Particle.", 104, 354, 178);
  times(doc, 7.1);
  t(doc, d(ip.date ?? ip.checkedOn), 296, 354, 52);
  t(doc, s(ip.observation), 359, 354, 116);
  t(doc, sig(ip.qcCheckedBy ?? ip.checkedBy), 488, 354, 62);

  timesBold(doc, 8.0);
  t(doc, `Total quantity inspected: ${s(ip.totalInspected, "______________")}`, 90.1, 426.5, 250);
  t(doc, `Total quantity rejected during quality checking process.${s(ip.totalRejected, "_______________")}`, 90.1, 451.0, 370);
  t(doc, `Total good quantity: ${s(ip.totalGood, "")}`, 90.1, 475.5, 230);
  t(doc, `Verified by: ${sig(ip.verifiedBy) || "___________"}`, 90.1, 500.0, 180);

  underlinedHeading(doc, "PACKING RECORD", 524.7, 500, 50, 10.0);
  underlinedHeading(doc, "GENERAL INSTRUCTIONS FOR PACKING PROCESS", 553.1, 430, 82, 8.2);

  const packInst = [
    "1. Follow the packing procedure as specified in the SOP.",
    "2. Ensure removal of previous lot material before start of packing process for the next lot",
    "3. Take line clearance before starting any new packing operation and carry out in process checks during packing process.",
    "4. Ensure that the area for packing is clean.as specified in the SOP.",
    "5. Ensure that the equipment required for packing process is clean.",
    "6. Use personnel protective wear like hand gloves, nose mask before the start of packing process.",
    "7. .Ensure that AHU of the packing area is ON",
  ];
  let yy = 578.8;
  times(doc, 7.1);
  for (const lineText of packInst) {
    t(doc, lineText, 108.1, yy, 438, { underline: false });
    yy += lineText.startsWith("3.") ? 27 : 15.2;
  }

  drawFooter(doc);
}

function page4(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 4);
  const pack = stages.packing ?? {};
  const seal = stages.sealing ?? {};

  underlinedHeading(doc, "RECORD FOR LINE CLEARANCE FOR PACKING PROCESS", 172.2, 500, 50, 8.2);
  timesBold(doc, 7.5);
  t(doc, "Checked by:", 90.1, 223.4, 100);
  t(doc, "Verified by", 290, 223.4, 80);

  const px = 84.6;
  const py = 249.2;
  const pw = [49.7, 60.5, 72.8, 72.8, 72.1, 53.9, 62.5];
  const ph = [54, 31.5];
  grid(doc, px, py, pw, ph);
  const phs = ["Sr. No.", "Date of\npacking", "Quantity Of\nPouch\nTaken", "Quantity Of\nDevice\nPacked", "No. Of\nPouches\nDamaged", "Done by", "Checked\nby"];
  let xx = px;
  timesBold(doc, 6.8);
  phs.forEach((h, i) => {
    t(doc, h, xx + 4, py + 5, pw[i] - 8, { align: "center" });
    xx += pw[i];
  });
  times(doc, 6.9);
  t(doc, d(pack.packingDate), 139, 307, 50);
  t(doc, s(pack.pouchesTaken), 202, 307, 58);
  t(doc, s(pack.devicesPacked), 274, 307, 58);
  t(doc, s(pack.pouchesDamaged), 346, 307, 58);
  t(doc, sig(pack.operator ?? pack.doneBy), 414, 307, 49);
  t(doc, sig(pack.checkedBy), 468, 307, 56);

  underlinedHeading(doc, "SEALING RECORD", 360.0, 500, 50, 10.0);
  underlinedHeading(doc, "GENERAL INSTRUCTIONS FOR SEALING PROCESS", 388.4, 430, 82, 8.0);
  times(doc, 7.1);
  t(doc, "1.  At 200°C For Paper Pouch, Operation done As Per SOP/MF/009", 108.1, 414.1, 440);
  t(doc, "2.  At 150°C For Tyvek Pouch, Operation done As Per SOP/MF/009", 108.1, 429.0, 440);
  t(doc, "3.  Ensure removal of previous lot material before start of sealing process for the next lot", 108.1, 443.9, 440);

  underlinedHeading(doc, "RECORD FOR LINE CLEARANCE FOR SEALING PROCESS", 464.7, 470, 64, 7.8);
  timesBold(doc, 7.5);
  t(doc, "Checked by :", 90.1, 513.7, 100);
  t(doc, "Verified by", 312, 513.7, 80);

  const sx = 85.5;
  const sy = 562.6;
  const sw = [54, 57.4, 82.1, 94.5, 72, 72];
  const sh = [57.6, 31.5];
  grid(doc, sx, sy, sw, sh);
  const shs = ["Sr. No.", "Date of\nsealing", "Quantity Of\nDevises Sealed", "Total Damages\nIn The Process", "Done by", "Checked by"];
  xx = sx;
  timesBold(doc, 6.8);
  shs.forEach((h, i) => {
    t(doc, h, xx + 4, sy + 6, sw[i] - 8, { align: "center" });
    xx += sw[i];
  });
  times(doc, 6.9);
  t(doc, d(seal.sealingDate), 144, 624, 48);
  t(doc, s(seal.devicesSealed), 202, 624, 71);
  t(doc, s(seal.totalDamages ?? seal.damages), 285, 624, 82);
  t(doc, sig(seal.operator ?? seal.doneBy), 380, 624, 60);
  t(doc, sig(seal.checkedBy), 451, 624, 61);

  underlinedHeading(doc, "VISUAL INSPECTION FOR DUST/FOREIGN PARTICLES", 678.0, 500, 50, 8.3);
  drawFooter(doc);
}

function page5(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 5);
  const vis = stages.visualInspection ?? {};
  const ster = stages.sterilization ?? {};

  times(doc, 7.1);
  t(doc, "1.   Carry out visual inspection process as specified in the SOP.", 108.1, 196.0, 440);
  t(doc, "2.   Ensure removal of previous lot material before start of visual inspection process for the next lot", 108.1, 211.0, 440);
  underlinedHeading(doc, "RECORD FOR LINE CLEARANCE FOR VISUAL INSPECTION PROCESS", 220.0, 470, 64, 7.8);
  timesBold(doc, 7.4);
  t(doc, "Checked by:", 90.1, 245.0, 100);
  t(doc, "Verified by", 312, 245.0, 80);

  const vx = 84.6;
  const vy = 279.8;
  const vw = [59.4, 72, 58.5, 72, 63, 53.4, 55.5];
  const vh = [83, 38.3];
  grid(doc, vx, vy, vw, vh);
  const vhs = ["Sr.No.", "Date of\nvisual\ninspection", "Total\nnumber\nof units\nchecked", "Number of\nunits with\nwhite\nparticles\nfound", "Total\nnumber of\ngood units\nfound", "Done by", "Checked\nby"];
  let xx = vx;
  timesBold(doc, 6.5);
  vhs.forEach((h, i) => {
    t(doc, h, xx + 4, vy + 6, vw[i] - 8, { align: "center" });
    xx += vw[i];
  });
  times(doc, 6.9);
  t(doc, d(vis.inspectionDate), 149, 366, 60);
  t(doc, s(vis.unitsChecked), 222, 366, 48);
  t(doc, s(vis.particlesFound), 281, 366, 62);
  t(doc, s(vis.goodUnits ?? vis.totalGood), 352, 366, 52);
  t(doc, sig(vis.doneBy), 415, 366, 44);
  t(doc, sig(vis.checkedBy), 468, 366, 46);

  underlinedHeading(doc, "STERILIZATION RECORD", 422.0, 500, 50, 10.0);
  underlinedHeading(doc, "GENERAL INSTRUCTIONS FOR STERILIZATION PROCESS", 448.4, 450, 74, 8.0);
  times(doc, 7.1);
  t(doc, "1.   Carry out sterilization process as specified in the SOP.", 108.1, 474.0, 440);
  t(doc, "2.   Ensure removal of previous lot material from the sterilizer before start of sterilization of the next lot.", 108.1, 489.0, 440);
  t(doc, "3.   verify the certificate of analysis of ETO cartridge", 108.1, 519.0, 440);

  underlinedHeading(doc, "RECORD FOR LINE CLEARANCE FOR THE ETO STERILIZER", 549.0, 450, 74, 8.0);
  timesBold(doc, 7.4);
  t(doc, "Checked by:", 90.1, 599.5, 100);
  t(doc, "Verified by", 312, 599.5, 80);

  times(doc, 7.2);
  t(doc, "ETO sterilization process parameters", 90.1, 628.5, 230);
  timesBold(doc, 7.2);
  t(doc, `ETO STERILIZATION AT ${s(ster.configuredTemperatureC, "55")}°C, for ${s(ster.requiredDurationHours, "4")}hrs`, 90.1, 651.5, 300);

  drawFooter(doc);
}

function page6(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 6);
  const ster = stages.sterilization ?? {};
  const lab = stages.labelling ?? {};

  timesBold(doc, 7.8);
  t(doc, `${s(ster.etoCartridgeGrams, "40")}gm ETO gas cartridge used per lot`, 90.1, 172.1, 250);
  t(doc, `OPERATION OF ETO MACHINE AS PER ${s(ster.sopRef, "SOP/MF/007")}`, 90.1, 196.6, 300);

  const ex = 49.5;
  const ey = 220.95;
  const ew = [54, 99, 90, 85.5, 99, 72];
  const eh = [39.5, 74];
  grid(doc, ex, ey, ew, eh);
  const ehs = ["DATE", "QUANTITY", "START TIME", "END TIME", "OPERATOR", "CHECKED\nBY"];
  let xx = ex;
  timesBold(doc, 6.9);
  ehs.forEach((h, i) => {
    t(doc, h, xx + 4, ey + 5, ew[i] - 8, { align: "center" });
    xx += ew[i];
  });
  times(doc, 7.0);
  t(doc, d(ster.startDate ?? ster.date), 54, 266, 44);
  t(doc, s(ster.quantity), 108, 266, 89);
  t(doc, s(ster.startTime), 207, 266, 80);
  t(doc, s(ster.endTime), 297, 266, 76);
  t(doc, sig(ster.operator), 383, 266, 88);
  t(doc, sig(ster.checkedBy), 482, 266, 62);

  underlinedHeading(doc, "ETO CARTRIDGE DETAILS", 334.7, 500, 50, 8.2);
  const cx = 49.5;
  const cy = 360.5;
  const cw = [167.3, 169.9, 150.9];
  const ch = [25, 49.5];
  grid(doc, cx, cy, cw, ch);
  timesBold(doc, 7.0);
  t(doc, "BATCH NO", 55, 365, 150);
  t(doc, "RECEIVED ON", 223, 365, 155);
  t(doc, "EXPIRY DATE", 393, 365, 138);
  times(doc, 7.0);
  t(doc, s(ster.cartridgeBatchNo), 55, 393, 150);
  t(doc, d(ster.cartridgeReceivedOn), 223, 393, 155);
  t(doc, d(ster.cartridgeExpiryDate), 393, 393, 138);

  underlinedHeading(doc, "BATCH LABELLING RECORD", 460.3, 500, 50, 10.0);
  underlinedHeading(doc, "GENERAL INSTRUCTIONS FOR LABELLING PROCESS", 488.7, 430, 82, 8.0);
  times(doc, 7.1);
  t(doc, "1.   Carry out labeling process as specified in the SOP.", 108.1, 514.4, 440);
  t(doc, "2.   Ensure removal of previous lot material from the labeling area before start of labeling of the next lot.", 108.1, 529.4, 440);
  t(doc, "3.   Verify the correct labels and its required quantity is received.", 108.1, 559.4, 440);

  underlinedHeading(doc, "RECORD FOR LINE CLEARANCE FOR THE LABELLING PROCESS", 589.6, 470, 64, 7.8);
  timesBold(doc, 7.4);
  t(doc, "Checked by:", 90.1, 615.4, 100);
  t(doc, "Verified by", 312, 615.4, 80);

  underlinedHeading(doc, "RECORD OF LABELLING ACTIVITY", 668.6, 500, 50, 9.0);
  timesBold(doc, 7.5);
  t(doc, "LABELS PRINTED BY:", 90.1, 696.9, 140);
  t(doc, sig(lab.printedBy), 190, 696.9, 95);
  t(doc, "NO. OF LABELS PRINTED:", 350, 696.9, 155);
  times(doc, 7.5);
  t(doc, s(lab.labelsPrinted), 505, 696.9, 42);

  drawFooter(doc);
}

function page7(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 7);
  const lab = stages.labelling ?? {};
  const st = stages.sterilityTest ?? {};
  const bet = stages.betTest ?? {};
  const fg = stages.finishedGoods ?? {};

  timesBold(doc, 7.5);
  t(doc, "NO. OF DEVICES LABELLED:", 90.1, 172.1, 150);
  times(doc, 7.5);
  t(doc, s(lab.devicesLabelled), 225, 172.1, 80);
  timesBold(doc, 7.5);
  t(doc, "NO. OF LABELS DESTROYED:", 350, 172.1, 155);
  times(doc, 7.5);
  t(doc, s(lab.labelsDestroyed), 510, 172.1, 38);
  timesBold(doc, 7.5);
  t(doc, "DONE ON:", 90.1, 196.6, 70);
  times(doc, 7.5);
  t(doc, d(lab.doneOn), 147, 196.6, 100);
  timesBold(doc, 7.5);
  t(doc, "Checked by", 90.1, 221.1, 80);
  t(doc, sig(lab.checkedBy), 150, 221.1, 140);
  t(doc, "Verified by", 340, 221.1, 80);
  t(doc, sig(lab.verifiedBy), 408, 221.1, 130);

  underlinedHeading(doc, "STERILITY TEST RECORD", 245.8, 500, 50, 10.0);
  timesBold(doc, 7.5);
  t(doc, `AS PER SOP NO. ${s(st.sopRef, "SOP/QC/018")}`, 90.1, 274.1, 210);
  t(doc, "SAMPLE QUANTITY:", 390, 274.1, 105);
  times(doc, 7.5);
  t(doc, s(st.sampleQuantity), 492, 274.1, 55);
  timesBold(doc, 7.5);
  t(doc, "DONE ON:", 166.9, 298.6, 75);
  t(doc, "REPORT NO:", 390, 298.6, 80);
  t(doc, "RESULT:", 162.2, 323.1, 70);
  t(doc, "CHECKED BY:", 390, 323.1, 90);
  times(doc, 7.5);
  t(doc, d(st.testDate ?? st.doneOn), 225, 298.6, 130);
  t(doc, s(st.reportNo), 468, 298.6, 75);
  t(doc, s(st.result), 225, 323.1, 130);
  t(doc, sig(st.checkedBy), 468, 323.1, 75);

  underlinedHeading(doc, "BET TEST RECORD", 347.8, 500, 50, 10.0);
  timesBold(doc, 7.5);
  t(doc, `AS PER SOP NO.-${s(bet.sopRef, "SOP/QC/026")}`, 90.1, 404.6, 230);
  t(doc, "SAMPLE QUANTITY:", 390, 404.6, 105);
  times(doc, 7.5);
  t(doc, s(bet.sampleQuantity), 492, 404.6, 55);
  timesBold(doc, 7.5);
  t(doc, "DONE ON:", 166.9, 429.1, 75);
  t(doc, "REPORT NO:", 390, 429.1, 80);
  t(doc, "RESULT:", 162.2, 453.6, 70);
  t(doc, "CHECKED BY:", 390, 453.6, 90);
  times(doc, 7.5);
  t(doc, d(bet.testDate ?? bet.doneOn), 225, 429.1, 130);
  t(doc, s(bet.reportNo), 468, 429.1, 75);
  t(doc, s(bet.result), 225, 453.6, 130);
  t(doc, sig(bet.checkedBy), 468, 453.6, 75);

  underlinedHeading(doc, "BATCH PACKING RECORD", 502.8, 500, 50, 10.0);
  underlinedHeading(doc, "AFTER COMPLIANCE MATERIAL SHIFTED TO FINISHED GOODS", 531.1, 450, 74, 7.6);
  timesBold(doc, 7.5);
  t(doc, "NO. OF FINISHED PRODUCTS:", 90.1, 580.1, 165);
  t(doc, "DATE OF TRANSFER TO F.G", 350, 580.1, 145);
  times(doc, 7.5);
  t(doc, s(fg.quantity), 240, 580.1, 80);
  t(doc, d(fg.transferDate), 492, 580.1, 55);
  timesBold(doc, 7.5);
  t(doc, "Finished goods transfer note number and date", 90.1, 604.6, 220, { underline: true });
  times(doc, 7.5);
  t(doc, s(fg.transferNoteNo ?? fg.transferNote), 315, 604.6, 220);

  timesBold(doc, 8.6);
  t(doc, "LABEL OF THE PRODUCT :-", 90.1, 686.3, 190, { underline: true });
  drawFooter(doc);
}

function page8(doc: PDFKit.PDFDocument) {
  beginPage(doc, 8);
  // The Word master deliberately leaves almost the whole page blank.
  underlinedHeading(doc, "MATERIAL DISPATCH RECORD", 685.3, 500, 50, 10.0);
  drawFooter(doc);
}

function page9(doc: PDFKit.PDFDocument, stages: Record<string, any>) {
  beginPage(doc, 9);
  const dispatch = stages.materialDispatch ?? stages.dispatch ?? {};
  const rows = Array.isArray(dispatch.rows)
    ? dispatch.rows
    : Array.isArray(dispatch.records)
      ? dispatch.records
      : [];

  const x = 49.5;
  const y = 197.8;
  const widths = [252.9, 85.5, 76.5, 85.5];
  const heights = [39.5, 48.4, 48.4, 48.4, 48.4, 48.4, 48.4, 48.4];
  grid(doc, x, y, widths, heights);
  timesBold(doc, 7.2);
  t(doc, "NAME OF CUSTOMER", 55, 202, 235);
  t(doc, "BILL NO.", 308, 202, 72);
  t(doc, "DATE OF\nDISPATCH", 393, 202, 64);
  t(doc, "QTY\nDISPATCHED", 470, 202, 72);

  const rowTop = [241.5, 289.9, 338.3, 386.7, 435.1, 483.5, 531.9];
  for (let i = 0; i < rowTop.length; i++) {
    const r = rows[i] ?? {};
    times(doc, 7.4);
    t(doc, s(r.customerName ?? r.nameOfCustomer), 55, rowTop[i] + 5, 240);
    t(doc, s(r.billNo), 308, rowTop[i] + 5, 72);
    t(doc, d(r.dispatchDate ?? r.dateOfDispatch), 393, rowTop[i] + 5, 64);
    t(doc, s(r.quantityDispatched ?? r.quantity), 470, rowTop[i] + 5, 72);
  }

  timesBold(doc, 7.8);
  t(doc, "Authorized Signatory", 72.1, 659.8, 150, { align: "center" });
  t(doc, "(PRODUCTION ENGG)", 72.1, 674.0, 150, { align: "center" });

  drawFooter(doc);
}

export function streamBmrPdf(batch: IBatch, res: Response) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `BMR - ${batch.batchNo ?? "Introducer Needle"}`,
      Author: "Suretech Medical Pvt. Ltd.",
      Subject: "Batch Manufacturing Record - Introducer Needle",
    },
  });

  const safeBatch = String(batch.batchNo || "INTRODUCER-NEEDLE").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `BMR-${safeBatch}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  const stages = (batch.stages ?? {}) as Record<string, any>;

  page1(doc, batch, stages);
  page2(doc, stages);
  page3(doc, stages);
  page4(doc, stages);
  page5(doc, stages);
  page6(doc, stages);
  page7(doc, stages);
  page8(doc);
  page9(doc, stages);

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
