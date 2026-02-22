import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const repoFile = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Permission-first drift shield', () => {
  it('routes do not use allowedRoles in App route guards', () => {
    const appSource = repoFile('App.tsx');
    assert.equal(appSource.includes('allowedRoles={'), false);
  });

  it('sidebar menu config does not use roles arrays', () => {
    const sidebarSource = repoFile('components/Sidebar.tsx');
    assert.equal(sidebarSource.includes('roles:'), false);
  });

  it('all features menu config does not use roles arrays', () => {
    const allFeaturesSource = repoFile('components/AllFeatures.tsx');
    assert.equal(allFeaturesSource.includes('roles:'), false);
  });

  it('dashboard quick menu does not use role helper gating', () => {
    const dashboardSource = repoFile('components/Dashboard.tsx');
    assert.equal(dashboardSource.includes('hasRoleAccess('), false);
    assert.equal(dashboardSource.includes('roles:'), false);
  });
});
