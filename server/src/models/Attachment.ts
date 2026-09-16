import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttachment extends Document {
  batchId?: Types.ObjectId;
  stageSlug?: string;
  sopId?: Types.ObjectId;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', index: true },
    stageSlug: { type: String, index: true },
    sopId: { type: Schema.Types.ObjectId, ref: 'Sop', index: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Attachment = mongoose.model<IAttachment>('Attachment', attachmentSchema);
