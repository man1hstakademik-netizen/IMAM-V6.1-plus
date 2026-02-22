import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Role, normalizeRole, roleHierarchy } from '../roles.ts';
import { Permission } from '../permissions.ts';
import { RolePermissions, hasPermission } from '../rbac.ts';

describe('RBAC Structural Integrity', () => {
  it('every Role has a permission mapping', () => {
    for (const role of Object.values(Role)) {
      assert.ok(RolePermissions[role], `Role ${role} has no permission mapping`);
    }
  });

  it('no orphan permissions exist', () => {
    const allMapped = new Set(Object.values(RolePermissions).flat());

    for (const permission of Object.values(Permission)) {
      assert.equal(allMapped.has(permission), true, `Permission ${permission} is orphan`);
    }
  });
});

describe('Permission Enforcement', () => {
  it('ADMIN has all permissions', () => {
    for (const permission of Object.values(Permission)) {
      assert.equal(hasPermission(Role.ADMIN, permission), true, `ADMIN missing ${permission}`);
    }
  });

  it('SISWA cannot access developer console', () => {
    assert.equal(hasPermission(Role.SISWA, Permission.ACCESS_DEVELOPER_CONSOLE), false);
  });


  it('Scanner permission is restricted to intended roles', () => {
    assert.equal(hasPermission(Role.ADMIN, Permission.SCAN_QR), true);
    assert.equal(hasPermission(Role.DEVELOPER, Permission.SCAN_QR), true);
    assert.equal(hasPermission(Role.PETUGAS_PIKET, Permission.SCAN_QR), true);

    assert.equal(hasPermission(Role.GURU, Permission.SCAN_QR), false);
    assert.equal(hasPermission(Role.STAF_TU, Permission.SCAN_QR), false);
    assert.equal(hasPermission(Role.WALI_KELAS, Permission.SCAN_QR), false);
    assert.equal(hasPermission(Role.KEPALA_MADRASAH, Permission.SCAN_QR), false);
  });
});

describe('Role Hierarchy Integrity', () => {
  it('DEVELOPER is higher than ADMIN', () => {
    assert.equal(roleHierarchy[Role.DEVELOPER] > roleHierarchy[Role.ADMIN], true);
  });
});

describe('RBAC Matrix Drift Detection', () => {
  it('matrix shape remains expected for critical roles', () => {
    assert.deepEqual(RolePermissions[Role.TAMU], []);
    assert.equal(RolePermissions[Role.DEVELOPER].length, Object.values(Permission).length);
    assert.equal(RolePermissions[Role.ADMIN].length, Object.values(Permission).length);
    assert.equal(RolePermissions[Role.SISWA].includes(Permission.VIEW_DASHBOARD), true);
  });
});

describe('Legacy Role Normalization', () => {
  it('normalizes lowercase role values', () => {
    assert.equal(normalizeRole('admin'), Role.ADMIN);
    assert.equal(normalizeRole('siswa'), Role.SISWA);
  });

  it('normalizes Staf to STAF_TU', () => {
    assert.equal(normalizeRole('Staf'), Role.STAF_TU);
  });

  it('falls back safely on unknown role', () => {
    assert.equal(normalizeRole('UNKNOWN_ROLE'), Role.TAMU);
  });
});
