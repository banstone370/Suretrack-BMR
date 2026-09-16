import mongoose, { Document, Schema, Types } from 'mongoose';
import { Role } from '../types/enums.js';

export interface INotification extends Document {
  userId?: Types.ObjectId;
  role?: Role;
  type: string;
  title: string;
  body: string;
  batchId?: Types.ObjectId;
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String, enum: Object.values(Role), index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    link: String,
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
