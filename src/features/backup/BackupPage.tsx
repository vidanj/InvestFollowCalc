import { useState, type FormEvent, type ReactNode } from 'react';
import { BackupError, createBackup, MIN_PASSWORD_LENGTH, readBackup } from '../../backup/backup';
import type { BackupContents } from '../../backup/backup';
import { saveBackupFile, type SaveOutcome } from '../../backup/fileSave';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { TextField } from '../../components/TextField';
import { useAccountsWithEvents, useMeta } from '../../db/hooks';
import { useRepository } from '../../db/repositoryContext';
import { toIsoDate } from '../../domain/dates';
import { formatDate, strings } from '../../i18n/es-MX';

const t = strings.backup;

/** Local calendar date of an ISO datetime, e.g. "16 oct 2026". */
function formatTimestamp(iso: string): string {
  return formatDate(toIsoDate(new Date(iso)));
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function errorText(error: unknown): string {
  return error instanceof BackupError ? t.error(error.code) : strings.errors.unexpected;
}

const outcomeText: Record<Exclude<SaveOutcome, 'cancelled'>, (fileName: string) => string> = {
  saved: t.saved,
  shared: t.shared,
  downloaded: t.downloaded,
};

function ExportCard() {
  const repository = useRepository();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(
    null,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD_LENGTH)
      next.password = t.passwordTooShort(MIN_PASSWORD_LENGTH);
    else if (confirm !== password) next.confirm = t.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setResult(null);
    try {
      const data = await repository.exportData();
      const { fileName, text } = await createBackup(data, password, {
        now: new Date().toISOString(),
        appVersion: __APP_VERSION__,
      });
      const outcome = await saveBackupFile(fileName, text, t.fileDescription);
      if (outcome === 'cancelled') {
        setResult({ tone: 'info', text: t.cancelled });
      } else {
        await repository.markBackedUp();
        setResult({ tone: 'success', text: outcomeText[outcome](fileName) });
        setPassword('');
        setConfirm('');
      }
    } catch (error) {
      setResult({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t.exportTitle}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <TextField
          label={t.password}
          help={t.passwordHelp(MIN_PASSWORD_LENGTH)}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
          error={errors.password}
        />
        <TextField
          label={t.confirmPassword}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
          }}
          error={errors.confirm}
        />
        <Notice tone="warning">{t.passwordWarning}</Notice>
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? t.encrypting : t.createButton}
        </Button>
      </form>
    </Card>
  );
}

function ImportCard({ currentAccounts }: { currentAccounts: number }) {
  const repository = useRepository();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [contents, setContents] = useState<BackupContents | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const read = async (event: FormEvent) => {
    event.preventDefault();
    setContents(null);
    if (!file) {
      setMessage({ tone: 'error', text: t.fileRequired });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      setContents(await readBackup(await file.text(), password));
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    if (!contents) return;
    setBusy(true);
    try {
      await repository.replaceAll(contents);
      setMessage({ tone: 'success', text: t.imported(contents.accounts.length) });
      setContents(null);
      setPassword('');
    } catch (error) {
      setMessage({ tone: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t.importTitle}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.importIntro}</p>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void read(event);
        }}
      >
        <TextField
          label={t.file}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setContents(null);
          }}
        />
        <TextField
          label={t.importPassword}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setContents(null);
          }}
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy && !contents ? t.reading : t.readButton}
        </Button>
      </form>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {contents && (
        <section className="flex flex-col gap-3" aria-labelledby="backup-preview-title">
          <h4 id="backup-preview-title" className="text-sm font-semibold">
            {t.previewTitle}
          </h4>
          <p className="text-sm">
            {t.previewSummary(
              contents.accounts.length,
              contents.events.length,
              formatTimestamp(contents.exportedAt),
            )}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {contents.accounts.map((account) => (
              <li key={account.id}>
                {account.name} · {account.currency}
              </li>
            ))}
          </ul>
          <Notice tone="warning">
            <p>{t.replaceWarning(currentAccounts)}</p>
            {currentAccounts > 0 && <p className="mt-1">{t.backupFirstHint}</p>}
          </Notice>
          <ConfirmButton
            label={t.replaceButton}
            warning={t.replaceConfirmWarning}
            confirmLabel={t.replaceButton}
            onConfirm={() => {
              void replace();
            }}
          />
        </section>
      )}
    </Card>
  );
}

export function BackupPage() {
  const items = useAccountsWithEvents();
  const lastBackupAt = useMeta('lastBackupAt');
  if (!items || lastBackupAt === undefined) return <p>{strings.common.loading}</p>;

  return (
    <>
      <PageHeader title={t.title}>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.intro}</p>
      </PageHeader>
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          {lastBackupAt ? t.lastBackup(formatTimestamp(lastBackupAt)) : t.neverBackedUp}
        </p>
        <ExportCard />
        <ImportCard currentAccounts={items.length} />
      </div>
    </>
  );
}
