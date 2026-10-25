import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { CashflowChart, CategoryChart, LeftoverChart } from '../../components/charts/LazyCharts';
import { Meter } from '../../components/Meter';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Stat } from '../../components/Stat';
import { toneOf } from '../../components/tone';
import { useAccountsWithEvents, useBudgetItems, useCredits, useInvestPlan } from '../../db/hooks';
import type { AccountWithEvents } from '../../db/repository';
import { useRepository } from '../../db/repositoryContext';
import type { CreditRecord } from '../../db/schema';
import {
  firstBudgetMonth,
  monthlyTotals,
  summarizeMonth,
  summarizeYear,
  canSkip,
  type BudgetData,
  type ExpenseItem,
  type MonthEntry,
  type MonthSummary,
} from '../../domain/budget';
import { investmentReturns, type InvestPlan } from '../../domain/investPlan';
import { toIsoDate } from '../../domain/dates';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import {
  addMonthsToYearMonth,
  compareYearMonths,
  monthRange,
  toYearMonth,
  type YearMonth,
} from '../../domain/months';
import { formatMonth, formatWholePercent, MONTH_NAMES, strings } from '../../i18n/es-MX';
import { BackupReminder } from '../backup/BackupReminder';
import { CreditCard } from '../credits/CreditCard';
import { computeCreditSafely } from '../credits/creditHelpers';
import { InvestCard } from '../invest/InvestCard';
import { budgetDataSafely, budgetPath, monthParam } from './budgetHelpers';
import { YearSummaryCard } from './YearSummaryCard';

const t = strings.budget;
const HISTORY_MONTHS = 12;

function MonthNavigator({ month, currentMonth }: { month: YearMonth; currentMonth: YearMonth }) {
  const link =
    'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 ' +
    'text-lg hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
  return (
    <nav aria-label={t.monthLabel} className="flex flex-col items-center gap-1">
      <div className="flex w-full items-center justify-between gap-3">
        <Link
          to={budgetPath(addMonthsToYearMonth(month, -1))}
          replace
          aria-label={t.previousMonth}
          className={link}
        >
          <span aria-hidden="true">‹</span>
        </Link>
        <h3 className="text-lg font-semibold first-letter:uppercase" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <Link
          to={budgetPath(addMonthsToYearMonth(month, 1))}
          replace
          aria-label={t.nextMonth}
          className={link}
        >
          <span aria-hidden="true">›</span>
        </Link>
      </div>
      {month !== currentMonth && (
        <Link
          to={budgetPath(currentMonth)}
          replace
          className="text-sm text-teal-700 hover:underline dark:text-teal-400"
        >
          {t.currentMonth}
        </Link>
      )}
    </nav>
  );
}

function entryDetail({ item, times }: MonthEntry): string {
  const repeats = {
    none: t.oneOff,
    weekly: t.everyWeek(times, formatMoney(item.amount, item.currency)),
    monthly: t.everyMonth,
    yearly: t.everyYear(MONTH_NAMES[Number(item.month.slice(5)) - 1] ?? ''),
  }[item.repeat];
  const when = item.endMonth ? `${repeats}, ${t.until(formatMonth(item.endMonth))}` : repeats;
  return item.kind === 'expense' ? `${t.categories[item.category]} · ${when}` : when;
}

interface SkipToggle {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}

interface EntryRowProps {
  to: string;
  name: string;
  detail: string;
  amount: string;
  /** Monthly and weekly expenses: "not paid this month" checkbox, outside the link. */
  skip?: SkipToggle;
}

function EntryRow({ to, name, detail, amount, skip }: EntryRowProps) {
  const skipped = skip?.checked ?? false;
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span className="min-w-0 text-sm">
          <span
            className={`block truncate font-medium ${skipped ? 'text-slate-500 dark:text-slate-400' : ''}`}
          >
            {name}
          </span>
          <span className="block text-xs text-slate-600 dark:text-slate-400">{detail}</span>
        </span>
        <span
          className={`text-right text-sm tabular-nums ${skipped ? 'text-slate-500 line-through dark:text-slate-400' : ''}`}
        >
          {amount}
        </span>
      </Link>
      {skip && (
        <label className="-mt-1 flex w-fit cursor-pointer items-center gap-2 px-4 pt-1 pb-3 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={skip.checked}
            aria-label={skip.ariaLabel}
            onChange={(e) => {
              skip.onChange(e.target.checked);
            }}
            className="h-4 w-4 accent-teal-700"
          />
          {t.skipLabel}
        </label>
      )}
    </li>
  );
}

