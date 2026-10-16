/** Days after the last backup before reminding, when data changed since then. */
export const BACKUP_REMINDER_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export type BackupReminder = 'never' | 'stale' | null;

/**
 * Whether to remind the user to back up: never backed up while there is data, or data changed
 * since a backup made more than {@link BACKUP_REMINDER_DAYS} days ago.
 */
export function backupReminder({
  hasData,
  lastBackupAt,
  lastDataChangeAt,
  now,
}: {
  hasData: boolean;
  lastBackupAt: string | null;
  lastDataChangeAt: string | null;
  now: Date;
}): BackupReminder {
  if (!hasData) return null;
  if (!lastBackupAt) return 'never';
  const changedSince = lastDataChangeAt !== null && lastDataChangeAt > lastBackupAt;
  const ageDays = (now.getTime() - Date.parse(lastBackupAt)) / MS_PER_DAY;
  return changedSince && ageDays > BACKUP_REMINDER_DAYS ? 'stale' : null;
}
