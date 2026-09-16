import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISop extends Document {
  sopNo: string;
  title: string;
  version: string;
  effectiveDate: Date;
  documentUrl?: string;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  approvedBy?: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sopSchema = new Schema<ISop>(
  {
    sopNo: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    effectiveDate: { type: Date, required: true },
    documentUrl: { type: String },
    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'SUPERSEDED'],
      default: 'DRAFT',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String },
  },
  { timestamps: true },
);

sopSchema.index({ sopNo: 1, version: 1 }, { unique: true });
sopSchema.index({ status: 1 });

export const Sop = mongoose.model<ISop>('Sop', sopSchema);
