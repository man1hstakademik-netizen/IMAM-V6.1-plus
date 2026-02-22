import { Role, type Role as RoleValue } from './roles.ts';
import { Permission, type Permission as PermissionValue } from './permissions.ts';

export { Role, Permission };
export type RBACRole = RoleValue;

export const RolePermissions: Readonly<Record<RoleValue, readonly PermissionValue[]>> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.DEVELOPER]: Object.values(Permission),
  [Role.GURU]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_ATTENDANCE,
    Permission.MANAGE_ACADEMIC,
    Permission.INPUT_NILAI,
    Permission.VIEW_SISWA,
    Permission.USE_AI_ASSISTANT,
    Permission.ACCESS_AI,
  ],
  [Role.SISWA]: [Permission.VIEW_DASHBOARD],
  [Role.KETUA_KELAS]: [Permission.VIEW_DASHBOARD],
  [Role.KEPALA_MADRASAH]: [Permission.VIEW_DASHBOARD, Permission.VIEW_REPORTS, Permission.VIEW_ANALYTICS, Permission.MANAGE_SYSTEM, Permission.APPROVE_RAPOR],
  [Role.WALI_KELAS]: [Permission.VIEW_DASHBOARD, Permission.MANAGE_ATTENDANCE, Permission.MANAGE_ACADEMIC, Permission.INPUT_NILAI, Permission.VIEW_SISWA],
  [Role.STAF_TU]: [Permission.VIEW_DASHBOARD, Permission.MANAGE_USERS, Permission.VIEW_USERS, Permission.VIEW_SISWA, Permission.EDIT_SISWA],
  [Role.WAKA_KURIKULUM]: [Permission.VIEW_DASHBOARD, Permission.MANAGE_ACADEMIC, Permission.VIEW_REPORTS, Permission.APPROVE_RAPOR],
  [Role.WAKA_KESISWAAN]: [Permission.VIEW_DASHBOARD, Permission.MANAGE_ATTENDANCE, Permission.VIEW_REPORTS, Permission.VIEW_SISWA],
  [Role.WAKA_SARPRAS]: [Permission.VIEW_DASHBOARD, Permission.VIEW_REPORTS],
  [Role.BK]: [Permission.VIEW_DASHBOARD, Permission.VIEW_REPORTS, Permission.VIEW_SISWA],
  [Role.OPERATOR]: [Permission.VIEW_DASHBOARD, Permission.MANAGE_USERS, Permission.VIEW_USERS, Permission.VIEW_SISWA, Permission.EDIT_SISWA],
  [Role.ORANG_TUA]: [Permission.VIEW_DASHBOARD],
  [Role.PETUGAS_PIKET]: [Permission.VIEW_DASHBOARD, Permission.SCAN_QR, Permission.MANAGE_ATTENDANCE],
  [Role.TAMU]: [],
} as const;

export const hasPermission = (role: RoleValue, permission: PermissionValue): boolean => {
  return RolePermissions[role]?.includes(permission) ?? false;
};

export const getPermissions = (role: RoleValue): readonly PermissionValue[] => RolePermissions[role] ?? [];
