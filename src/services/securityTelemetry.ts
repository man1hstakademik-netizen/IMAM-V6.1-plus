import type { RBACRole, Permission } from '../auth/rbac.ts';

export type TelemetryEventType = 'FORBIDDEN_ATTEMPT' | 'AI_REQUEST_GRANTED' | 'AI_REQUEST_DENIED' | 'RATE_LIMIT_HIT';

export interface TelemetryEvent {
  type: TelemetryEventType;
  role: RBACRole;
  permission?: Permission;
  route: string;
  userId: string;
  ip: string;
  userAgent: string;
  timestamp: string;
}

interface RoleCounters {
  aiGranted: number;
  aiDenied: number;
  rateLimitHit: number;
  forbidden: number;
}

interface PermissionCounter {
  attempts: number;
  granted: number;
  denied: number;
}

const MAX_RECENT_EVENTS = 200;
const recentEvents: TelemetryEvent[] = [];
const roleCounters: Record<string, RoleCounters> = {};
const permissionCounters: Record<string, PermissionCounter> = {};

const ensureRoleCounters = (role: RBACRole): RoleCounters => {
  if (!roleCounters[role]) {
    roleCounters[role] = { aiGranted: 0, aiDenied: 0, rateLimitHit: 0, forbidden: 0 };
  }
  return roleCounters[role];
};

const ensurePermissionCounter = (permission: Permission): PermissionCounter => {
  if (!permissionCounters[permission]) {
    permissionCounters[permission] = { attempts: 0, granted: 0, denied: 0 };
  }
  return permissionCounters[permission];
};

export const recordTelemetryEvent = (event: TelemetryEvent): void => {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) recentEvents.pop();

  const roleCounter = ensureRoleCounters(event.role);
  if (event.type === 'FORBIDDEN_ATTEMPT') roleCounter.forbidden += 1;
  if (event.type === 'AI_REQUEST_GRANTED') roleCounter.aiGranted += 1;
  if (event.type === 'AI_REQUEST_DENIED') roleCounter.aiDenied += 1;
  if (event.type === 'RATE_LIMIT_HIT') roleCounter.rateLimitHit += 1;

  if (event.permission) {
    const permissionCounter = ensurePermissionCounter(event.permission);
    permissionCounter.attempts += 1;
    if (event.type === 'AI_REQUEST_GRANTED') permissionCounter.granted += 1;
    if (event.type === 'FORBIDDEN_ATTEMPT' || event.type === 'AI_REQUEST_DENIED') permissionCounter.denied += 1;
  }
};

export const getTelemetrySnapshot = () => ({
  generatedAt: new Date().toISOString(),
  roleCounters,
  permissionCounters,
  recentEvents,
});
