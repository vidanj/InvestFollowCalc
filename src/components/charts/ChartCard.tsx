import type { ReactNode } from 'react';
import { strings } from '../../i18n/es-MX';

export interface LegendItem {
  label: string;
  color: string;
  /** Legends mirror the mark: a short stroke for lines, a block for areas and bars. */
  kind: 'line' | 'block';
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Required for two or more series; a single series is named by the title. */
  legend?: LegendItem[];
  /** Data-table twin of the chart, so no value depends on hovering. */
  table?: ReactNode;
  children: ReactNode;
}

export function LegendKey({ color, kind }: Pick<LegendItem, 'color' | 'kind'>) {
  return kind === 'line' ? (
    <span
      aria-hidden="true"
      className="inline-block h-0.5 w-4 rounded"
      style={{ background: color }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 rounded-sm"
      style={{ background: color }}
    />
  );
}

export function ChartCard({ title, subtitle, legend, table, children }: ChartCardProps) {
  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <figcaption>
        <p className="font-medium">{title}</p>
        {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </figcaption>
      {legend && legend.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <LegendKey color={item.color} kind={item.kind} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div className="h-56 w-full">{children}</div>
      {table && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-teal-700 dark:text-teal-400">
            {strings.charts.showData}
          </summary>
          <div className="mt-2 max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}
