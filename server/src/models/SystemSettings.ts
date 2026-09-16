import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string;
  companyName: string;
  companyAddress: string;
  batchNoPrefixMode: 'CATALOGUE' | 'FIXED';
  fixedBatchPrefix: string;
  esignStatement: string;
  pdfFooterNote: string;
  updatedAt: Date;
  createdAt: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, unique: true, default: 'default' },
    companyName: { type: String, default: 'SureTech Medical' },
    companyAddress: { type: String, default: '' },
    batchNoPrefixMode: { type: String, enum: ['CATALOGUE', 'FIXED'], default: 'CATALOGUE' },
    fixedBatchPrefix: { type: String, default: 'IN' },
    esignStatement: {
      type: String,
      default: 'I confirm that I have reviewed this record and the entries are accurate.',
    },
    pdfFooterNote: {
      type: String,
      default: 'Controlled electronic BMR. Do not use uncontrolled copies.',
    },
  },
  { timestamps: true },
);

export const SystemSettings = mongoose.model<ISystemSettings>(
  'SystemSettings',
  systemSettingsSchema,
);
