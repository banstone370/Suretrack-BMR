import mongoose, { Document, Schema, Types } from 'mongoose';

export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ICorrectionRequest extends Document {
  batchId: Types.ObjectId;
  stageSlug: string;
  stageField: string;
  stageLabel: string;
  requestedBy: Types.ObjectId;
  reason: string;
  status: CorrectionStatus;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  resolutionNote?: string;
  newRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

const correctionRequestSchema = new Schema<ICorrectionRequest>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    stageSlug: { type: String, required: true },
    stageField: { type: String, required: true },
    stageLabel: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolutionNote: String,
    newRevision: Number,
  },
  { timestamps: true },
);

export const CorrectionRequest = mongoose.model<ICorrectionRequest>(
  'CorrectionRequest',
  correctionRequestSchema,
);
