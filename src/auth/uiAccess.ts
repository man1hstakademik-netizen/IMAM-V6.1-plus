import { ViewState, type UserRole } from '../../types';
import { Permission, hasPermission } from './rbac';

const viewPermissions: Partial<Record<ViewState, Permission>> = {
  [ViewState.REPORTS]: Permission.VIEW_REPORTS,
  [ViewState.SCANNER]: Permission.SCAN_QR,
  [ViewState.PRESENSI]: Permission.MANAGE_ATTENDANCE,
  [ViewState.CONTENT_GENERATION]: Permission.USE_AI_ASSISTANT,
  [ViewState.STUDENTS]: Permission.VIEW_SISWA,
  [ViewState.TEACHERS]: Permission.VIEW_USERS,
  [ViewState.CLASSES]: Permission.MANAGE_ACADEMIC,
  [ViewState.CREATE_ACCOUNT]: Permission.MANAGE_USERS,
  [ViewState.DEVELOPER]: Permission.ACCESS_DEVELOPER_CONSOLE,
};

export const canAccessView = (role: UserRole, view?: ViewState): boolean => {
  if (!view) return true;
  const permission = viewPermissions[view];
  if (!permission) return true;
  return hasPermission(role, permission);
};

export const canAccessPermission = (role: UserRole, permission: Permission): boolean => {
  return hasPermission(role, permission);
};
