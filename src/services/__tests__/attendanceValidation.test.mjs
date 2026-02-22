import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAttendanceCompositeId,
  formatAttendanceSessionValue,
  isDuplicateAttendance,
  parseAttendanceSessionValue,
} from '../attendanceValidation.ts';

describe('Attendance validation helpers', () => {
  it('formats and parses session values with meta label', () => {
    const value = formatAttendanceSessionValue('07:40', 'H');
    assert.equal(value, '07:40 | H');

    const parsed = parseAttendanceSessionValue(value);
    assert.deepEqual(parsed, { time: '07:40', meta: 'H' });
  });

  it('parses plain time without meta', () => {
    const parsed = parseAttendanceSessionValue('07:33:00');
    assert.deepEqual(parsed, { time: '07:33:00', meta: null });
  });

  it('handles duplicate attendance key check', () => {
    const key = buildAttendanceCompositeId('s1', '2026-02-03', 'Duha');
    const keys = new Set([key]);
    assert.equal(isDuplicateAttendance(keys, 's1', '2026-02-03', 'Duha'), true);
    assert.equal(isDuplicateAttendance(keys, 's2', '2026-02-03', 'Duha'), false);
  });
});
