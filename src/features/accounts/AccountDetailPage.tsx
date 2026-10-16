import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Stat } from '../../components/Stat';
import { toneClass, toneOf } from '../../components/tone';
import { useAccount, useAccountEvents } from '../../db/hooks';
import type { EventRecord } from '../../db/schema';
import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import type { AccountSummary, Currency, Period } from '../../domain/types';
import { formatDate, formatDuration, strings } from '../../i18n/es-MX';
import { computeSafely, readFlash } from './accountHelpers';

function AccountStats({ summary, currency }: { summary: AccountSummary; currency: Currency }) {
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
    <ol className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
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
  if (account === null) {
    return (
      <>
        <PageHeader title={strings.account.notFound} backTo="/" />
      </>
    );
  }

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

      <div className="flex flex-col gap-6">
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
          <>
            {computation.summary.hasPendingFlows && (
              <Notice tone="warning">{strings.account.estimatedBalance}</Notice>
            )}
            <AccountStats summary={computation.summary} currency={account.currency} />
          </>
        )}

        <ButtonLink to={`/accounts/${account.id}/movements/new`}>
          {strings.account.registerMovement}
        </ButtonLink>

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">{strings.account.periodsTitle}</h3>
          <PeriodList periods={computation?.periods ?? []} currency={account.currency} />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">{strings.account.movementsTitle}</h3>
          <MovementList accountId={account.id} events={events} currency={account.currency} />
        </section>
      </div>
    </>
  );
}
