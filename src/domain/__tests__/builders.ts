import type { Account, BalanceEvent, Currency, FlowEvent, IsoDate } from '../types';

// Test helpers: amounts are written in whole currency units (pesos/dollars) and stored as cents.

let counter = 0;
const next = (): number => ++counter;

export const cents = (units: number): number => Math.round(units * 100);

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Events get an increasing `seq`, so same-day events keep the order they were built in. */
export function balance(date: IsoDate, units: number): BalanceEvent {
  const n = next();
  return { id: `e${n}`, seq: n, date, type: 'balance', balance: cents(units) };
}

function flow(
  type: FlowEvent['type'],
  date: IsoDate,
  units: number,
  balanceAfterUnits?: number,
): FlowEvent {
  const n = next();
  return {
    id: `e${n}`,
    seq: n,
    date,
    type,
    amount: cents(units),
    ...(balanceAfterUnits === undefined ? {} : { balanceAfter: cents(balanceAfterUnits) }),
  };
}

export const deposit = (date: IsoDate, units: number, balanceAfterUnits?: number): FlowEvent =>
  flow('deposit', date, units, balanceAfterUnits);

export const withdrawal = (date: IsoDate, units: number, balanceAfterUnits?: number): FlowEvent =>
  flow('withdrawal', date, units, balanceAfterUnits);

export function account(id: string, currency: Currency = 'MXN'): Account {
  return { id, name: id, currency, color: '#0f766e', archived: false };
}
