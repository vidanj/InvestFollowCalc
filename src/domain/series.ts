import { addMonths, compareIsoDates } from './dates';
import type { AccountEvent, Cents, IsoDate, Period } from './types';
import { DomainValidationError, sortEvents, validateTimeline } from './validation';

/** State of an account (or portfolio) at the end of a date with movements. */
export interface SeriesPoint {
  date: IsoDate;
  balance: Cents;
  /** Net contributed capital up to this date. */
  contributed: Cents;
  /** `balance − contributed`: generated so far. */
  gain: Cents;
  /** True when the balance includes deposits/withdrawals not yet confirmed by a known balance. */
  estimated: boolean;
}

/** One point per date with events, in chronological order, for charts and their data tables. */
export function buildSeries(events: readonly AccountEvent[]): SeriesPoint[] {
  const issues = validateTimeline(events);
  if (issues.length > 0) throw new DomainValidationError(issues);

  const points: SeriesPoint[] = [];
  let balance = 0;
  let contributed = 0;
  let estimated = false;

  sortEvents(events).forEach((event, index) => {
    if (event.type === 'balance') {
      balance = event.balance;
      if (index === 0) contributed = event.balance;
      estimated = false;
    } else {
      const signed = event.type === 'deposit' ? event.amount : -event.amount;
      contributed += signed;
      if (event.balanceAfter === undefined) {
        balance += signed;
        estimated = true;
      } else {
        balance = event.balanceAfter;
        estimated = false;
      }
    }

    const point = {
      date: event.date,
      balance,
      contributed,
      gain: balance - contributed,
      estimated,
    };
    if (points.at(-1)?.date === event.date) points[points.length - 1] = point;
    else points.push(point);
  });

  return points;
}

/** Best and worst periods by return rate; `null` when fewer than two periods can be compared. */
export function rankPeriods(periods: readonly Period[]): { best: Period; worst: Period } | null {
  const rated = periods.filter((p) => p.returnRate !== null);
  const [first, ...rest] = rated;
  if (!first || rest.length === 0) return null;

  let best = first;
  let worst = first;
  for (const period of rest) {
    if ((period.returnRate ?? 0) > (best.returnRate ?? 0)) best = period;
    if ((period.returnRate ?? 0) < (worst.returnRate ?? 0)) worst = period;
  }
  return best.returnRate === worst.returnRate ? null : { best, worst };
}

export const RANGES = ['1M', '3M', '6M', '1Y', 'ALL'] as const;
export type RangeKey = (typeof RANGES)[number];

const RANGE_MONTHS: Record<Exclude<RangeKey, 'ALL'>, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '1Y': 12,
};

/** First date included by `range`, counting back from `today`; `null` means everything. */
export function rangeStart(range: RangeKey, today: IsoDate): IsoDate | null {
  return range === 'ALL' ? null : addMonths(today, -RANGE_MONTHS[range]);
}

export function isInRange(date: IsoDate, start: IsoDate | null): boolean {
  return start === null || compareIsoDates(date, start) >= 0;
}
