import { LegendKey } from './ChartCard';

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
  kind?: 'line' | 'block';
}

/** Tooltip body: values lead (strong), series names follow; rows keyed like the legend. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1 text-slate-600 dark:text-slate-400">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <LegendKey color={row.color} kind={row.kind ?? 'line'} />
            <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {row.value}
            </span>
            <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
