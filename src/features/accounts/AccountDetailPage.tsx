import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { BalanceChart, GainChart, PeriodChart } from '../../components/charts/LazyCharts';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Stat } from '../../components/Stat';
import { toneClass, toneOf } from '../../components/tone';
import { useAccount, useAccountEvents } from '../../db/hooks';
import type { EventRecord } from '../../db/schema';
import { toIsoDate } from '../../domain/dates';
import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import {
  buildSeries,
  isInRange,
  RANGES,
  rangeStart,
  rankPeriods,
  type RangeKey,
} from '../../domain/series';
import type { AccountComputation, AccountSummary, Currency, Period } from '../../domain/types';
import { formatDate, formatDuration, formatShortDate, strings } from '../../i18n/es-MX';
import { computeSafely, readFlash } from './accountHelpers';

const rangeOptions = RANGES.map((value) => ({
  value,
  label: strings.charts.rangesShort[value],
  ariaLabel: strings.charts.ranges[value],
}));

function periodDetail(period: Period, currency: Currency): string {
  return strings.account.periodDetail(
    formatSignedMoney(period.gain, currency),
    formatShortDate(period.startDate),
    formatShortDate(period.endDate),
  );
}

function AccountStats({
  summary,
  periods,
  currency,
}: {
  summary: AccountSummary;
  periods: Period[];
  currency: Currency;
}) {
  const ranked = rankPeriods(periods);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat
        label={strings.account.currentBalance}
        value={formatMoney(summary.currentBalance, currency)}
      />
      <Stat
        label={strings.account.netContributed}
        value={formatMoney(summary.netContributed, currency)}
      />
      <Stat
        label={strings.account.totalGain}
        value={formatSignedMoney(summary.totalGain, currency)}
        tone={toneOf(summary.totalGain)}
        detail={formatPercent(summary.simpleReturn)}
      />
      <Stat
        label={strings.account.annualized}
        value={formatPercent(summary.annualizedTwr)}
        tone={toneOf(summary.annualizedTwr)}
        detail={
          summary.isShortPeriod && summary.annualizedTwr !== null
            ? strings.account.shortPeriod
            : undefined
        }
      />
      <Stat label={strings.account.elapsed} value={formatDuration(summary.elapsedDays)} />
      <Stat
        label={strings.account.avgMonthly}
        value={
          summary.avgMonthlyGain === null
            ? '—'
            : formatSignedMoney(summary.avgMonthlyGain, currency)
        }
        tone={toneOf(summary.avgMonthlyGain)}
      />
      {ranked && (
        <>
          <Stat
            label={strings.account.bestPeriod}
            value={formatPercent(ranked.best.returnRate)}
            tone={toneOf(ranked.best.returnRate)}
            detail={periodDetail(ranked.best, currency)}
          />
          <Stat
            label={strings.account.worstPeriod}
            value={formatPercent(ranked.worst.returnRate)}
            tone={toneOf(ranked.worst.returnRate)}
            detail={periodDetail(ranked.worst, currency)}
          />
        </>
      )}
    </dl>
  );
}

