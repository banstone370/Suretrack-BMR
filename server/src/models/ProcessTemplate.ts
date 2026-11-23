import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISealingMode {
  mode: 'paper' | 'tyvek' | 'blister';
  temperatureC: number;
  sopRef: string;
}

export interface IRawMaterial {
  name: string;
}

export interface IManufacturingStep {
  step: string;
}

export interface IProcessTemplate extends Document {
  productId?: Types.ObjectId;
  name: string;
  version: number;
  stages: string[];
  sealingParams: {
    temperatureC: number;
    sopRef: string;
    allowedRange?: { min: number; max: number };
  };
  sterilizationParams: {
    temperatureC: number;
    durationHours: number;
    etoCartridgeGrams: number;
    sopRef: string;
  };
  sterilitySop: string;
  betSop: string;
  storageCondition: string;
  rmQcChecks: string[];
  ipqcChecks: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** v2 product-centric fields (all optional; batches seeded with docId use them) */
  docId?: string;
  bmrIssueNo?: string;
  bmrEffectiveDate?: string;
  manufacturingInstruction?: string;
  rawMaterials?: IRawMaterial[];
  manufacturingSteps?: IManufacturingStep[];
  sealingModes?: ISealingMode[];
  packingType?: 'pouch' | 'blisterTray';
  extraSections?: string[];
  optionalStages?: string[];
}

const processTemplateSchema = new Schema<IProcessTemplate>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    stages: [{ type: String }],
    sealingParams: {
      temperatureC: { type: Number, required: true },
      sopRef: { type: String, required: true },
      allowedRange: {
        min: Number,
        max: Number,
      },
    },
    sterilizationParams: {
      temperatureC: { type: Number, required: true },
      durationHours: { type: Number, required: true },
      etoCartridgeGrams: { type: Number, required: true },
      sopRef: { type: String, required: true },
    },
    sterilitySop: { type: String, required: true },
    betSop: { type: String, required: true },
    storageCondition: { type: String, required: true },
    rmQcChecks: [{ type: String }],
    ipqcChecks: [{ type: String }],
    docId: { type: String },
    bmrIssueNo: { type: String },
    bmrEffectiveDate: { type: String },
    manufacturingInstruction: { type: String },
    rawMaterials: [
      {
        name: { type: String, required: true },
      },
    ],
    manufacturingSteps: [
      {
        step: { type: String, required: true },
      },
    ],
    sealingModes: [
      {
        mode: {
          type: String,
          enum: ['paper', 'tyvek', 'blister'],
          required: true,
        },
        temperatureC: { type: Number, required: true },
        sopRef: { type: String, required: true },
      },
    ],
    packingType: {
      type: String,
      enum: ['pouch', 'blisterTray'],
    },
    extraSections: [{ type: String }],
    optionalStages: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProcessTemplate = mongoose.model<IProcessTemplate>(
  'ProcessTemplate',
  processTemplateSchema,
);
