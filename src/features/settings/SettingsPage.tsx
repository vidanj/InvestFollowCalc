import { useEffect, useState, type ReactNode } from 'react';
import { Button, ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { TextField } from '../../components/TextField';
import { useRepository } from '../../db/repositoryContext';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { requestPersistentStorage } from '../../db/persistence';
import { strings } from '../../i18n/es-MX';
import { isIos, isStandalone, promptInstall, useCanInstall } from '../../pwa/install';
import {
  readThemePreference,
  saveThemePreference,
  THEME_PREFERENCES,
  type ThemePreference,
} from '../../theme/theme';

type StorageState = 'persisted' | 'not-persisted' | 'unknown';

const themeOptions = THEME_PREFERENCES.map((value) => ({
  value,
  label: strings.settings.themes[value],
}));

async function readStorageState(): Promise<StorageState> {
  try {
    if (!('storage' in navigator)) return 'unknown';
    return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unknown';
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function InstallCard() {
  const canInstall = useCanInstall();
  const t = strings.settings;

  let body;
  if (isStandalone()) body = <p className="text-sm">{t.installed}</p>;
  else if (canInstall) {
    body = (
      <Button
        onClick={() => {
          void promptInstall();
        }}
      >
        {t.installButton}
      </Button>
    );
  } else body = <p className="text-sm">{isIos() ? t.installIos : t.installOther}</p>;

  return (
    <Card title={t.installTitle}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.installWhy}</p>
      {body}
    </Card>
  );
}

/** Two steps: open the section, then type the confirmation word. */
function DeleteAllCard() {
  const repository = useRepository();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const t = strings.settings;

  const erase = async () => {
    await repository.clearAll();
    setDone(true);
    setOpen(false);
    setTyped('');
  };

  return (
    <Card title={t.dangerTitle}>
      <p className="text-sm">{t.dangerBody}</p>
      {done && <Notice tone="success">{t.deleted}</Notice>}
      {!open ? (
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
        >
          {t.deleteAll}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-red-300 p-3 dark:border-red-800">
          <p className="text-sm">{t.dangerBackupHint}</p>
          <ButtonLink variant="secondary" to="/backup">
            {strings.backup.reminderAction}
          </ButtonLink>
          <TextField
            label={t.confirmPrompt}
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={typed.trim().toUpperCase() !== t.confirmWord}
              onClick={() => {
                void erase();
              }}
            >
              {t.confirmDeleteAll}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
            >
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference);
  const [storage, setStorage] = useState<StorageState>('unknown');

  useEffect(() => {
    void readStorageState().then(setStorage);
  }, []);

  const storageText = {
    persisted: strings.settings.storagePersisted,
    'not-persisted': strings.settings.storageNotPersisted,
    unknown: strings.settings.storageUnknown,
  }[storage];

  return (
    <>
      <PageHeader title={strings.settings.title} />
      <div className="flex flex-col gap-4">
        <Card title={strings.settings.theme}>
          <SegmentedControl
            legend={strings.settings.theme}
            name="theme"
            hideLegend
            options={themeOptions}
            value={theme}
            onChange={(value) => {
              setTheme(value);
              saveThemePreference(value);
            }}
          />
        </Card>

        <InstallCard />

        <Card title={strings.settings.storageTitle}>
          <p className="text-sm">{storageText}</p>
          {storage === 'not-persisted' && (
            <Button
              variant="secondary"
              onClick={() => {
                void requestPersistentStorage().then(() => readStorageState().then(setStorage));
              }}
            >
              {strings.settings.requestPersist}
            </Button>
          )}
        </Card>

        <Card title={strings.settings.privacyTitle}>
          {strings.settings.privacyBody.map((paragraph) => (
            <p key={paragraph} className="text-sm">
              {paragraph}
            </p>
          ))}
        </Card>

        <DeleteAllCard />

        <Card title={strings.settings.aboutTitle}>
          <p className="text-sm">
            {strings.app.name} · {strings.settings.version(__APP_VERSION__)}
          </p>
        </Card>
      </div>
    </>
  );
}
