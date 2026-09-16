import mongoose, { Document, Schema, Types } from 'mongoose';

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

export interface IDispatch extends Document {
  batchId: Types.ObjectId;
  finishedGoodsId: Types.ObjectId;
  batchNo: string;
  customerId: Types.ObjectId;
  customerName: string;
  dispatchDate: Date;
  billNo: string;
  quantity: number;
  dispatchedBy?: {
    userId: Types.ObjectId;
    name: string;
    employeeId: string;
    signedAt: Date;
    method: 'PASSWORD' | 'PIN';
    statement?: string;
  };
  checkedBy?: {
    userId: Types.ObjectId;
    name: string;
    employeeId: string;
    signedAt: Date;
    method: 'PASSWORD' | 'PIN';
    statement?: string;
  };
  confirmedAt?: Date;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dispatchSchema = new Schema<IDispatch>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    finishedGoodsId: { type: Schema.Types.ObjectId, ref: 'FinishedGood', required: true },
    batchNo: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    dispatchDate: { type: Date, required: true },
    billNo: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    dispatchedBy: signatureSchema,
    checkedBy: signatureSchema,
    confirmedAt: Date,
    status: {
      type: String,
      enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
      default: 'DRAFT',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

dispatchSchema.index({ batchId: 1, createdAt: -1 });
dispatchSchema.index({ billNo: 1 });
dispatchSchema.index({ status: 1 });

export const Dispatch = mongoose.model<IDispatch>('Dispatch', dispatchSchema);
