import { ButtonLink } from '../../components/Button';
import type { MonthSummary } from '../../domain/budget';
import {
  projectContributions,
  resolveRate,
  suggestInvestment,
  type CurrencyReturns,
  type InvestPlan,
} from '../../domain/investPlan';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import type { YearMonth } from '../../domain/months';
import { strings } from '../../i18n/es-MX';
import { formatAnnual, investPath, sourceLabel } from './investHelpers';

const t = strings.invest;
const CARD_YEARS = 5;

interface InvestCardProps {
  summary: MonthSummary;
  returns: CurrencyReturns;
  plan: InvestPlan;
  month: YearMonth;
}

/** How much of the month could go to investments, and what it could grow to in 5 years. */
export function InvestCard({ summary, returns, plan, month }: InvestCardProps) {
  const { currency } = summary;
  const money = (cents: number) => formatMoney(cents, currency);
  const suggestion = suggestInvestment(summary.income, summary.left, plan.percent);
  const resolved = resolveRate(returns, plan.sources[currency]);
  const projection =
    suggestion.amount > 0 && resolved.rate !== null && resolved.rate > -1
      ? projectContributions(suggestion.amount, resolved.rate, CARD_YEARS * 12).at(-1)
      : undefined;

  let body;
  if (summary.income === 0) body = <p className="text-sm">{t.noIncome}</p>;
  else if (suggestion.amount === 0) body = <p className="text-sm">{t.nothingLeft}</p>;
  else {
    body = (
      <>
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.canInvest}</p>
          <p className="text-2xl font-semibold">{money(suggestion.amount)}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {suggestion.capped
              ? t.capped(plan.percent, money(suggestion.target))
              : t.share(plan.percent)}
          </p>
        </div>
        {projection && resolved.rate !== null ? (
          <div className="text-sm">
            <p>
              {t.projectionLine(
                t.years(CARD_YEARS),
                money(projection.value),
                formatSignedMoney(projection.generated, currency),
              )}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t.rateLine(formatAnnual(resolved.rate), sourceLabel(resolved, returns))}
            </p>
            {resolved.isShortPeriod && (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t.shortPeriod}</p>
            )}
          </div>
        ) : (
          <p className="text-sm">{t.noRate(currency)}</p>
        )}
      </>
    );
  }

  return (
    <section
      aria-labelledby={`invest-${currency}`}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h4 id={`invest-${currency}`} className="font-semibold">
        {t.title}
      </h4>
      {body}
      <ButtonLink variant="secondary" to={investPath(currency, month)}>
        {t.adjust}
      </ButtonLink>
    </section>
  );
}