function EntryList({ title, children }: { title: string; children: ReactNode[] }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h4 className="text-sm font-semibold">{title}</h4>
      {children.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.nothingYet}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {children}
        </ul>
      )}
    </section>
  );
}

function MonthStats({ summary }: { summary: MonthSummary }) {
  const { currency } = summary;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.income} value={formatMoney(summary.income, currency)} />
        <Stat
          label={t.expenses}
          value={formatMoney(summary.expenses, currency)}
          detail={
            summary.spentRatio === null
              ? t.noIncome
              : t.spentOfIncome(formatWholePercent(summary.spentRatio))
          }
        />
        <Stat
          label={summary.left < 0 ? t.overspent : t.left}
          value={formatSignedMoney(summary.left, currency)}
          tone={toneOf(summary.left)}
        />
        <Stat label={t.creditPayments} value={formatMoney(summary.creditPayments, currency)} />
      </dl>
      {summary.spentRatio !== null && (
        <Meter
          label={t.meterLabel}
          ratio={summary.spentRatio}
          valueText={(summary.spentRatio > 1 ? t.meterOver : t.meterValue)(
            formatWholePercent(summary.spentRatio),
          )}
        />
      )}
    </>
  );
}

/** Reminder of the money the account needs for the month's automatic charges. */
function FixedChargesReminder({ summary }: { summary: MonthSummary }) {
  if (summary.fixedCharges === 0) return null;
  const money = (cents: number) => formatMoney(cents, summary.currency);
  return (
    <Notice>
      <p className="font-medium">{t.fixedTitle(formatMonth(summary.month))}</p>
      <p className="text-2xl font-semibold">{money(summary.fixedCharges)}</p>
      <p className="mt-1 text-xs">
        {t.fixedDetail(money(summary.repeatingExpenses), money(summary.creditPayments))}{' '}
        {t.fixedNote}
      </p>
    </Notice>
  );
}

interface CurrencyBudgetProps {
  summary: MonthSummary;
  data: BudgetData;
  month: YearMonth;
  currentMonth: YearMonth;
  accounts: AccountWithEvents[];
  plan: InvestPlan;
}

function CurrencyBudget({
  summary,
  data,
  month,
  currentMonth,
  accounts,
  plan,
}: CurrencyBudgetProps) {
  const { currency } = summary;
  const returns = useMemo(() => investmentReturns(accounts, currency), [accounts, currency]);
  const year = useMemo(
    () => summarizeYear(data, currency, Number(month.slice(0, 4)), currentMonth),
    [data, currency, month, currentMonth],
  );
  const totals = useMemo(() => {
    const first = firstBudgetMonth(data) ?? month;
    const earliest = addMonthsToYearMonth(month, -(HISTORY_MONTHS - 1));
    const from = compareYearMonths(first, earliest) > 0 ? first : earliest;
    return monthlyTotals(data, currency, monthRange(from, month));
  }, [data, currency, month]);
  const repository = useRepository();
  const editPath = (id: string) => `/budget/items/${id}?month=${month}`;
  // Skipped expenses stay in their place (same order as when paid), so the list never jumps.
  const expenseRows = [
    ...summary.expenseItems.map((entry) => ({ entry, skipped: false })),
    ...summary.skippedItems.map((entry) => ({ entry, skipped: true })),
  ].sort((a, b) => b.entry.amount - a.entry.amount);
  const skipToggle = (item: ExpenseItem, checked: boolean): SkipToggle | undefined =>
    canSkip(item)
      ? {
          checked,
          ariaLabel: t.skipAria(item.name, formatMonth(month)),
          onChange: (skip) => {
            void repository.setSkipped(item.id, month, skip);
          },
        }
      : undefined;

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`budget-${currency}`}>
      <h3 id={`budget-${currency}`} className="text-lg font-semibold">
        {strings.currencyNames[currency]}
      </h3>
      <MonthStats summary={summary} />
      <FixedChargesReminder summary={summary} />
      <InvestCard summary={summary} returns={returns} plan={plan} month={month} />
      <YearSummaryCard summary={year} currentMonth={currentMonth} />
      <CategoryChart categories={summary.byCategory} total={summary.expenses} currency={currency} />

      <EntryList title={t.incomeTitle}>
        {summary.incomeItems.map((entry) => (
          <EntryRow
            key={entry.item.id}
            to={editPath(entry.item.id)}
            name={entry.item.name}
            detail={entryDetail(entry)}
            amount={formatMoney(entry.amount, currency)}
          />
        ))}
      </EntryList>
      <EntryList title={t.expensesTitle}>
        {expenseRows.map(({ entry, skipped }) => (
          <EntryRow
            key={entry.item.id}
            to={editPath(entry.item.id)}
            name={entry.item.name}
            detail={
              skipped ? t.skippedDetail(formatMoney(entry.amount, currency)) : entryDetail(entry)
            }
            amount={formatMoney(entry.amount, currency)}
            skip={skipToggle(entry.item, skipped)}
          />
        ))}
      </EntryList>
      {summary.credits.length > 0 && (
        <EntryList title={t.creditsTitle}>
          {summary.credits.map((payment) => (
            <EntryRow
              key={payment.creditId}
              to={`/credits/${payment.creditId}`}
              name={payment.name}
              detail={t.paymentNumbers(payment.numbers, payment.totalPayments)}
              amount={formatMoney(payment.amount, currency)}
            />
          ))}
        </EntryList>
      )}

      <h4 className="mt-2 font-semibold">{t.evolutionTitle}</h4>
      <CashflowChart totals={totals} currency={currency} currentMonth={currentMonth} />
      <LeftoverChart totals={totals} currency={currency} currentMonth={currentMonth} />
    </section>
  );
}

