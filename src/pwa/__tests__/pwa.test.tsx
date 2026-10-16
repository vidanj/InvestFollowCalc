import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../i18n/es-MX';
import {
  isIos,
  isStandalone,
  listenForInstallPrompt,
  promptInstall,
  useCanInstall,
} from '../install';
import { UpdatePrompt } from '../UpdatePrompt';

const { register } = vi.hoisted(() => ({
  register: { needRefresh: false, offlineReady: false, update: vi.fn(() => Promise.resolve()) },
}));
vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return {
    useRegisterSW: () => ({
      needRefresh: useState(register.needRefresh),
      offlineReady: useState(register.offlineReady),
      updateServiceWorker: register.update,
    }),
  };
});

afterEach(() => {
  register.needRefresh = false;
  register.offlineReady = false;
  register.update.mockClear();
  vi.unstubAllGlobals();
});

describe('UpdatePrompt', () => {
  it('stays hidden when there is nothing to say', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lets the user choose when to load a new version', async () => {
    register.needRefresh = true;
    const user = userEvent.setup();
    render(<UpdatePrompt />);

    expect(screen.getByText(strings.pwa.updateAvailable)).toBeVisible();
    await user.click(screen.getByRole('button', { name: strings.pwa.reload }));
    expect(register.update).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: strings.pwa.later }));
    expect(screen.queryByText(strings.pwa.updateAvailable)).toBeNull();
  });

  it('announces once the app works offline', async () => {
    register.offlineReady = true;
    const user = userEvent.setup();
    render(<UpdatePrompt />);

    expect(screen.getByText(strings.pwa.offlineReady)).toBeVisible();
    expect(screen.queryByRole('button', { name: strings.pwa.reload })).toBeNull();
    await user.click(screen.getByRole('button', { name: strings.pwa.dismiss }));
    expect(screen.queryByText(strings.pwa.offlineReady)).toBeNull();
  });
});

function InstallProbe() {
  return <p>{useCanInstall() ? 'can-install' : 'no-install'}</p>;
}

describe('install prompt', () => {
  it('keeps the browser install event and replays it on demand', async () => {
    listenForInstallPrompt();
    render(<InstallProbe />);
    expect(screen.getByText('no-install')).toBeInTheDocument();
    expect(await promptInstall()).toBe(false);

    const prompt = vi.fn(() => Promise.resolve());
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByText('can-install')).toBeInTheDocument();

    let accepted = false;
    await act(async () => {
      accepted = await promptInstall();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(accepted).toBe(true);
    expect(screen.getByText('no-install')).toBeInTheDocument();
  });

  it('forgets the event once the app is installed', () => {
    listenForInstallPrompt();
    render(<InstallProbe />);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('beforeinstallprompt'), {
          prompt: () => Promise.resolve(),
          userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
        }),
      );
    });
    expect(screen.getByText('can-install')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.getByText('no-install')).toBeInTheDocument();
  });

  it('detects the installed app and iOS devices', () => {
    expect(isStandalone()).toBe(false);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('standalone') }));
    expect(isStandalone()).toBe(true);

    expect(isIos()).toBe(false);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
      maxTouchPoints: 5,
    });
    expect(isIos()).toBe(true);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      maxTouchPoints: 5,
    });
    expect(isIos()).toBe(true);
  });
});
