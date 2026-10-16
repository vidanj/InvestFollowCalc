import { useSyncExternalStore } from 'react';

/** Chromium's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

/**
 * Call once at startup: the browser fires `beforeinstallprompt` early, possibly before the
 * Ajustes page that offers the install button is open.
 */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True when the browser offers a one-click install (Chromium on desktop and Android). */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
}

/** Shows the browser's install dialog; resolves to whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  await event.prompt();
  const { outcome } = await event.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

/** Running as the installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  const media =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return media || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad (iPadOS reports itself as a touch-enabled Mac). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
