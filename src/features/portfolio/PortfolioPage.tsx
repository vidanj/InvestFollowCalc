import { useMemo } from 'react';
import { ButtonLink } from '../../components/Button';
import { BalanceChart } from '../../components/charts/LazyCharts';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Stat } from '../../components/Stat';
import { toneOf } from '../../components/tone';
import { backupReminder, BACKUP_REMINDER_DAYS } from '../../backup/reminder';
import { useAccountsWithEvents, useMeta } from '../../db/hooks';
import type { AccountWithEvents } from '../../db/repository';
import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import { computePortfolio, type CurrencyPortfolio } from '../../domain/portfolio';
import { buildSeries } from '../../domain/series';
import { strings } from '../../i18n/es-MX';
import { AccountCard } from '../accounts/AccountCard';

function CurrencySection({
  portfolio,
  accounts,
}: {
  portfolio: CurrencyPortfolio;
  accounts: AccountWithEvents[];
}) {
  const { currency, computation } = portfolio;
  const summary = computation.summary;
  const points = useMemo(() => buildSeries(portfolio.timeline), [portfolio.timeline]);
  if (!summary) return null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`currency-${currency}`}>
      <h3 id={`currency-${currency}`} className="text-lg font-semibold">
        {strings.currencyNames[currency]}
      </h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={strings.portfolio.totalBalance}
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
      </dl>
      <BalanceChart points={points} currency={currency} />
      <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
        {strings.portfolio.accountsTitle}
      </h4>
      <ul className="flex flex-col gap-3">
        {accounts.map((item) => (
          <AccountCard key={item.account.id} {...item} />
        ))}
      </ul>
    </section>
  );
}

function computeSafely(active: AccountWithEvents[]): CurrencyPortfolio[] | null {
  try {
    return computePortfolio(active);
  } catch {
    return null;
  }
}

function BackupReminder({ hasData }: { hasData: boolean }) {
  const lastBackupAt = useMeta('lastBackupAt');
  const lastDataChangeAt = useMeta('lastDataChangeAt');
  if (lastBackupAt === undefined || lastDataChangeAt === undefined) return null;

  const reminder = backupReminder({ hasData, lastBackupAt, lastDataChangeAt, now: new Date() });
  if (!reminder) return null;
  return (
    <div className="mb-6">
      <Notice tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            {reminder === 'never'
              ? strings.backup.reminderNever
              : strings.backup.reminderStale(BACKUP_REMINDER_DAYS)}
          </p>
          <ButtonLink variant="secondary" to="/backup">
            {strings.backup.reminderAction}
          </ButtonLink>
        </div>
      </Notice>
    </div>
  );
}

export function PortfolioPage() {
  const items = useAccountsWithEvents();
  const active = useMemo(() => items?.filter((item) => !item.account.archived) ?? [], [items]);
  const portfolios = useMemo(() => computeSafely(active), [active]);

  if (!items) return <p>{strings.common.loading}</p>;
  const archived = items.filter((item) => item.account.archived);

  return (
    <>
      <PageHeader
        title={strings.portfolio.title}
        actions={<ButtonLink to="/accounts/new">{strings.accounts.new}</ButtonLink>}
      />
      <BackupReminder hasData={items.length > 0} />
      {items.length === 0 && (
        <section className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <h3 className="text-base font-medium">{strings.accounts.emptyTitle}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {strings.accounts.emptyBody}
          </p>
        </section>
      )}
      {items.length > 0 && active.length === 0 && <Notice>{strings.portfolio.allArchived}</Notice>}
      {portfolios === null ? (
        <Notice tone="error">{strings.account.corrupted}</Notice>
      ) : (
        <div className="flex flex-col gap-10">
          {portfolios.map((portfolio) => (
            <CurrencySection
              key={portfolio.currency}
              portfolio={portfolio}
              accounts={active.filter((item) => item.account.currency === portfolio.currency)}
            />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            {strings.accounts.archivedTitle} ({archived.length})
          </summary>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {strings.portfolio.archivedNote}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {archived.map((item) => (
              <AccountCard key={item.account.id} {...item} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
