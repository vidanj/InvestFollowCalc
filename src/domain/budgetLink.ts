import { BUDGET_NAME_MAX_LENGTH, type BudgetItem, type BudgetItemDraft } from './budget';
import { toYearMonth } from './months';
import type { AccountEvent, Currency, FlowEvent } from './types';

/**
 * The budget item that mirrors a movement taken from (contribution) or brought into (withdrawal)
 * the month's budget: a one-off in the movement's month and in the account's currency, so the
 * user does not register the same money twice. Contributions are `investment` expenses and
 * withdrawals are incomes.
 */
export function linkedBudgetItem(
  event: FlowEvent,
  currency: Currency,
  name: string,
): BudgetItemDraft {
  const base = {
    name: name.trim().slice(0, BUDGET_NAME_MAX_LENGTH).trim(),
    amount: event.amount,
    currency,
    month: toYearMonth(event.date),
    repeat: 'none' as const,
    sourceEventId: event.id,
  };
  return event.type === 'deposit'
    ? { kind: 'expense', category: 'investment', ...base }
    : { kind: 'income', ...base };
}

/** The item still says exactly what its movement says (kind, amount, month and currency). */
export function isLinkConsistent(
  item: BudgetItem,
  event: AccountEvent,
  currency: Currency,
): boolean {
  if (event.type === 'balance' || item.sourceEventId !== event.id) return false;
  const expected = linkedBudgetItem(event, currency, item.name);
  return (
    item.kind === expected.kind &&
    item.amount === expected.amount &&
    item.month === expected.month &&
    item.currency === expected.currency &&
    item.repeat === 'none'
  );
}
