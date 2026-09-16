import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { Customer } from '../models/Customer.js';
import { EtoCartridge } from '../models/EtoCartridge.js';
import { ProcessTemplate } from '../models/ProcessTemplate.js';
import { Product } from '../models/Product.js';
import { Sop } from '../models/Sop.js';
import { User } from '../models/User.js';
import { Role } from '../types/enums.js';
import { hashPassword } from '../utils/authTokens.js';

/** Idempotent seed — safe to run on every boot. */
export async function runSeed(): Promise<void> {
  let admin = await User.findOne({ email: env.seedAdminEmail.toLowerCase() });
  if (!admin) {
    admin = await User.create({
      employeeId: 'ADM-001',
      name: 'System Admin',
      email: env.seedAdminEmail.toLowerCase(),
      passwordHash: await hashPassword(env.seedAdminPassword),
      role: Role.ADMIN,
      department: 'Administration',
    });
    console.log(`Created admin: ${admin.email}`);
  } else {
    console.log(`Admin already exists: ${admin.email}`);
  }

  const demoUsers = [
    {
      employeeId: 'PC-001',
      name: 'Production Chemist',
      email: 'production@suretech.local',
      role: Role.PRODUCTION_CHEMIST,
      department: 'Production',
    },
    {
      employeeId: 'QC-001',
      name: 'QC Officer',
      email: 'qc@suretech.local',
      role: Role.QC_OFFICER,
      department: 'Quality Control',
    },
    {
      employeeId: 'PK-001',
      name: 'Packing Operator',
      email: 'packing@suretech.local',
      role: Role.PACKING_OPERATOR,
      department: 'Packing',
    },
    {
      employeeId: 'ST-001',
      name: 'Sterilization Operator',
      email: 'sterilization@suretech.local',
      role: Role.STERILIZATION_OPERATOR,
      department: 'Sterilization',
    },
    {
      employeeId: 'QA-001',
      name: 'QA Approver',
      email: 'qa@suretech.local',
      role: Role.QA_APPROVER,
      department: 'Quality Assurance',
    },
    {
      employeeId: 'DS-001',
      name: 'Dispatch User',
      email: 'dispatch@suretech.local',
      role: Role.DISPATCH_USER,
      department: 'Dispatch',
    },
  ];

  for (const u of demoUsers) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create({
        ...u,
        passwordHash: await hashPassword('Demo@12345'),
      });
      console.log(`Created user: ${u.email}`);
    }
  }

  let product = await Product.findOne({ catalogueNo: 'IN-001' });
  if (!product) {
    const template = await ProcessTemplate.create({
      name: 'Introducer Needle BMR Template',
      version: 1,
      stages: [
        'RAW_MATERIAL_QC',
        'MANUFACTURING',
        'IN_PROCESS_QC',
        'VISUAL_INSPECTION',
        'PACKING',
        'SEALING',
        'STERILIZATION',
        'LABELLING',
        'STERILITY_TEST',
        'BET_TEST',
        'QA_REVIEW',
        'FINISHED_GOODS',
        'DISPATCH',
      ],
      sealingParams: {
        temperatureC: 200,
        sopRef: 'SOP/MF/011',
      },
      sterilizationParams: {
        temperatureC: 55,
        durationHours: 4,
        etoCartridgeGrams: 40,
        sopRef: 'SOP/MF/008',
      },
      sterilitySop: 'SOP/QC/004',
      betSop: 'SOP/QC/005',
      storageCondition: 'Store at Room Temperature',
      rmQcChecks: [
        'Hub checking',
        'Bevel checking',
        'Guide wire passing',
        'Visual inspection for dust, burrs and foreign particles',
      ],
      ipqcChecks: ['Dust free', 'Burr free', 'Foreign particle free'],
      isActive: true,
    });

    product = await Product.create({
      name: 'INTRODUCER NEEDLE',
      catalogueNo: 'IN-001',
      description: 'Introducer Needle — Batch Manufacturing Record product',
      defaultBatchSize: 10000,
      shelfLifeMonths: 60,
      processTemplateId: template._id,
      isActive: true,
    });

    template.productId = product._id;
    await template.save();
    console.log(`Created product: ${product.catalogueNo}`);
  } else {
    console.log(`Product already exists: ${product.catalogueNo}`);
  }

  const existingCartridge = await EtoCartridge.findOne({ cartridgeBatchNo: 'ETO-40G-260901' });
  if (!existingCartridge) {
    await EtoCartridge.create({
      cartridgeBatchNo: 'ETO-40G-260901',
      manufacturer: 'SureTech Sterile Gas',
      receivedDate: new Date('2026-09-01'),
      expiryDate: new Date('2027-09-01'),
      quantityGrams: 400,
      quantityRemainingGrams: 400,
      status: 'AVAILABLE',
    });
    console.log('Created sample ETO cartridge: ETO-40G-260901');
  } else {
    console.log('ETO cartridge already exists: ETO-40G-260901');
  }

  const existingCustomer = await Customer.findOne({ code: 'MEDSUP-01' });
  if (!existingCustomer) {
    await Customer.create({
      name: 'MedSupply Healthcare Pvt Ltd',
      code: 'MEDSUP-01',
      address: 'Industrial Area, Phase II',
      contact: '+91-98765-43210',
    });
    console.log('Created sample customer: MEDSUP-01');
  } else {
    console.log('Customer already exists: MEDSUP-01');
  }

  const sops = [
    {
      sopNo: 'SOP/MF/011',
      title: 'Paper Pouch Sealing Operation',
      version: '1.0',
      description: 'Sealing at 200°C for paper pouch',
    },
    {
      sopNo: 'SOP/MF/008',
      title: 'ETO Machine Operation',
      version: '1.0',
      description: 'ETO sterilization 55°C / 4 hours / 40 g cartridge',
    },
    {
      sopNo: 'SOP/QC/004',
      title: 'Sterility Testing',
      version: '1.0',
      description: 'Sterility test procedure',
    },
    {
      sopNo: 'SOP/QC/005',
      title: 'Bacterial Endotoxin (BET) Testing',
      version: '1.0',
      description: 'BET test procedure',
    },
  ];

  for (const s of sops) {
    const exists = await Sop.findOne({ sopNo: s.sopNo, version: s.version });
    if (!exists) {
      await Sop.create({
        ...s,
        effectiveDate: new Date('2026-01-01'),
        status: 'APPROVED',
      });
      console.log(`Created SOP: ${s.sopNo}`);
    }
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  console.log('Demo users password: Demo@12345');
}

async function seedCli() {
  await connectDb();
  await runSeed();
  process.exit(0);
}

const isDirectRun =
  process.argv[1]?.includes('seed') ||
  process.env.npm_lifecycle_event === 'seed';

if (isDirectRun) {
  seedCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
