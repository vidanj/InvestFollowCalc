import type { BudgetData } from '../../domain/budget';
import { summarizeMonth } from '../../domain/budget';
import type { CurrencyReturns, RateSource, ResolvedRate } from '../../domain/investPlan';
import { formatRate } from '../../domain/money';
import type { YearMonth } from '../../domain/months';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';

const t = strings.invest;

export function investPath(currency: Currency, month: YearMonth): string {
  return `/budget/invest?currency=${currency}&month=${month}`;
}

/** A rate (ratio) in basis points, the unit typed rates are stored in. */
export function rateToBps(rate: number): number {
  return Math.round(rate * 10_000);
}

export function formatAnnual(rate: number): string {
  return formatRate(rateToBps(rate));
}

/** Where the projected return comes from, in words: "Tu portafolio en MXN", an account's name… */
export function sourceLabel(resolved: ResolvedRate, returns: CurrencyReturns): string {
  const { source } = resolved;
  if (source.kind === 'manual') return t.sourceManual;
  if (source.kind === 'account') {
    return returns.accounts.find((a) => a.accountId === source.accountId)?.name ?? '';
  }
  return t.sourcePortfolio(returns.currency);
}

/** Select values for the rate sources: "portfolio", "account:<id>" or "manual". */
export type SourceKey = 'portfolio' | 'manual' | `account:${string}`;

export function sourceKey(source: RateSource): SourceKey {
  return source.kind === 'account' ? `account:${source.accountId}` : source.kind;
}

export function rateOptions(returns: CurrencyReturns): { value: SourceKey; label: string }[] {
  const rateText = (rate: number | null) => (rate === null ? t.noHistory : formatAnnual(rate));
  return [
    {
      value: 'portfolio',
      label: t.rateOption(
        t.sourcePortfolio(returns.currency),
        rateText(returns.portfolio?.rate ?? null),
      ),
    },
    ...returns.accounts.map((a) => ({
      value: `account:${a.accountId}` as const,
      label: t.rateOption(a.name, rateText(a.rate)),
    })),
    { value: 'manual', label: t.sourceManual },
  ];
}

/** The month's income and what is left in one currency (0 when nothing was registered). */
export function monthFigures(
  data: BudgetData,
  month: YearMonth,
  currency: Currency,
): { income: number; left: number } {
  const summary = summarizeMonth(data, month).find((s) => s.currency === currency);
  return { income: summary?.income ?? 0, left: summary?.left ?? 0 };
}
