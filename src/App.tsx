import { strings } from './i18n/es-MX';

export function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h1 className="text-lg font-semibold">{strings.app.name}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{strings.app.tagline}</p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <h2 className="text-base font-medium">{strings.empty.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{strings.empty.body}</p>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">{strings.privacy.localOnly}</p>
      </main>
    </div>
  );
}
