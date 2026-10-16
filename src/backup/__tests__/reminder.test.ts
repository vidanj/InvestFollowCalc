import { describe, expect, it } from 'vitest';
import { backupReminder } from '../reminder';

const now = new Date('2026-10-16T12:00:00.000Z');
const daysBefore = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('backupReminder', () => {
  it('stays quiet without data', () => {
    expect(
      backupReminder({ hasData: false, lastBackupAt: null, lastDataChangeAt: null, now }),
    ).toBeNull();
  });

  it('asks for a first backup', () => {
    expect(
      backupReminder({ hasData: true, lastBackupAt: null, lastDataChangeAt: daysBefore(0), now }),
    ).toBe('never');
  });

  it('reminds only when data changed and the backup is older than 30 days', () => {
    const base = { hasData: true, now };
    expect(
      backupReminder({ ...base, lastBackupAt: daysBefore(31), lastDataChangeAt: daysBefore(1) }),
    ).toBe('stale');
    expect(
      backupReminder({ ...base, lastBackupAt: daysBefore(29), lastDataChangeAt: daysBefore(1) }),
    ).toBeNull();
    expect(
      backupReminder({ ...base, lastBackupAt: daysBefore(60), lastDataChangeAt: daysBefore(61) }),
    ).toBeNull();
    expect(
      backupReminder({ ...base, lastBackupAt: daysBefore(60), lastDataChangeAt: null }),
    ).toBeNull();
  });
});
