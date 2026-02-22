import React from 'react';
import { type UserRole } from '../types';

interface RequireRoleProps {
  role: UserRole;
  allowed: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const RequireRole: React.FC<RequireRoleProps> = ({ role, allowed, fallback = null, children }) => {
  if (!allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
};

export default RequireRole;
