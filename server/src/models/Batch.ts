import mongoose, { Document, Schema, Types } from 'mongoose';
import { BatchStatus, RecordLockState } from '../types/enums.js';

const signatureSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String,
    employeeId: String,
    signedAt: Date,
    method: { type: String, enum: ['PASSWORD', 'PIN'] },
    statement: String,
  },
  { _id: false },
);

const emptyStage = () => ({
  lockState: RecordLockState.OPEN,
});

export interface IBatch extends Document {
  batchNo: string;
  productId: Types.ObjectId;
  productName: string;
  catalogueNo: string;
  batchSize: number;
  manufacturingDate: Date;
  expiryDate: Date;
  status: BatchStatus;
  previousStatus?: BatchStatus;
  statusHistory: Array<{
    status: BatchStatus;
    at: Date;
    by?: Types.ObjectId;
    reason?: string;
  }>;
  templateVersion: number;
  processParamsSnapshot: {
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
  };
  stages: Record<string, unknown>;
  currentRevision: number;
  holdReason?: string;
  rejectReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<IBatch>(
  {
    batchNo: { type: String, required: true, unique: true, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    catalogueNo: { type: String, required: true },
    batchSize: { type: Number, required: true, min: 1 },
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(BatchStatus),
      default: BatchStatus.DRAFT,
    },
    previousStatus: { type: String, enum: Object.values(BatchStatus) },
    statusHistory: [
      {
        status: { type: String, enum: Object.values(BatchStatus) },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: String,
      },
    ],
    templateVersion: { type: Number, default: 1 },
    processParamsSnapshot: { type: Schema.Types.Mixed, required: true },
    stages: {
      type: Schema.Types.Mixed,
      default: () => ({
        rawMaterialQc: {
          ...emptyStage(),
          checks: [],
        },
        rawMaterialConsumption: { ...emptyStage(), lines: [] },
        manufacturing: {
          ...emptyStage(),
          process: 'The needles are made Ready for Sterilization.',
          status: 'NOT_STARTED',
        },
        inProcessQc: { ...emptyStage() },
        visualInspection: { ...emptyStage() },
        packing: { ...emptyStage() },
        sealing: { ...emptyStage() },
        sterilization: { ...emptyStage(), cycleStatus: 'NOT_STARTED' },
        labelling: { ...emptyStage() },
        sterilityTest: { ...emptyStage(), result: 'PENDING' },
        betTest: { ...emptyStage(), result: 'PENDING' },
        qaReview: { ...emptyStage() },
        finishedGoods: { ...emptyStage() },
      }),
    },
    currentRevision: { type: Number, default: 1 },
    holdReason: String,
    rejectReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

batchSchema.index({ status: 1 });
batchSchema.index({ productId: 1 });
batchSchema.index({ manufacturingDate: 1 });
batchSchema.index({ productName: 'text', batchNo: 'text', catalogueNo: 'text' });

export const Batch = mongoose.model<IBatch>('Batch', batchSchema);
export { signatureSchema };
