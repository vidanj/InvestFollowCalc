import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<Tone, string> = {
  info: 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900',
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  error:
    'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
};

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
