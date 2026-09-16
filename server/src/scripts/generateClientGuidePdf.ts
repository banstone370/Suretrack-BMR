/**
 * Generates a client-facing system explanation PDF.
 * Run: npx tsx src/scripts/generateClientGuidePdf.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../docs');
const outFile = path.join(outDir, 'SureTech-eBMR-Client-System-Guide.pdf');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
const stream = fs.createWriteStream(outFile);
doc.pipe(stream);

function h1(text: string) {
  doc.moveDown(0.4);
  doc.fontSize(16).fillColor('#0b4f6c').text(text, { underline: true });
  doc.moveDown(0.35);
  doc.fontSize(10).fillColor('#14212b');
}

function h2(text: string) {
  doc.moveDown(0.35);
  doc.fontSize(12).fillColor('#0e6288').text(text);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#14212b');
}

function p(text: string) {
  doc.fontSize(10).fillColor('#14212b').text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.35);
}

function bullet(lines: string[]) {
  for (const line of lines) {
    doc.fontSize(10).fillColor('#14212b').text(`•  ${line}`, { indent: 8, lineGap: 1 });
  }
  doc.moveDown(0.35);
}

// Cover
doc.fontSize(20).fillColor('#0b4f6c').text('SureTech Medical', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(16).fillColor('#14212b').text('Electronic Batch Manufacturing Record (eBMR)', {
  align: 'center',
});
doc.moveDown(0.2);
doc.fontSize(12).fillColor('#5a6b76').text('Client System Working Guide', { align: 'center' });
doc.moveDown(0.8);
doc.fontSize(10).fillColor('#5a6b76').text('How the system works — roles, process steps, and all outcomes', {
  align: 'center',
});
doc.moveDown(0.3);
doc.text(`Prepared for client walkthrough · ${new Date().toLocaleDateString('en-GB')}`, {
  align: 'center',
});
doc.moveDown(1.2);

h1('1. What this system is');
p(
  'SureTech eBMR replaces paper Batch Manufacturing Records with a controlled digital workflow. Every manufacturing batch (for example Introducer Needle) moves through defined stages. Only the right department can act at each stage. Critical actions require an electronic signature (password re-entry). Nothing important is lost: every change is stored in an audit trail, and a printable BMR PDF can be generated at any time.',
);
p(
  'In simple terms: the system ensures the product is made, checked, sterilized, released, and shipped in the correct order — with clear responsibility at every step.',
);

h1('2. Who uses the system (roles)');
bullet([
  'Admin — sets up products, users, SOPs, settings; can oversee everything.',
  'Production Chemist — creates the batch, issues raw materials, records manufacturing.',
  'QC Officer — checks materials and product quality; runs sterility and BET tests.',
  'Packing Operator — packing, sealing, and labelling.',
  'Sterilization Operator — Ethylene Oxide (ETO) sterilization cycle and cartridge use.',
  'QA Approver — final release decision, finished-goods transfer, hold/cancel authority.',
  'Dispatch User — ships released stock to customers and reduces inventory.',
]);
p(
  'Important: Production makes the product. QC tests it. QA releases it. Dispatch ships it. This separation of duties is built into the software permissions.',
);

h1('3. Happy-path working flow (start to finish)');
p('This is the normal successful path for one batch:');
bullet([
  '1) Admin (optional) creates a Product with process template (seal temp, ETO settings, SOPs, QC checks).',
  '2) Production creates a Batch (DRAFT) and starts production → Raw Material QC.',
  '3) QC checks raw materials. If Pass → approved. If Fail → batch can be Rejected.',
  '4) Production records material consumption (which lots were used) and manufacturing work.',
  '5) QC does In-Process QC and Visual Inspection.',
  '6) Packing packs and seals the product (seal temperature as per template, e.g. 200°C).',
  '7) Sterilization runs ETO cycle (e.g. 55°C / 4 hours / 40 g cartridge) and records it.',
  '8) Packing completes labelling (batch identity and traceability).',
  '9) QC performs Sterility Test, then Bacterial Endotoxin Test (BET). Fail stops the batch.',
  '10) QA reviews the full record and Releases the batch.',
  '11) QA transfers quantity to Finished Goods stock.',
  '12) Dispatch creates and confirms shipment to a customer. When remaining stock is zero → Dispatched.',
]);

h1('4. What each process means (and why)');
h2('Product & process template');
p(
  'Defines how this product must be manufactured and tested. When a batch is created, those rules are snapshotted onto the batch so historical records stay correct even if the template is updated later.',
);
h2('Raw Material QC');
p('Confirms incoming components are acceptable before use. Prevents bad material from entering production.');
h2('Raw Material Consumption');
p('Records which material lots and quantities went into the batch. Needed for recall and investigation.');
h2('Manufacturing');
p('Documents that the product was manufactured as planned and is ready for packing/sterilization.');
h2('In-Process QC & Visual Inspection');
p('Catches defects before packing and sterilization — cheaper and safer than discovering problems later.');
h2('Packing & Sealing');
p(
  'Protects the device and creates the sterile barrier. Seal integrity is critical; a weak seal can invalidate sterilization.',
);
h2('ETO Sterilization');
p('Makes the device sterile for intended use. Cartridge lot and cycle parameters prove the process was controlled.');
h2('Labelling');
p('Puts correct identity on the pack: batch number, expiry, product details — essential for hospitals and recalls.');
h2('Sterility Test & BET');
p(
  'Laboratory confirmation after sterilization. Sterility checks for viable microbes; BET checks for bacterial endotoxins that can cause fever.',
);
h2('QA Release & Finished Goods');
p(
  'Independent decision that the batch may be used/sold. Transfer into Finished Goods makes stock available for dispatch.',
);
h2('Dispatch');
p('Only released stock can ship. Each confirmation deducts inventory and creates a customer shipment record.');

h1('5. All possible outcomes (not only Pass)');
h2('Approve / Pass');
p('Stage accepted; batch moves to the next department.');
h2('Reject / Fail');
p(
  'Critical failure (for example RM QC fail, sterility fail, BET fail, or QA reject). Batch status becomes Rejected and normal production stops for that batch.',
);
h2('Hold');
p(
  'Batch is paused (ON HOLD) for investigation. QA can Resume later to the previous step. Used when something needs review but is not yet a final reject.',
);
h2('Cancel');
p('Admin/QA can cancel a non-completed batch with a reason. Used when the batch must be closed without finishing.');
h2('Archive');
p('Admin can archive Rejected or Cancelled batches for historical storage.');
h2('Correction / Unlock');
p(
  'After a stage is signed and locked, it cannot be casually edited. A user requests correction with a reason. QA/Admin must approve unlock. The batch revision number increases (R1 → R2). The system returns the batch to an editable status for that stage so the correction can be completed and re-signed. This protects data integrity while still allowing controlled fixes.',
);
h2('Partial dispatch');
p(
  'You may ship part of the finished quantity. Stock reduces. The batch stays in Finished Goods until remaining quantity is zero, then becomes Dispatched.',
);

h1('6. Electronic signature & audit');
bullet([
  'At Submit / Approve / Reject / Confirm Dispatch, the user re-enters their password.',
  'The system records who signed, when, and with what statement.',
  'The stage then locks to prevent silent changes.',
  'Every important action is written to the Audit Trail (who, what, when, old/new values, reason).',
  'Inbox notifications alert the next role when work is waiting.',
]);

h1('7. Documents & reports you get');
h2('BMR PDF (per batch)');
p(
  'From the batch screen, authorized users can Generate BMR PDF. This is the electronic equivalent of the paper Batch Manufacturing Record. It includes batch header, stage results, signatures, sterilization parameters, QA release, finished goods, status history, company name/address from Settings, and a controlled footer note.',
);
h2('Reports');
p(
  'The Reports area shows Production, QC, Sterilization, Finished Goods, and Dispatch analytics with charts and tables. Users can Export CSV for offline analysis or sharing.',
);
h2('SOPs & attachments');
p(
  'Standard Operating Procedures are managed in the system (number, title, version, status). PDF/document files can be attached to SOPs and to lab stages (sterility/BET) as supporting evidence.',
);

h1('8. What Admin configures');
bullet([
  'Products + process templates (Add Product).',
  'Users and roles (create / edit / deactivate).',
  'Settings: company identity, e-sign default statement, PDF footer, batch number prefix mode.',
  'ETO cartridge inventory, customers, SOP masters.',
]);

h1('9. Demo logins (training environment)');
bullet([
  'Admin — admin@suretech.local / Admin@12345',
  'All other roles — *@suretech.local / Demo@12345 (production, qc, packing, sterilization, qa, dispatch)',
]);
p('Open the web app, sign in with the role you want to demonstrate, and walk that role’s steps.');

h1('10. What this delivers for the business');
bullet([
  'Controlled, role-based manufacturing workflow instead of loose digital forms.',
  'Traceability from raw material lots → batch → finished goods → customer dispatch.',
  'Electronic signatures and audit history for accountability.',
  'Printable BMR PDF for reviews, audits, and archiving.',
  'Operational visibility via dashboard, inbox, and reports.',
  'Mobile-friendly screens for shop-floor / tablet use.',
]);

h1('11. Scope note');
p(
  'This is a working MERN eBMR MVP for medical-device batch records (Introducer Needle first, extensible to more products). It is application-ready for demonstration and process training. Formal regulatory validation of electronic signatures and computer-system validation should be completed against your applicable SOPs and regulations before regulated production go-live.',
);

doc.moveDown(1);
doc.fontSize(9).fillColor('#5a6b76').text('— End of Client System Working Guide —', {
  align: 'center',
});
doc.text('SureTech Medical · Electronic Batch Manufacturing Record', { align: 'center' });

doc.end();

await new Promise<void>((resolve, reject) => {
  stream.on('finish', () => resolve());
  stream.on('error', reject);
});

console.log(`Created: ${outFile}`);
