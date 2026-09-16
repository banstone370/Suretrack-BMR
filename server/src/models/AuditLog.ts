import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
  actorUserId?: Types.ObjectId;
  actorEmployeeId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmployeeId: String,
    actorName: String,
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    reason: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ batchId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
