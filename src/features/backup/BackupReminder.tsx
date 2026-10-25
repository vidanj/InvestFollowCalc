import { ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { backupReminder, BACKUP_REMINDER_DAYS } from '../../backup/reminder';
import { useHasData, useMeta } from '../../db/hooks';
import { strings } from '../../i18n/es-MX';

/** Asks for a backup when there is data that was never (or long ago) backed up. */
export function BackupReminder() {
  const hasData = useHasData();
  const lastBackupAt = useMeta('lastBackupAt');
  const lastDataChangeAt = useMeta('lastDataChangeAt');
  if (hasData === undefined || lastBackupAt === undefined || lastDataChangeAt === undefined) {
    return null;
  }

  const reminder = backupReminder({ hasData, lastBackupAt, lastDataChangeAt, now: new Date() });
  if (!reminder) return null;
  return (
    <div className="mb-6">
      <Notice tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {reminder === 'never'
              ? strings.backup.reminderNever
              : strings.backup.reminderStale(BACKUP_REMINDER_DAYS)}
          </p>
          <ButtonLink variant="secondary" to="/backup">
            {strings.backup.reminderAction}
          </ButtonLink>
        </div>
      </Notice>
    </div>
  );
}
