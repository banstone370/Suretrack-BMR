import { Permission, Role } from '../types/enums.js';

const ALL: Permission[] = [
  'users:manage',
  'products:manage',
  'sops:manage',
  'rawMaterials:manage',
  'system:configure',
  'audit:view',
  'batches:view_all',
  'batches:create',
  'batches:edit_production',
  'batches:submit_production',
  'rm_qc:edit',
  'rm_qc:approve',
  'rm_consumption:edit',
  'manufacturing:edit',
  'ipqc:edit',
  'visual_inspection:edit',
  'packing:edit',
  'sealing:edit',
  'sterilization:edit',
  'eto_cartridge:manage',
  'labelling:edit',
  'sterility:edit',
  'bet:edit',
  'qa:review',
  'qa:release',
  'finished_goods:transfer',
  'dispatch:create',
  'dispatch:confirm',
  'batch:hold',
  'batch:cancel',
  'batch:request_correction',
  'reports:view',
  'pdf:generate',
];

const COMMON: Permission[] = [
  'batches:view_all',
  'batch:request_correction',
  'reports:view',
  'pdf:generate',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: ALL,
  [Role.PRODUCTION_CHEMIST]: [
    ...COMMON,
    'batches:create',
    'batches:edit_production',
    'batches:submit_production',
    'rm_consumption:edit',
    'manufacturing:edit',
  ],
  [Role.QC_OFFICER]: [
    ...COMMON,
    'audit:view',
    'rm_qc:edit',
    'rm_qc:approve',
    'ipqc:edit',
    'visual_inspection:edit',
    'sterility:edit',
    'bet:edit',
    'batch:hold',
  ],
  [Role.PACKING_OPERATOR]: [
    ...COMMON,
    'packing:edit',
    'sealing:edit',
    'labelling:edit',
  ],
  [Role.STERILIZATION_OPERATOR]: [
    ...COMMON,
    'sterilization:edit',
    'eto_cartridge:manage',
  ],
  [Role.QA_APPROVER]: [
    ...COMMON,
    'audit:view',
    'qa:review',
    'qa:release',
    'finished_goods:transfer',
    'batch:hold',
    'batch:cancel',
  ],
  [Role.DISPATCH_USER]: [
    ...COMMON,
    'dispatch:create',
    'dispatch:confirm',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