function PeriodList({ periods, currency }: { periods: Period[]; currency: Currency }) {
  if (periods.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{strings.account.noPeriods}</p>
    );
  }
  return (
    <ol
      aria-label={strings.account.periodsTitle}
      className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
    >
      {[...periods].reverse().map((period) => (
        <li key={period.endEventId} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {strings.periods.range(formatDate(period.startDate), formatDate(period.endDate))}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {strings.periods.days(period.days)}
              {period.netFlow !== 0 &&
                ` · ${strings.periods.netFlow(formatSignedMoney(period.netFlow, currency))}`}
            </p>
          </div>
          <div className={`text-right text-sm tabular-nums ${toneClass(toneOf(period.gain))}`}>
            <p className="font-medium">{formatSignedMoney(period.gain, currency)}</p>
            <p className="text-xs">{formatPercent(period.returnRate)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Range filter row first; it scopes every chart and the breakdown below it. */
function EvolutionSection({
  events,
  computation,
  currency,
}: {
  events: EventRecord[];
  computation: AccountComputation;
  currency: Currency;
}) {
  const [range, setRange] = useState<RangeKey>('ALL');
  const allPoints = useMemo(() => buildSeries(events), [events]);
  const start = rangeStart(range, toIsoDate());
  const points = allPoints.filter((p) => isInRange(p.date, start));
  const periods = computation.periods.filter((p) => isInRange(p.endDate, start));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="evolution-title">
      <h3 id="evolution-title" className="font-semibold">
        {strings.charts.evolutionTitle}
      </h3>
      <div className="flex flex-col gap-1">
        <SegmentedControl
          legend={strings.charts.rangeLabel}
          name="range"
          options={rangeOptions}
          value={range}
          onChange={setRange}
        />
        <p className="text-xs text-slate-600 dark:text-slate-400">{strings.charts.rangeHint}</p>
      </div>
      <BalanceChart points={points} currency={currency} />
      <GainChart points={points} currency={currency} />
      <PeriodChart periods={periods} currency={currency} mode="amount" />
      <PeriodChart periods={periods} currency={currency} mode="rate" />
      <h4 className="text-sm font-semibold">{strings.account.periodsTitle}</h4>
      <PeriodList periods={periods} currency={currency} />
    </section>
  );
}

function movementValue(event: EventRecord, currency: Currency): string {
  if (event.type === 'balance') return formatMoney(event.balance, currency);
  const amount = formatMoney(event.amount, currency);
  const signed = event.type === 'deposit' ? `+${amount}` : `-${amount}`;
  return event.balanceAfter === undefined
    ? signed
    : `${signed} · ${strings.movement.balanceAfterShort(formatMoney(event.balanceAfter, currency))}`;
}

function MovementList({
  accountId,
  events,
  currency,
}: {
  accountId: string;
  events: EventRecord[];
  currency: Currency;
}) {
  const initialId = events[0]?.id;
  return (
    <ol className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {[...events].reverse().map((event) => (
        <li key={event.id}>
          <Link
            to={`/accounts/${accountId}/movements/${event.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="text-sm">
              <span className="block font-medium">
                {event.id === initialId
                  ? strings.movement.initial
                  : strings.movement.types[event.type]}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {formatDate(event.date)}
              </span>
            </span>
            <span className="text-right text-sm tabular-nums">
              {movementValue(event, currency)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function AccountDetailPage() {
  const { accountId = '' } = useParams();
  const location = useLocation();
  const account = useAccount(accountId);
  const events = useAccountEvents(accountId);
  const computation = useMemo(() => (events ? computeSafely(events) : undefined), [events]);
  const flash = readFlash(location.state);

  if (account === undefined || events === undefined) return <p>{strings.common.loading}</p>;
  if (account === null) return <PageHeader title={strings.account.notFound} backTo="/" />;

  return (
    <>
      <PageHeader
        title={account.name}
        backTo="/"
        actions={
          <ButtonLink variant="secondary" to={`/accounts/${account.id}/edit`}>
            {strings.common.edit}
          </ButtonLink>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {strings.currencyNames[account.currency]}
          {account.archived && ` · ${strings.account.archivedBadge}`}
        </p>
      </PageHeader>

      <div className="flex flex-col gap-8">
        {flash && (
          <Notice tone="success">
            {flash.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Notice>
        )}

        {!computation?.summary ? (
          <Notice tone="error">{strings.account.corrupted}</Notice>
        ) : (
          <div className="flex flex-col gap-4">
            {computation.summary.hasPendingFlows && (
              <Notice tone="warning">{strings.account.estimatedBalance}</Notice>
            )}
            <AccountStats
              summary={computation.summary}
              periods={computation.periods}
              currency={account.currency}
            />
            <ButtonLink to={`/accounts/${account.id}/movements/new`}>
              {strings.account.registerMovement}
            </ButtonLink>
          </div>
        )}

        {computation?.summary && (
          <EvolutionSection events={events} computation={computation} currency={account.currency} />
        )}

        <section className="flex flex-col gap-3" aria-labelledby="movements-title">
          <h3 id="movements-title" className="font-semibold">
            {strings.account.movementsTitle}
          </h3>
          <MovementList accountId={account.id} events={events} currency={account.currency} />
        </section>
      </div>
    </>
  );
}
