import { Types } from 'mongoose';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { BatchStatus, Role } from '../types/enums.js';

const STATUS_TO_ROLES: Partial<Record<BatchStatus, Role[]>> = {
  [BatchStatus.RAW_MATERIAL_QC]: [Role.QC_OFFICER],
  [BatchStatus.RAW_MATERIAL_APPROVED]: [Role.PRODUCTION_CHEMIST],
  [BatchStatus.MATERIAL_ISSUED]: [Role.PRODUCTION_CHEMIST],
  [BatchStatus.MANUFACTURING]: [Role.PRODUCTION_CHEMIST],
  [BatchStatus.IN_PROCESS_QC]: [Role.QC_OFFICER],
  [BatchStatus.VISUAL_INSPECTION]: [Role.QC_OFFICER],
  [BatchStatus.PACKING]: [Role.PACKING_OPERATOR],
  [BatchStatus.SEALING]: [Role.PACKING_OPERATOR],
  [BatchStatus.STERILIZATION]: [Role.STERILIZATION_OPERATOR],
  [BatchStatus.LABELLING]: [Role.PACKING_OPERATOR],
  [BatchStatus.STERILITY_TEST]: [Role.QC_OFFICER],
  [BatchStatus.BET_TEST]: [Role.QC_OFFICER],
  [BatchStatus.QA_REVIEW]: [Role.QA_APPROVER],
  [BatchStatus.RELEASED]: [Role.QA_APPROVER],
  [BatchStatus.FINISHED_GOODS]: [Role.DISPATCH_USER],
  [BatchStatus.ON_HOLD]: [Role.QA_APPROVER],
};

export async function notifyRoles(params: {
  roles: Role[];
  type: string;
  title: string;
  body: string;
  batchId?: string;
  link?: string;
}) {
  if (params.roles.length === 0) return;
  await Notification.insertMany(
    params.roles.map((role) => ({
      role,
      type: params.type,
      title: params.title,
      body: params.body,
      batchId: params.batchId ? new Types.ObjectId(params.batchId) : undefined,
      link: params.link,
      isRead: false,
    })),
  );
}

export async function notifyStatusChange(params: {
  batchId: string;
  batchNo: string;
  status: BatchStatus;
}) {
  const roles = STATUS_TO_ROLES[params.status] ?? [];
  if (roles.length === 0) return;
  await notifyRoles({
    roles,
    type: 'BATCH_STATUS',
    title: `Batch ${params.batchNo} → ${params.status}`,
    body: `Batch ${params.batchNo} requires attention at status ${params.status}.`,
    batchId: params.batchId,
    link: `/batches/${params.batchId}`,
  });
}

export async function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  batchId?: string;
  link?: string;
}) {
  await Notification.create({
    userId: new Types.ObjectId(params.userId),
    type: params.type,
    title: params.title,
    body: params.body,
    batchId: params.batchId ? new Types.ObjectId(params.batchId) : undefined,
    link: params.link,
    isRead: false,
  });
}

export async function listNotificationsForUser(userId: string, role: Role, unreadOnly = false) {
  const filter: Record<string, unknown> = {
    $or: [{ userId: new Types.ObjectId(userId) }, { role }],
  };
  if (unreadOnly) filter.isRead = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
}

export async function markNotificationRead(id: string, userId: string, role: Role) {
  const n = await Notification.findById(id);
  if (!n) return null;
  const owned =
    (n.userId && String(n.userId) === userId) || (n.role && n.role === role);
  if (!owned) return null;
  n.isRead = true;
  await n.save();
  return n;
}

export async function markAllRead(userId: string, role: Role) {
  await Notification.updateMany(
    {
      isRead: false,
      $or: [{ userId: new Types.ObjectId(userId) }, { role }],
    },
    { $set: { isRead: true } },
  );
}

/** pending work counts by role for inbox */
export async function pendingWorkForRole(role: Role) {
  const { Batch } = await import('../models/Batch.js');
  const statusMap: Partial<Record<Role, BatchStatus[]>> = {
    [Role.PRODUCTION_CHEMIST]: [
      BatchStatus.DRAFT,
      BatchStatus.RAW_MATERIAL_APPROVED,
      BatchStatus.MATERIAL_ISSUED,
      BatchStatus.MANUFACTURING,
    ],
    [Role.QC_OFFICER]: [
      BatchStatus.RAW_MATERIAL_QC,
      BatchStatus.IN_PROCESS_QC,
      BatchStatus.VISUAL_INSPECTION,
      BatchStatus.STERILITY_TEST,
      BatchStatus.BET_TEST,
    ],
    [Role.PACKING_OPERATOR]: [
      BatchStatus.PACKING,
      BatchStatus.SEALING,
      BatchStatus.LABELLING,
    ],
    [Role.STERILIZATION_OPERATOR]: [BatchStatus.STERILIZATION],
    [Role.QA_APPROVER]: [BatchStatus.QA_REVIEW, BatchStatus.RELEASED, BatchStatus.ON_HOLD],
    [Role.DISPATCH_USER]: [BatchStatus.FINISHED_GOODS],
    [Role.ADMIN]: [],
  };

  if (role === Role.ADMIN) {
    const active = await Batch.countDocuments({
      status: {
        $nin: [
          BatchStatus.DISPATCHED,
          BatchStatus.CANCELLED,
          BatchStatus.ARCHIVED,
          BatchStatus.REJECTED,
        ],
      },
    });
    return { role, pendingBatches: active, statuses: [] as string[] };
  }

  const statuses = statusMap[role] ?? [];
  const pendingBatches = await Batch.countDocuments({ status: { $in: statuses } });
  return { role, pendingBatches, statuses };
}

export async function getUsersByRole(role: Role) {
  return User.find({ role, isActive: true }).select('_id name email');
}
