import mongoose, { Document, Schema, Types } from 'mongoose';

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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProcessTemplate = mongoose.model<IProcessTemplate>(
  'ProcessTemplate',
  processTemplateSchema,
);
