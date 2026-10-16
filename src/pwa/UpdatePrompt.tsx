import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/Button';
import { strings } from '../i18n/es-MX';

/**
 * Registers the service worker. A new version never replaces the running one on its own: the user
 * chooses when to reload, so nothing is lost mid-edit. Rendered in the page flow (not floating) so
 * it can never cover a form button.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;
  const t = strings.pwa;

  return (
    <div className="mb-6">
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm dark:border-teal-900 dark:bg-slate-900"
      >
        <p>{needRefresh ? t.updateAvailable : t.offlineReady}</p>
        <div className="flex gap-2">
          {needRefresh && (
            <Button
              onClick={() => {
                void updateServiceWorker(true);
              }}
            >
              {t.reload}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setNeedRefresh(false);
              setOfflineReady(false);
            }}
          >
            {needRefresh ? t.later : t.dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}
