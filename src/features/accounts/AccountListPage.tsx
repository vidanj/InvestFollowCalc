import { Link } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { toneClass, toneOf } from '../../components/tone';
import { useAccountsWithEvents } from '../../db/hooks';
import type { AccountWithEvents } from '../../db/repository';
import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import { strings } from '../../i18n/es-MX';
import { computeSafely } from './accountHelpers';

function AccountCard({ account, events }: AccountWithEvents) {
  const summary = computeSafely(events)?.summary ?? null;

  return (
    <li>
      <Link
        to={`/accounts/${account.id}`}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-600 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: account.color }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{account.name}</span>
          <span className="block text-xs text-slate-500">{account.currency}</span>
        </span>
        {summary && (
          <span className="text-right tabular-nums">
            <span className="block font-medium">
              {formatMoney(summary.currentBalance, account.currency)}
            </span>
            <span className={`block text-xs ${toneClass(toneOf(summary.totalGain))}`}>
              {strings.accounts.gain} {formatSignedMoney(summary.totalGain, account.currency)} ·{' '}
              {formatPercent(summary.simpleReturn)}
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}

export function AccountListPage() {
  const items = useAccountsWithEvents();
  if (!items) return <p>{strings.common.loading}</p>;

  const active = items.filter((item) => !item.account.archived);
  const archived = items.filter((item) => item.account.archived);

  return (
    <>
      <PageHeader
        title={strings.accounts.title}
        actions={<ButtonLink to="/accounts/new">{strings.accounts.new}</ButtonLink>}
      />
      {items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <h3 className="text-base font-medium">{strings.accounts.emptyTitle}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {strings.accounts.emptyBody}
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((item) => (
            <AccountCard key={item.account.id} {...item} />
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            {strings.accounts.archivedTitle} ({archived.length})
          </summary>
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
