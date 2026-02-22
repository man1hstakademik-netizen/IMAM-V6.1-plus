import React from 'react';
import { type UserRole } from '../types';
import { type Permission } from '../src/auth/permissions';
import { hasPermission } from '../src/auth/rbac';

interface RequirePermissionProps {
  role: UserRole;
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ role, permission, fallback = null, children }) => {
  if (!hasPermission(role, permission)) return <>{fallback}</>;
  return <>{children}</>;
};

export default RequirePermission;
