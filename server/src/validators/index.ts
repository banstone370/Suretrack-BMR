import { z } from 'zod';
import { Role } from '../types/enums.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  department: z.string().optional(),
});

export const createBatchSchema = z.object({
  productId: z.string().min(1),
  batchNo: z.string().min(1).optional(),
  batchSize: z.number().int().positive(),
  manufacturingDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()).optional(),
});

export const updateBatchDraftSchema = z.object({
  batchSize: z.number().int().positive().optional(),
  manufacturingDate: z.string().or(z.date()).optional(),
  expiryDate: z.string().or(z.date()).optional(),
});

const DEFAULT_STAGES = [
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
];

export const createProductSchema = z.object({
  name: z.string().trim().min(1),
  catalogueNo: z.string().trim().min(1),
  description: z.string().trim().optional(),
  defaultBatchSize: z.number().int().positive().optional(),
  shelfLifeMonths: z.number().int().positive().default(60),
  processTemplate: z
    .object({
      name: z.string().trim().min(1).optional(),
      sealingTemperatureC: z.number().positive().default(200),
      sealingSopRef: z.string().trim().min(1).default('SOP/MF/011'),
      sterilizationTemperatureC: z.number().positive().default(55),
      sterilizationDurationHours: z.number().positive().default(4),
      etoCartridgeGrams: z.number().positive().default(40),
      sterilizationSopRef: z.string().trim().min(1).default('SOP/MF/008'),
      sterilitySop: z.string().trim().min(1).default('SOP/QC/004'),
      betSop: z.string().trim().min(1).default('SOP/QC/005'),
      storageCondition: z.string().trim().min(1).default('Store at Room Temperature'),
      rmQcChecks: z.array(z.string().trim().min(1)).optional(),
      ipqcChecks: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
});

export { DEFAULT_STAGES };
