import { Stat } from '../../components/Stat';
import { toneOf } from '../../components/tone';
import type { YearSummary } from '../../domain/budget';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import type { YearMonth } from '../../domain/months';
import { formatMonth, strings } from '../../i18n/es-MX';

const t = strings.year;

/** January to December: what comes in, what goes out and what is left when the year ends. */
export function YearSummaryCard({
  summary,
  currentMonth,
}: {
  summary: YearSummary;
  currentMonth: YearMonth;
}) {
  const { currency, toDate, projected } = summary;
  const isOver = projected.months === 0;
  const leftLabel = isOver ? t.leftPast : summary.left < 0 ? t.overspent : t.left;

  let split;
  if (isOver) split = t.closed;
  else if (toDate.months === 0) split = t.allProjected;
  else {
    split = t.split(
      formatSignedMoney(toDate.left, currency),
      formatMonth(currentMonth),
      formatSignedMoney(projected.left, currency),
    );
  }

  return (
    <section aria-labelledby={`year-${currency}`} className="flex flex-col gap-3">
      <div>
        <h4 id={`year-${currency}`} className="font-semibold">
          {t.title(summary.year)}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400">{t.subtitle}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t.income} value={formatMoney(summary.income, currency)} />
        <Stat label={t.expenses} value={formatMoney(summary.expenses, currency)} />
        <Stat
          label={leftLabel}
          value={formatSignedMoney(summary.left, currency)}
          tone={toneOf(summary.left)}
        />
      </dl>
      <p className="text-xs text-slate-600 dark:text-slate-400">{split}</p>
    </section>
  );
}
