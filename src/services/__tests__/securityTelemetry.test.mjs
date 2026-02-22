import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Role } from '../../auth/roles.ts';
import { Permission } from '../../auth/permissions.ts';
import { getTelemetrySnapshot, recordTelemetryEvent } from '../securityTelemetry.ts';

describe('Security telemetry', () => {
  it('records forbidden attempts and permission counters', () => {
    recordTelemetryEvent({
      type: 'FORBIDDEN_ATTEMPT',
      role: Role.SISWA,
      permission: Permission.ACCESS_AI,
      route: '/api/gemini',
      userId: 'u-1',
      ip: '127.0.0.1',
      userAgent: 'node-test',
      timestamp: new Date().toISOString(),
    });

    const snap = getTelemetrySnapshot();
    assert.equal(snap.roleCounters[Role.SISWA].forbidden >= 1, true);
    assert.equal(snap.permissionCounters[Permission.ACCESS_AI].attempts >= 1, true);
    assert.equal(snap.permissionCounters[Permission.ACCESS_AI].denied >= 1, true);
  });

  it('records granted AI requests', () => {
    recordTelemetryEvent({
      type: 'AI_REQUEST_GRANTED',
      role: Role.GURU,
      permission: Permission.ACCESS_AI,
      route: '/api/gemini',
      userId: 'u-2',
      ip: '127.0.0.2',
      userAgent: 'node-test',
      timestamp: new Date().toISOString(),
    });

    const snap = getTelemetrySnapshot();
    assert.equal(snap.roleCounters[Role.GURU].aiGranted >= 1, true);
    assert.equal(snap.permissionCounters[Permission.ACCESS_AI].granted >= 1, true);
  });
});
