import { formatMoney } from '../../domain/money';
import type { Cents, Currency } from '../../domain/types';
import { formatWholePercent } from '../../i18n/es-MX';
import { LegendKey } from './ChartCard';

export interface CostPart {
  label: string;
  amount: Cents;
  /** A `--series-*` token; parts keep their slot whether or not others are shown. */
  color: string;
}

interface CostSplitProps {
  title: string;
  subtitle: string;
  parts: CostPart[];
  currency: Currency;
}

/**
 * Part-to-whole as one stacked bar (2px surface gaps between segments). Every part is listed with
 * its amount and share right below, which doubles as the table view.
 */
export function CostSplit({ title, subtitle, parts, currency }: CostSplitProps) {
  const shown = parts.filter((p) => p.amount > 0);
  const total = shown.reduce((sum, p) => sum + p.amount, 0);
  if (total === 0) return null;

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <figcaption>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
      </figcaption>
      <div aria-hidden="true" className="flex h-4 w-full gap-0.5 overflow-hidden rounded">
        {shown.map((part) => (
          <div
            key={part.label}
            title={`${part.label}: ${formatMoney(part.amount, currency)}`}
            className="h-full first:rounded-l last:rounded-r"
            style={{ backgroundColor: part.color, flexGrow: part.amount, flexBasis: 0 }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {shown.map((part) => (
          <div key={part.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <LegendKey color={part.color} kind="block" />
              {part.label}
            </dt>
            <dd className="tabular-nums">
              {formatMoney(part.amount, currency)}{' '}
              <span className="text-xs text-slate-600 dark:text-slate-400">
                ({formatWholePercent(part.amount / total)})
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
