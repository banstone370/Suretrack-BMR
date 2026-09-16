import mongoose, { Document, Schema, Types } from 'mongoose';
import { Role } from '../types/enums.js';

export interface IUser extends Document {
  employeeId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(Role), required: true },
    department: { type: String },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
export type UserId = Types.ObjectId;
