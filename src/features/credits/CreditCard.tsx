import { Link } from 'react-router';
import type { CreditRecord } from '../../db/schema';
import type { CreditSummary } from '../../domain/credit';
import { formatMoney } from '../../domain/money';
import { formatDate, formatWholePercent, strings } from '../../i18n/es-MX';

const t = strings.credit;

/** Credit row: what is still owed, when it ends, and how much of it is already paid. */
export function CreditCard({
  credit,
  summary,
}: {
  credit: CreditRecord;
  summary: CreditSummary | null;
}) {
  const ends = summary?.lastPaymentDate ? formatDate(summary.lastPaymentDate) : null;
  return (
    <li>
      <Link
        to={`/credits/${credit.id}`}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-600 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium">{credit.name}</span>
            <span className="block text-xs text-slate-500">
              {credit.currency} · {t.frequencies[credit.frequency]}
            </span>
          </span>
          {summary && (
            <span className="text-right tabular-nums">
              <span className="block font-medium">
                {formatMoney(summary.currentBalance, credit.currency)}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {ends === null
                  ? t.nothingOwed
                  : summary.isPaidOff
                    ? t.paidOffOn(ends)
                    : t.endsOn(ends)}
              </span>
            </span>
          )}
        </span>
        {summary && !summary.isPaidOff && (
          <span className="flex flex-col gap-1">
            <span
              aria-hidden="true"
              className="h-1.5 w-full overflow-hidden rounded-full bg-(--meter-track)"
            >
              <span
                className="block h-full rounded-full bg-(--meter-fill)"
                style={{ width: `${summary.progress * 100}%` }}
              />
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {t.progress(formatWholePercent(summary.progress))}
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}