function CreditsSection({ credits }: { credits: CreditRecord[] }) {
  const today = toIsoDate();
  const rows = credits.map((credit) => ({ credit, summary: computeCreditSafely(credit, today) }));
  const active = rows.filter((r) => !r.summary?.isPaidOff);
  const paidOff = rows.filter((r) => r.summary?.isPaidOff);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="credits-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="credits-title" className="text-lg font-semibold">
          {strings.credit.sectionTitle}
        </h3>
        <ButtonLink variant="secondary" to="/credits/new">
          {strings.credit.new}
        </ButtonLink>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{strings.credit.empty}</p>
      )}
      <ul className="flex flex-col gap-3">
        {active.map((row) => (
          <CreditCard key={row.credit.id} {...row} />
        ))}
      </ul>
      {paidOff.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            {strings.credit.paidOffTitle} ({paidOff.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {paidOff.map((row) => (
              <CreditCard key={row.credit.id} {...row} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function BudgetPage() {
  const items = useBudgetItems();
  const credits = useCredits();
  const accounts = useAccountsWithEvents();
  const plan = useInvestPlan();
  const [params] = useSearchParams();
  const currentMonth = toYearMonth(toIsoDate());
  const month = monthParam(params.get('month'), currentMonth);
  const data = useMemo(
    () => (items && credits ? budgetDataSafely(items, credits) : undefined),
    [items, credits],
  );
  const summaries = useMemo(() => (data ? summarizeMonth(data, month) : []), [data, month]);

  if (data === undefined || credits === undefined || !accounts || !plan) {
    return <p>{strings.common.loading}</p>;
  }

  return (
    <>
      <PageHeader title={t.title}>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.intro}</p>
      </PageHeader>
      <BackupReminder />
      <div className="flex flex-col gap-6">
        <MonthNavigator month={month} currentMonth={currentMonth} />
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink variant="secondary" to={`/budget/items/new?kind=income&month=${month}`}>
            {t.addIncome}
          </ButtonLink>
          <ButtonLink to={`/budget/items/new?kind=expense&month=${month}`}>
            {t.addExpense}
          </ButtonLink>
        </div>
        {compareYearMonths(month, currentMonth) > 0 && <Notice>{t.projection}</Notice>}

        {data === null ? (
          <Notice tone="error">{strings.credit.corrupted}</Notice>
        ) : summaries.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
            <h3 className="text-base font-medium">{t.emptyTitle}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.emptyBody}</p>
          </section>
        ) : (
          <div className="flex flex-col gap-10">
            {summaries.map((summary) => (
              <CurrencyBudget
                key={summary.currency}
                summary={summary}
                data={data}
                month={month}
                currentMonth={currentMonth}
                accounts={accounts}
                plan={plan}
              />
            ))}
          </div>
        )}

        <CreditsSection credits={credits} />
      </div>
    </>
  );
}
