import { connectDb } from '../config/db.js';
import { ProcessTemplate } from '../models/ProcessTemplate.js';
import { Product } from '../models/Product.js';

interface SeedSealingMode {
  mode: 'paper' | 'tyvek' | 'blister';
  temperatureC: number;
  sopRef: string;
}

interface SeedProduct {
  name: string;
  catalogueNo: string;
  description: string;
  defaultBatchSize: number;
  docId: string;
  bmrIssueNo?: string;
  bmrEffectiveDate?: string;
  manufacturingInstruction?: string;
  rawMaterials: string[];
  rmQcChecks: string[];
  manufacturingSteps: string[];
  ipqcChecks: string[];
  sealingModes: SeedSealingMode[];
  packingType: 'pouch' | 'blisterTray';
  etoGrams: number;
  etoSop: string;
  sterilitySop: string;
  betSop: string;
  extraSections: string[];
  optionalStages: string[];
}

const PAPER_200_011: SeedSealingMode = { mode: 'paper', temperatureC: 200, sopRef: 'SOP/MF/011' };
const TYVEK_150_011: SeedSealingMode = { mode: 'tyvek', temperatureC: 150, sopRef: 'SOP/MF/011' };
const PAPER_200_009: SeedSealingMode = { mode: 'paper', temperatureC: 200, sopRef: 'SOP/MF/009' };
const TYVEK_150_009: SeedSealingMode = { mode: 'tyvek', temperatureC: 150, sopRef: 'SOP/MF/009' };
const BLISTER_105_028: SeedSealingMode = { mode: 'blister', temperatureC: 105, sopRef: 'SOP/MF/028' };

