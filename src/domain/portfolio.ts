import { compareIsoDates } from './dates';
import { computeAccount } from './engine';
import {
  CURRENCIES,
  type Account,
  type AccountComputation,
  type AccountEvent,
  type BalanceEvent,
  type Cents,
  type Currency,
  type EventDraft,
  type IsoDate,
} from './types';
import { DomainValidationError, sortEvents, validateTimeline } from './validation';

export interface PortfolioInput {
  account: Account;
  events: readonly AccountEvent[];
}

export interface CurrencyPortfolio {
  currency: Currency;
  accountIds: string[];
  computation: AccountComputation;
}

interface TaggedEvent {
  accountIndex: number;
  event: AccountEvent;
  isInitial: boolean;
}

function groupByDate(items: readonly TaggedEvent[]): Map<IsoDate, TaggedEvent[]> {
  const groups = new Map<IsoDate, TaggedEvent[]>();
  for (const item of items) {
    const group = groups.get(item.event.date);
    if (group) group.push(item);
    else groups.set(item.event.date, [item]);
  }
  return groups;
}

/**
 * Merges several accounts (same currency) into one synthetic timeline that `computeAccount` can
 * process as if it were a single account:
 * - The portfolio starts with the sum of the initial balances on the earliest date.
 * - An account that starts later enters as a deposit of its initial balance.
 * - Every deposit/withdrawal is kept as a portfolio flow.
 * - On each date where any account reports a balance, the portfolio value is the sum of every
 *   account's latest known balance (plus its flows registered since then).
 *
 * As a result, portfolio gains equal the sum of the accounts' gains.
 */
export function buildPortfolioTimeline(
  eventLists: readonly (readonly AccountEvent[])[],
): AccountEvent[] {
  for (const events of eventLists) {
    const issues = validateTimeline(events);
    if (issues.length > 0) throw new DomainValidationError(issues);
  }

  const tagged: TaggedEvent[] = eventLists.flatMap((events, accountIndex) =>
    sortEvents(events).map((event, position) => ({
      accountIndex,
      event,
      isInitial: position === 0,
    })),
  );
  // Within a date, accounts that start that day go first.
  tagged.sort(
    (a, b) =>
      compareIsoDates(a.event.date, b.event.date) ||
      Number(b.isInitial) - Number(a.isInitial) ||
      a.accountIndex - b.accountIndex ||
      a.event.seq - b.event.seq,
  );

  const values = new Map<number, Cents>();
  const timeline: AccountEvent[] = [];
  let started = false;

  const push = (draft: EventDraft): void => {
    const seq = timeline.length;
    timeline.push({ ...draft, id: `portfolio-${seq}`, seq });
  };
  const totalValue = (): Cents => [...values.values()].reduce((sum, v) => sum + v, 0);
  const start = (date: IsoDate): void => {
    push({ type: 'balance', date, balance: totalValue() });
    started = true;
  };

  for (const [date, group] of groupByDate(tagged)) {
    let valued = false;

    for (const { accountIndex, event, isInitial } of group) {
      if (isInitial) {
        // Validation guarantees every account starts with a balance event.
        const { balance } = event as BalanceEvent;
        values.set(accountIndex, balance);
        if (started) {
          // A new account brings its initial balance as fresh capital.
          if (balance > 0) push({ type: 'deposit', date, amount: balance });
          valued = true;
        }
        continue;
      }
      if (!started) start(date);

      if (event.type === 'balance') {
        values.set(accountIndex, event.balance);
        valued = true;
        continue;
      }

      push({ type: event.type, date, amount: event.amount });
      if (event.balanceAfter === undefined) {
        const signed = event.type === 'deposit' ? event.amount : -event.amount;
        values.set(accountIndex, (values.get(accountIndex) ?? 0) + signed);
      } else {
        values.set(accountIndex, event.balanceAfter);
        valued = true;
      }
    }

    if (!started) start(date);
    else if (valued) push({ type: 'balance', date, balance: totalValue() });
  }

  return timeline;
}

/**
 * Aggregates accounts per currency. Never mixes currencies. The caller decides which accounts to
 * include (e.g. whether archived accounts count). Accounts without events are ignored.
 */
export function computePortfolio(inputs: readonly PortfolioInput[]): CurrencyPortfolio[] {
  return CURRENCIES.flatMap((currency) => {
    const members = inputs.filter(
      (input) => input.account.currency === currency && input.events.length > 0,
    );
    if (members.length === 0) return [];

    const timeline = buildPortfolioTimeline(members.map((m) => m.events));
    return [
      {
        currency,
        accountIds: members.map((m) => m.account.id),
        computation: computeAccount(timeline),
      },
    ];
  });
}
