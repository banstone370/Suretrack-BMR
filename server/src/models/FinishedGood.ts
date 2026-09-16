import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFinishedGood extends Document {
  batchId: Types.ObjectId;
  batchNo: string;
  productId: Types.ObjectId;
  productName: string;
  catalogueNo: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityDispatched: number;
  receivedOn: Date;
  expiryDate: Date;
  storageCondition: string;
  status: 'AVAILABLE' | 'DEPLETED' | 'QUARANTINE';
  createdAt: Date;
  updatedAt: Date;
}

const finishedGoodSchema = new Schema<IFinishedGood>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, unique: true },
    batchNo: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    catalogueNo: { type: String, required: true },
    quantityAvailable: { type: Number, required: true, min: 0 },
    quantityReserved: { type: Number, default: 0, min: 0 },
    quantityDispatched: { type: Number, default: 0, min: 0 },
    receivedOn: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    storageCondition: { type: String, required: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'DEPLETED', 'QUARANTINE'],
      default: 'AVAILABLE',
    },
  },
  { timestamps: true },
);

finishedGoodSchema.index({ status: 1 });
finishedGoodSchema.index({ batchNo: 1 });

export const FinishedGood = mongoose.model<IFinishedGood>('FinishedGood', finishedGoodSchema);