const GUIDEWIRE_STEPS = [
  'Cutting of HDPE tubing',
  'Setting of tubing (amount of cavity clip used, amount of advancer used)',
  'Checking the thickness of guidewire',
  'Insertion of Guide wire',
];

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Y CONNECTOR (PUSH CLICK)',
    catalogueNo: 'YC-PC-001',
    description: 'Y Connector (Push Click) — BMR Doc SU/BMR/001',
    defaultBatchSize: 10,
    docId: 'SU/BMR/001',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/07/2023',
    rawMaterials: ['Torque Device', 'Y-Connector', 'Insertion Tool'],
    rmQcChecks: [
      'Hub checking of insertion tool',
      'Passing of guide wire 0.025mm in insertion tool',
      'Checking O.D of insertion tool',
      'Checking of collet (open)',
    ],
    manufacturingSteps: [
      'Assembly of torque device and its tightening',
      'Clean the device by using 70% IPA solution',
    ],
    ipqcChecks: ['Visual Inspection of unfinished product for dust/foreign particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'INTRODUCER NEEDLE',
    catalogueNo: 'IN-001',
    description: 'Introducer Needle — BMR Doc SU/BMR/002',
    defaultBatchSize: 10000,
    docId: 'SU/BMR/002',
    bmrIssueNo: '01',
    rawMaterials: ['Introducer needle (purchased finished part, sent for further processing)'],
    rmQcChecks: [
      'Hub checking',
      'Bevel checking',
      'Guide Wire passing',
      'Visual Inspection: For Dust, Burrs and Foreign Particles',
    ],
    manufacturingSteps: ['The needles are made Ready for Sterilization'],
    ipqcChecks: ['The Needles are checked Free from Dust, Burrs and Foreign Particle'],
    sealingModes: [PAPER_200_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/004',
    betSop: 'SOP/QC/005',
    extraSections: [],
    optionalStages: [],
  },
  {
    name: 'PERM CATH KIT',
    catalogueNo: 'PCK-001',
    description: 'Perm Catheter Kit — BMR Doc SU/BMR/019',
    defaultBatchSize: 10,
    docId: 'SU/BMR/019',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: [
      'Purm Catheter',
      'Connector blue',
      'Connector red',
      'Small clamp',
      'Guide wire 0.035 x 70cm',
      'Thumb scalpel #11 blue color',
      'Introducer needle 18G x 7cm',
      'Dilator 10F',
      'Dilator 12F',
      'Dilator 18F',
      '5ml Syringe',
      'Injection stopper - HARSORIYA',
      'Silicon tubing',
      'Small Drape',
      'Big Drape',
      '10ml Syringe - White',
      'Trocar Sheath',
      'Scalpel',
      'Soft Swab',
    ],
    rmQcChecks: [
      'Checking of silicon tubing',
      'Checking of Purm Catheter',
      'Checking of clamp and female connector',
    ],
    manufacturingSteps: [
      'Attach Stopper',
      'Clean the device by using water and IPA 25% V/V solution',
      'Make set of Purm Catheter Kit',
      'Sealing of tray by Blister Sealing Machine',
    ],
    ipqcChecks: [
      'Checking of Guide Wire passing in Purm Catheter',
      'Visual Inspection of Unfinished product for dust and foreign particle',
    ],
    sealingModes: [BLISTER_105_028],
    packingType: 'blisterTray',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'MALECOAT CATHETER',
    catalogueNo: 'MC-001',
    description: 'Malecoat Catheter — BMR Doc SU/BMR/028',
    defaultBatchSize: 24,
    docId: 'SU/BMR/028',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['P.U.'],
    rmQcChecks: [],
    manufacturingSteps: ['The Malecoat catheter is Ready'],
    ipqcChecks: ['Checking Max. Pressure'],
    sealingModes: [],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE'],
    optionalStages: ['PACKING', 'SEALING'],
  },
  {
    name: 'MANIFOLD (3 PORT RIGHT OFF)',
    catalogueNo: '6332',
    description: 'Manifold 3 Port Right Off — BMR Doc SU/BMR/029',
    defaultBatchSize: 150,
    docId: 'SU/BMR/029',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/07/2019',
    rawMaterials: ['Manifold 2/3 port base', 'Manifold handle', 'Manifold rotator', 'O-ring'],
    rmQcChecks: ['Rotator Checking', 'Guide wire Passing', 'Base'],
    manufacturingSteps: [
      'Rotator attached to base with the help of O-ring deep in to silicon',
      'Then handle deep in to silicon attached to the base and fix with Manifold assembly machine',
      'Checking for leakage',
    ],
    ipqcChecks: [
      'Guide wire Passing',
      'Leakage checking',
      'Visual Inspection of unfinished product for dust/foreign particles',
    ],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'PCN CATHETER WITH NEEDLE (10F x 22CM)',
    catalogueNo: '73121422',
    description: 'PCN Trocar Catheter 10F x 22cm — BMR Doc SU/BMR/031',
    defaultBatchSize: 100,
    docId: 'SU/BMR/031',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['S.S.', 'P.U.'],
    rmQcChecks: [],
    manufacturingSteps: ['The PCN Catheter is Ready'],
    ipqcChecks: [],
    sealingModes: [],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['LABEL_OF_PRODUCT'],
    optionalStages: ['PACKING', 'SEALING'],
  },
  {
    name: 'RADIAL PUNCTURE SHEATH',
    catalogueNo: 'RPS-2035',
    description: 'Radial Puncture Sheath — BMR Doc SU/BMR/038',
    defaultBatchSize: 600,
    docId: 'SU/BMR/038',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['S.S.', 'K RESIN', 'H.D.'],
    rmQcChecks: ['Hub checking', 'Bevel Checking', 'O.D. Checking', 'Length Checking'],
    manufacturingSteps: ['The Radial Puncture Sheath is Ready'],
    ipqcChecks: ['Visual Inspection of Sheath for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011],
    packingType: 'pouch',
    etoGrams: 210,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE'],
    optionalStages: [],
  },
  {
    name: 'RADIO FREQUENCY NEEDLE',
    catalogueNo: 'RFN-001',
    description: 'Radio Frequency Needle 22G x 10cm — BMR Doc SU/BMR/039',
    defaultBatchSize: 50,
    docId: 'SU/BMR/039',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['S.S.', 'K RESIN', 'H.D.'],
    rmQcChecks: ['Hub checking', 'Bevel Checking', 'O.D. Checking', 'Length Checking'],
    manufacturingSteps: ['The Radio Frequency Needle is Ready'],
    ipqcChecks: ['Visual Inspection of Needles for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE'],
    optionalStages: [],
  },
  {
    name: 'RADIAL COMPRESSION BAND',
    catalogueNo: 'RCB-001',
    description: 'Radial Compression Band (With/Without Syringe) — BMR Doc SU/BMR/022',
    defaultBatchSize: 100,
    docId: 'SU/BMR/022',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/07/2023',
    rawMaterials: ['S.S.', 'P.U.'],
    rmQcChecks: ['Knob forward-backward checking', 'Belt checking', 'Pressure pad checking'],
    manufacturingSteps: ['The Radial compression band is Ready'],
    ipqcChecks: ['Visual Inspection of band for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: [],
    optionalStages: [],
  },
  {
    name: 'ZEBRA GUIDE WIRE',
    catalogueNo: 'ZGW-001',
    description: 'Zebra Guide Wire — BMR Doc SU/BMR/048',
    defaultBatchSize: 100,
    docId: 'SU/BMR/048',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/07/2023',
    rawMaterials: ['Guide wire', 'HDPE Tubing', 'Cavity', 'Nossel / Advancer'],
    rmQcChecks: [],
    manufacturingSteps: GUIDEWIRE_STEPS,
    ipqcChecks: ['Visual Inspection of unfinished product for dust/foreign particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'SINGLE LUMEN CATHETER (7F x 13.5CM)',
    catalogueNo: 'SLC-7F',
    description: 'Single Lumen Catheter 7F x 13.5cm — BMR Doc SU/BMR/042',
    defaultBatchSize: 500,
    docId: 'SU/BMR/042',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/07/2019',
    rawMaterials: ['Silicon Tubing', 'White clamp', 'Female connector', '7F Single Lumen Tubing'],
    rmQcChecks: [
      'Checking of silicon tubing',
      'Checking of single lumen tubing',
      'Checking of clamp and female connector',
      'Biopsy tubing',
    ],
    manufacturingSteps: [
      'Single Lumen tubing insert Molding',
      'Silicon Tubing Cutting and Attachment',
      'Then insert a clamp',
      'Attach Female Connector and Cap',
    ],
    ipqcChecks: [
      'Checking of Guide Wire Passing in Single Lumen Catheter',
      'Visual Inspection of Unfinished product for dust and foreign particle',
    ],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: [],
    optionalStages: [],
  },
  {
    name: 'NEEDLE FREE CONNECTOR',
    catalogueNo: 'COMP.NF.111',
    description: 'Needle Free Connector — BMR Doc SU/BMR/052',
    defaultBatchSize: 10,
    docId: 'SU/BMR/052',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/04/2023',
    rawMaterials: [],
    rmQcChecks: [
      'Surface Finishing',
      'Functional Fitting',
      'Visual Inspection: For Dust, Burrs and Foreign Particles',
    ],
    manufacturingSteps: ['The Needle free connector is made ready'],
    ipqcChecks: [
      'Visual Inspection of needle free connector/adaptor/valve is free from Burrs and Foreign Particles',
    ],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'TRANSDUCER PROTECTOR',
    catalogueNo: 'TP-001',
    description: 'Transducer Protector — BMR Doc SU/BMR/045',
    defaultBatchSize: 500,
    docId: 'SU/BMR/045',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['PC'],
    rmQcChecks: ['Checking Transducer protector'],
    manufacturingSteps: ['The Transducer Protector is Ready'],
    ipqcChecks: ['Visual Inspection of protector for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE'],
    optionalStages: [],
  },
  {
    name: 'URETERIC CATHETER (9F x 100CM)',
    catalogueNo: 'UC-9F-100',
    description: 'Ureteric Catheter 9F x 100cm — BMR Doc SU/BMR/046',
    defaultBatchSize: 100,
    docId: 'SU/BMR/046',
    bmrIssueNo: '01',
    bmrEffectiveDate: '27/11/2021',
    rawMaterials: ['P.U.'],
    rmQcChecks: [],
    manufacturingSteps: ['The Ureteral Catheter is Ready'],
    ipqcChecks: [],
    sealingModes: [],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: ['PACKING', 'SEALING'],
  },
  {
    name: 'PTMC GUIDE WIRE',
    catalogueNo: 'PTMC-GW-001',
    description: 'PTMC Guide Wire — BMR Doc SU/BMR/050',
    defaultBatchSize: 100,
    docId: 'SU/BMR/050',
    bmrIssueNo: '01',
    rawMaterials: ['Guide wire', 'HDPE tubing', 'Cavity', 'Nossel-Advancer'],
    rmQcChecks: [],
    manufacturingSteps: GUIDEWIRE_STEPS,
    ipqcChecks: ['Visual Inspection of unfinished product for dust/foreign particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE'],
    optionalStages: [],
  },
  {
    name: 'PTFE GUIDE WIRE',
    catalogueNo: 'PTFE-GW-001',
    description: 'PTFE Guide Wire — BMR Doc SU/BMR/021',
    defaultBatchSize: 500,
    docId: 'SU/BMR/021',
    bmrIssueNo: '01',
    bmrEffectiveDate: '10/12/2024',
    rawMaterials: ['Guide wire', 'HDPE Tubing', 'Cavity', 'Nossel / Advancer'],
    rmQcChecks: [],
    manufacturingSteps: GUIDEWIRE_STEPS,
    ipqcChecks: ['Visual Inspection of unfinished product for dust/foreign particles'],
    sealingModes: [PAPER_200_009, TYVEK_150_009],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/007',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'SPINAL NEEDLE (23G x 89MM)',
    catalogueNo: '962-389',
    description: 'Spinal Needle 23G x 89mm — BMR Doc SU/BMR/051',
    defaultBatchSize: 10,
    docId: 'SU/BMR/051',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/04/2023',
    rawMaterials: ['S.S.', 'K RESIN'],
    rmQcChecks: [
      'Hub checking',
      'Cannula checking',
      'Guide Wire passing',
      'Visual Inspection: For Dust, Burrs and Foreign particles',
    ],
    manufacturingSteps: ['The Spinal needle is Ready'],
    ipqcChecks: ['The Needles are checked Free from Dust, Burrs and Foreign Particle'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'STOP COCK (2 WAY)',
    catalogueNo: '2WAY',
    description: 'Stop Cock Two Way — BMR Doc SU/BMR/054',
    defaultBatchSize: 500,
    docId: 'SU/BMR/054',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/04/2023',
    rawMaterials: ['Male luer connector', 'Female luer connector'],
    rmQcChecks: ['Checking of male and female luer connector'],
    manufacturingSteps: ['The stop cock is Ready'],
    ipqcChecks: ['Visual Inspection for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'LOR SYRINGE (10ML)',
    catalogueNo: 'LOR-10ML',
    description: 'Epidural LOR Syringe 10ml — BMR Doc SU/BMR/058',
    defaultBatchSize: 50,
    docId: 'SU/BMR/058',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/04/2023',
    rawMaterials: ['Powder-ABS'],
    rmQcChecks: ['Checking of syringe'],
    manufacturingSteps: ['The LOR Syringe is Ready'],
    ipqcChecks: ['Visual Inspection of protector for burrs and Foreign Particles'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
  {
    name: 'NERVE BLOCK NEEDLE (22G x 10CM)',
    catalogueNo: '9322100-NBN',
    description: 'Nerve Block Needle 22G x 10cm — BMR Doc SU/BMR/057',
    defaultBatchSize: 10,
    docId: 'SU/BMR/057',
    bmrIssueNo: '01',
    bmrEffectiveDate: '01/04/2023',
    rawMaterials: ['S.S.', 'K RESIN'],
    rmQcChecks: [
      'Hub checking',
      'Cannula checking',
      'Guide Wire passing',
      'Visual Inspection: For Dust, Burrs and Foreign Particles',
    ],
    manufacturingSteps: ['The nerve block needle is Ready'],
    ipqcChecks: ['The Needles are checked Free from Dust, Burrs and Foreign Particle'],
    sealingModes: [PAPER_200_011, TYVEK_150_011],
    packingType: 'pouch',
    etoGrams: 40,
    etoSop: 'SOP/MF/008',
    sterilitySop: 'SOP/QC/018',
    betSop: 'SOP/QC/026',
    extraSections: ['CONTROL_SAMPLE', 'LABEL_OF_PRODUCT'],
    optionalStages: [],
  },
];

async function seedProducts(): Promise<void> {
  for (const p of PRODUCTS) {
    const templateData = {
      name: `${p.name} BMR Template`,
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
        temperatureC: p.sealingModes[0]?.temperatureC ?? 200,
        sopRef: p.sealingModes[0]?.sopRef ?? 'SOP/MF/011',
      },
      sterilizationParams: {
        temperatureC: 55,
        durationHours: 4,
        etoCartridgeGrams: p.etoGrams,
        sopRef: p.etoSop,
      },
      sterilitySop: p.sterilitySop,
      betSop: p.betSop,
      storageCondition: 'Store at Room Temperature',
      rmQcChecks: p.rmQcChecks,
      ipqcChecks: p.ipqcChecks,
      docId: p.docId,
      bmrIssueNo: p.bmrIssueNo ?? '01',
      bmrEffectiveDate: p.bmrEffectiveDate,
      manufacturingInstruction: p.manufacturingInstruction,
      rawMaterials: p.rawMaterials.map((name) => ({ name })),
      manufacturingSteps: p.manufacturingSteps.map((step) => ({ step })),
      sealingModes: p.sealingModes,
      packingType: p.packingType,
      extraSections: p.extraSections,
      optionalStages: p.optionalStages,
      isActive: true,
    };

    const product = await Product.findOne({ catalogueNo: p.catalogueNo });
    if (product) {
      const template = await ProcessTemplate.findById(product.processTemplateId);
      if (template) {
        Object.assign(template, templateData);
        await template.save();
      }
      product.name = p.name;
      product.description = p.description;
      product.defaultBatchSize = p.defaultBatchSize;
      await product.save();
      console.log(`Updated product: ${p.catalogueNo}`);
    } else {
      const template = await ProcessTemplate.create(templateData);
      const newProduct = await Product.create({
        name: p.name,
        catalogueNo: p.catalogueNo,
        description: p.description,
        defaultBatchSize: p.defaultBatchSize,
        shelfLifeMonths: 60,
        processTemplateId: template._id,
        isActive: true,
      });
      template.productId = newProduct._id;
      await template.save();
      console.log(`Created product: ${p.catalogueNo}`);
    }
  }
  console.log(`Product seed complete (${PRODUCTS.length} products).`);
}

export async function runProductSeed(): Promise<void> {
  await seedProducts();
}

async function seedCli() {
  await connectDb();
  await seedProducts();
  process.exit(0);
}

const isDirectRun =
  process.argv[1]?.includes('seedProducts') ||
  process.env.npm_lifecycle_event === 'seed:products';

if (isDirectRun) {
  seedCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
