import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { ProjectionChart } from '../../components/charts/LazyCharts';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { Stat } from '../../components/Stat';
import { TextField } from '../../components/TextField';
import { toneOf } from '../../components/tone';
import { useAccountsWithEvents, useBudgetItems, useCredits, useInvestPlan } from '../../db/hooks';
import type { AccountWithEvents } from '../../db/repository';
import { useRepository } from '../../db/repositoryContext';
import type { BudgetData } from '../../domain/budget';
import { parseRateToBps } from '../../domain/credit';
import { toIsoDate } from '../../domain/dates';
import {
  investmentReturns,
  isValidPercent,
  projectContributions,
  PROJECTION_YEARS,
  resolveRate,
  suggestInvestment,
  type InvestPlan,
  type RateSource,
} from '../../domain/investPlan';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import { toYearMonth, type YearMonth } from '../../domain/months';
import type { Currency } from '../../domain/types';
import { formatMonth, strings } from '../../i18n/es-MX';
import { budgetDataSafely, budgetPath, monthParam } from '../budget/budgetHelpers';
import { monthFigures, rateOptions, sourceKey, type SourceKey } from './investHelpers';

const t = strings.invest;
const MAX_MONTHS = Math.max(...PROJECTION_YEARS) * 12;

function parsePercent(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return isValidPercent(value) ? value : null;
}

function sourceFor(key: SourceKey, manualBps: number | null): RateSource | null {
  if (key === 'portfolio') return { kind: 'portfolio' };
  if (key === 'manual') return manualBps === null ? null : { kind: 'manual', rateBps: manualBps };
  return { kind: 'account', accountId: key.slice('account:'.length) };
}

interface PlannerProps {
  data: BudgetData;
  accounts: AccountWithEvents[];
  plan: InvestPlan;
  month: YearMonth;
  currency: Currency;
}

function Planner({ data, accounts, plan, month, currency }: PlannerProps) {
  const repository = useRepository();
  const money = (cents: number) => formatMoney(cents, currency);
  const returns = useMemo(() => investmentReturns(accounts, currency), [accounts, currency]);
  const stored = plan.sources[currency];
  const [percentText, setPercentText] = useState(String(plan.percent));
  const [selected, setSelected] = useState<SourceKey>(() =>
    sourceKey(resolveRate(returns, stored).source),
  );
  const [rateText, setRateText] = useState(() =>
    stored?.kind === 'manual' ? String(stored.rateBps / 100) : '',
  );

  const percent = parsePercent(percentText);
  const manualBps = parseRateToBps(rateText);
  const source = sourceFor(selected, manualBps);
  const resolved = source ? resolveRate(returns, source) : null;
  const rate = resolved?.rate ?? null;

  const save = (next: InvestPlan) => {
    void repository.setInvestPlan(next);
  };
  const saveSource = (nextSource: RateSource | null) => {
    if (nextSource) save({ ...plan, sources: { ...plan.sources, [currency]: nextSource } });
  };

  const { income, left } = monthFigures(data, month, currency);
  const suggestion = suggestInvestment(income, left, percent ?? plan.percent);
  const points =
    rate !== null && rate > -1 && suggestion.amount > 0
      ? projectContributions(suggestion.amount, rate, MAX_MONTHS)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={strings.budget.income} value={money(income)} />
        <Stat
          label={left < 0 ? strings.budget.overspent : strings.budget.left}
          value={formatSignedMoney(left, currency)}
          tone={toneOf(left)}
        />
        <Stat
          label={t.canInvest}
          value={money(suggestion.amount)}
          detail={
            suggestion.capped
              ? t.capped(percent ?? plan.percent, money(suggestion.target))
              : t.share(percent ?? plan.percent)
          }
        />
      </dl>
      {income === 0 && <Notice>{t.noIncome}</Notice>}
      {income > 0 && suggestion.amount === 0 && <Notice>{t.nothingLeft}</Notice>}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <TextField
          label={t.percentLabel}
          help={t.percentHelp}
          inputMode="numeric"
          autoComplete="off"
          value={percentText}
          onChange={(e) => {
            setPercentText(e.target.value);
            const next = parsePercent(e.target.value);
            if (next !== null) save({ ...plan, percent: next });
          }}
          error={percent === null ? t.invalidPercent : undefined}
        />
        <SelectField
          label={t.rateLabel}
          value={selected}
          options={rateOptions(returns)}
          onChange={(key) => {
            setSelected(key);
            saveSource(sourceFor(key, manualBps));
          }}
        />
        {selected === 'manual' && (
          <TextField
            label={t.manualRate}
            help={t.manualRateHelp}
            inputMode="decimal"
            autoComplete="off"
            value={rateText}
            onChange={(e) => {
              setRateText(e.target.value);
              saveSource(sourceFor('manual', parseRateToBps(e.target.value)));
            }}
            error={
              rateText.trim() !== '' && manualBps === null
                ? strings.errors.creditIssue('INVALID_RATE')
                : undefined
            }
          />
        )}
        {rate === null && selected !== 'manual' && <Notice>{t.noRate(currency)}</Notice>}
        {resolved?.isShortPeriod && <Notice tone="warning">{t.shortPeriod}</Notice>}
        {rate !== null && rate < 0 && <Notice tone="warning">{t.negative}</Notice>}
      </section>

      {points && (
        <section className="flex flex-col gap-4" aria-labelledby="horizons-title">
          <h3 id="horizons-title" className="font-semibold">
            {t.horizonsTitle}
          </h3>
          <ol className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {PROJECTION_YEARS.map((years) => {
              const point = points[years * 12];
              if (!point) return null;
              return (
                <li key={years} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="shrink-0 text-sm font-medium whitespace-nowrap">
                    {t.years(years)}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-sm">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{t.value}</span>{' '}
                      <span className="font-semibold">{money(point.value)}</span>
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      {t.horizonDetail(
                        money(point.contributed),
                        formatSignedMoney(point.generated, currency),
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <ProjectionChart points={points} currency={currency} />
          <p className="text-xs text-slate-600 dark:text-slate-400">{t.disclaimer}</p>
        </section>
      )}

      <ButtonLink variant="secondary" to="/">
        {t.goToPortfolio}
      </ButtonLink>
    </div>
  );
}

export function InvestPage() {
  const [params] = useSearchParams();
  const month = monthParam(params.get('month'), toYearMonth(toIsoDate()));
  const currency: Currency = params.get('currency') === 'USD' ? 'USD' : 'MXN';
  const items = useBudgetItems();
  const credits = useCredits();
  const accounts = useAccountsWithEvents();
  const plan = useInvestPlan();
  const data = useMemo(
    () => (items && credits ? budgetDataSafely(items, credits) : undefined),
    [items, credits],
  );

  if (data === undefined || !accounts || !plan) return <p>{strings.common.loading}</p>;

  return (
    <>
      <PageHeader title={t.title} backTo={budgetPath(month)}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {strings.currencyNames[currency]} · {t.monthLine(formatMonth(month))}
        </p>
      </PageHeader>
      {data === null ? (
        <Notice tone="error">{strings.credit.corrupted}</Notice>
      ) : (
        <Planner
          key={currency}
          data={data}
          accounts={accounts}
          plan={plan}
          month={month}
          currency={currency}
        />
      )}
    </>
  );
}
