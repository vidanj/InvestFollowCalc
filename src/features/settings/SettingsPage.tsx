import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { requestPersistentStorage } from '../../db/persistence';
import { strings } from '../../i18n/es-MX';
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

        <Card title={strings.settings.aboutTitle}>
          <p className="text-sm">
            {strings.app.name} · {strings.settings.version(__APP_VERSION__)}
          </p>
        </Card>
      </div>
    </>
  );
}
