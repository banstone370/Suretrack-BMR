import mongoose, { Document, Schema, Types } from 'mongoose';

export type EtoCartridgeStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'USED'
  | 'EXPIRED'
  | 'QUARANTINE';

export interface IEtoCartridge extends Document {
  cartridgeBatchNo: string;
  manufacturer: string;
  receivedDate: Date;
  expiryDate: Date;
  quantityGrams: number;
  quantityRemainingGrams: number;
  status: EtoCartridgeStatus;
  usedForBatchId?: Types.ObjectId;
  usedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const etoCartridgeSchema = new Schema<IEtoCartridge>(
  {
    cartridgeBatchNo: { type: String, required: true, unique: true, trim: true },
    manufacturer: { type: String, required: true },
    receivedDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    quantityGrams: { type: Number, required: true, min: 0 },
    quantityRemainingGrams: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'QUARANTINE'],
      default: 'AVAILABLE',
    },
    usedForBatchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    usedDate: Date,
  },
  { timestamps: true },
);

etoCartridgeSchema.index({ status: 1 });

export const EtoCartridge = mongoose.model<IEtoCartridge>('EtoCartridge', etoCartridgeSchema);
