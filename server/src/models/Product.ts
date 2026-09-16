import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  catalogueNo: string;
  description?: string;
  defaultBatchSize?: number;
  shelfLifeMonths: number;
  processTemplateId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    catalogueNo: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    defaultBatchSize: { type: Number },
    shelfLifeMonths: { type: Number, required: true, default: 60 },
    processTemplateId: { type: Schema.Types.ObjectId, ref: 'ProcessTemplate' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Product = mongoose.model<IProduct>('Product', productSchema);
