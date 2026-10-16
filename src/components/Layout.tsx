import { Link, Outlet } from 'react-router';
import { strings } from '../i18n/es-MX';

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold">
            <Link to="/">{strings.app.name}</Link>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{strings.app.tagline}</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        {strings.privacy.localOnly}
      </footer>
    </div>
  );
}
