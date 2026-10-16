import { daysBetween } from './dates';
import {
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  SHORT_PERIOD_DAYS,
  type AccountComputation,
  type AccountEvent,
  type BalanceEvent,
  type Cents,
  type IsoDate,
  type Period,
} from './types';
import { DomainValidationError, sortEvents, validateTimeline } from './validation';

interface Valuation {
  date: IsoDate;
  balance: Cents;
}

interface PendingFlow {
  date: IsoDate;
  /** Positive for deposits, negative for withdrawals. */
  signed: Cents;
}

/**
 * Share of the period during which a flow was invested (Modified Dietz weight).
 * A flow on the start date weighs 1, one on the end date weighs 0. Same-day periods use 0.5.
 */
function flowWeight(flowDate: IsoDate, endDate: IsoDate, days: number): number {
  if (days === 0) return 0.5;
  return daysBetween(flowDate, endDate) / days;
}

/** Modified Dietz return of one period; `null` when the invested base is not positive. */
function periodReturn(
  gain: Cents,
  startBalance: Cents,
  flows: readonly PendingFlow[],
  endDate: IsoDate,
  days: number,
): number | null {
  if (gain === 0) return 0;
  const weightedFlows = flows.reduce(
    (sum, flow) => sum + flowWeight(flow.date, endDate, days) * flow.signed,
    0,
  );
  const base = startBalance + weightedFlows;
  return base > 0 ? gain / base : null;
}

function sumFlows(flows: readonly PendingFlow[]): Cents {
  return flows.reduce((sum, flow) => sum + flow.signed, 0);
}

/**
 * Computes every period and the summary of one account from its full event list.
 * Always recomputes from scratch, so edits and deletions need no special handling.
 *
 * @throws {DomainValidationError} when the timeline is invalid (see `validateTimeline`).
 */
export function computeAccount(events: readonly AccountEvent[]): AccountComputation {
  if (events.length === 0) return { periods: [], summary: null };

  const issues = validateTimeline(events);
  if (issues.length > 0) throw new DomainValidationError(issues);

  const [first, ...rest] = sortEvents(events);
  // Validation guarantees the first event is the initial balance.
  const initial = first as BalanceEvent;

  const periods: Period[] = [];
  let last: Valuation = { date: initial.date, balance: initial.balance };
  let pending: PendingFlow[] = [];
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let cumulativeGain = 0;

  const closePeriod = (date: IsoDate, balance: Cents, eventId: string): void => {
    const netFlow = sumFlows(pending);
    const gain = balance - last.balance - netFlow;
    const days = daysBetween(last.date, date);
    // Same-day stretches with nothing generated carry no information for the user.
    if (days > 0 || gain !== 0) {
      cumulativeGain += gain;
      periods.push({
        startDate: last.date,
        endDate: date,
        days,
        startBalance: last.balance,
        endBalance: balance,
        netFlow,
        gain,
        returnRate: periodReturn(gain, last.balance, pending, date, days),
        cumulativeGain,
        endEventId: eventId,
      });
    }
    last = { date, balance };
    pending = [];
  };

  for (const event of rest) {
    if (event.type === 'balance') {
      closePeriod(event.date, event.balance, event.id);
      continue;
    }

    const signed = event.type === 'deposit' ? event.amount : -event.amount;
    if (event.type === 'deposit') totalDeposits += event.amount;
    else totalWithdrawals += event.amount;

    if (event.balanceAfter === undefined) {
      // Absorbed by the next known balance.
      pending.push({ date: event.date, signed });
      continue;
    }

    // Known balance after the movement: close the gain right before it, then restart from it.
    closePeriod(event.date, event.balanceAfter - signed, event.id);
    last = { date: event.date, balance: event.balanceAfter };
  }

  const pendingFlow = sumFlows(pending);
  const netContributed = initial.balance + totalDeposits - totalWithdrawals;
  const elapsedDays = daysBetween(initial.date, last.date);
  const totalGain = cumulativeGain;

  const chainedRates = periods.flatMap((p) => (p.returnRate === null ? [] : [p.returnRate]));
  const twr =
    chainedRates.length === 0
      ? null
      : chainedRates.reduce((growth, rate) => growth * (1 + rate), 1) - 1;
  const annualizedTwr =
    twr !== null && elapsedDays > 0 && 1 + twr > 0
      ? Math.pow(1 + twr, DAYS_PER_YEAR / elapsedDays) - 1
      : null;

  return {
    periods,
    summary: {
      startDate: initial.date,
      lastValuationDate: last.date,
      initialBalance: initial.balance,
      totalDeposits,
      totalWithdrawals,
      netContributed,
      currentBalance: last.balance + pendingFlow,
      pendingFlow,
      hasPendingFlows: pending.length > 0,
      totalGain,
      simpleReturn: periods.length > 0 && netContributed > 0 ? totalGain / netContributed : null,
      twr,
      annualizedTwr,
      twrExcludedPeriods: periods.length - chainedRates.length,
      elapsedDays,
      isShortPeriod: elapsedDays < SHORT_PERIOD_DAYS,
      avgDailyGain: elapsedDays > 0 ? Math.round(totalGain / elapsedDays) : null,
      avgMonthlyGain:
        elapsedDays > 0 ? Math.round((totalGain / elapsedDays) * DAYS_PER_MONTH) : null,
    },
  };
}
