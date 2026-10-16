import type { ReactNode } from 'react';
import { toneClass, type Tone } from './tone';

interface StatProps {
  label: string;
  value: string;
  tone?: Tone;
  detail?: ReactNode;
}

export function Stat({ label, value, tone = 'neutral', detail }: StatProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold ${toneClass(tone)}`}>{value}</dd>
      {detail && <dd className="mt-1 text-xs text-slate-600 dark:text-slate-400">{detail}</dd>}
    </div>
  );
}
