import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { strings } from '../i18n/es-MX';

function ChartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19h16" />
      <path d="M5 15l5-5 4 3 5-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

const NAV_ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: strings.nav.portfolio, icon: <ChartIcon /> },
  { to: '/settings', label: strings.nav.settings, icon: <SettingsIcon /> },
];

// Account pages hang from the portfolio, so it stays active there.
function isActive(to: string, pathname: string): boolean {
  return to === '/' ? !pathname.startsWith('/settings') : pathname.startsWith(to);
}

function NavItems({ layout }: { layout: 'bar' | 'side' }) {
  const { pathname } = useLocation();
  return (
    <ul className={layout === 'bar' ? 'grid grid-cols-2' : 'flex flex-col gap-1'}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.to, pathname);
        const tone = active
          ? 'text-teal-700 dark:text-teal-400'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';
        const shape =
          layout === 'bar'
            ? 'flex flex-col items-center gap-0.5 py-2 text-xs font-medium'
            : `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? 'bg-teal-50 dark:bg-slate-900' : ''}`;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`${shape} ${tone}`}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Bottom tab bar on phones, side navigation from `md` up. */
export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-semibold">
            <Link to="/">{strings.app.name}</Link>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{strings.app.tagline}</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1">
        <nav aria-label={strings.nav.label} className="hidden w-48 shrink-0 px-2 py-6 md:block">
          <NavItems layout="side" />
        </nav>
        <main className="w-full min-w-0 flex-1 px-4 py-6 md:max-w-3xl">
          <Outlet />
        </main>
      </div>

      <footer className="px-4 pb-24 text-center text-xs text-slate-500 md:pb-6">
        {strings.privacy.localOnly}
      </footer>

      <nav
        aria-label={strings.nav.label}
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        <NavItems layout="bar" />
      </nav>
    </div>
  );
}
