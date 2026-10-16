import { Link } from 'react-router';
import { Sparkline } from '../../components/charts/Sparkline';
import { toneClass, toneOf } from '../../components/tone';
import type { AccountWithEvents } from '../../db/repository';
import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import { buildSeries } from '../../domain/series';
import { strings } from '../../i18n/es-MX';
import { accountColorVar, computeSafely } from './accountHelpers';

const SPARKLINE_POINTS = 12;

function balanceTrend(events: AccountWithEvents['events']): number[] {
  try {
    return buildSeries(events)
      .slice(-SPARKLINE_POINTS)
      .map((p) => p.balance);
  } catch {
    return [];
  }
}

/** Account row: identity color + name (never color alone), balance, gain and a balance trend. */
export function AccountCard({ account, events }: AccountWithEvents) {
  const summary = computeSafely(events)?.summary ?? null;
  const color = accountColorVar(account.color);

  return (
    <li>
      <Link
        to={`/accounts/${account.id}`}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-600 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{account.name}</span>
          <span className="block text-xs text-slate-500">{account.currency}</span>
        </span>
        <span className="hidden sm:block">
          <Sparkline values={balanceTrend(events)} color={color} />
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
