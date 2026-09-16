import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  code: string;
  address?: string;
  contact?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    address: { type: String },
    contact: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
