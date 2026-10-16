export const CURRENCIES = ['USD', 'MXN'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Money amount in minor units (cents). Always a safe integer. */
export type Cents = number;

/** Calendar date in ISO format `YYYY-MM-DD` (no time, no timezone). */
export type IsoDate = string;

export interface Account {
  id: string;
  name: string;
  currency: Currency;
  color: string;
  archived: boolean;
}

interface EventBase {
  id: string;
  date: IsoDate;
  /** Capture order among events of the same account on the same date. */
  seq: number;
}

/** The user reports the current balance of the account ("Actualizar saldo"). */
export interface BalanceEvent extends EventBase {
  type: 'balance';
  balance: Cents;
}

/** Money the user adds to (deposit) or takes out of (withdrawal) the account. */
export interface FlowEvent extends EventBase {
  type: 'deposit' | 'withdrawal';
  /** Always positive; the direction comes from `type`. */
  amount: Cents;
  /** Account balance right after the movement, when the user knows it. */
  balanceAfter?: Cents;
}

export type AccountEvent = BalanceEvent | FlowEvent;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as the user describes it, before it gets an id and a capture order. */
export type EventDraft = DistributiveOmit<AccountEvent, 'id' | 'seq'>;

/** A stretch of time between two consecutive known balances. */
export interface Period {
  startDate: IsoDate;
  endDate: IsoDate;
  days: number;
  startBalance: Cents;
  endBalance: Cents;
  /** Deposits minus withdrawals that happened inside the period. */
  netFlow: Cents;
  /** What the account generated in the period: `endBalance − startBalance − netFlow`. */
  gain: Cents;
  /** Modified Dietz return of the period; `null` when it cannot be computed (base ≤ 0). */
  returnRate: number | null;
  cumulativeGain: Cents;
  /** Event whose balance closed this period. */
  endEventId: string;
}

export interface AccountSummary {
  startDate: IsoDate;
  /** Date of the last known balance. */
  lastValuationDate: IsoDate;
  initialBalance: Cents;
  totalDeposits: Cents;
  totalWithdrawals: Cents;
  /** `initialBalance + totalDeposits − totalWithdrawals`. */
  netContributed: Cents;
  /** Last known balance plus the flows registered after it. */
  currentBalance: Cents;
  /** Flows registered after the last known balance (not yet reflected in any gain). */
  pendingFlow: Cents;
  hasPendingFlows: boolean;
  /** Always equals `currentBalance − netContributed`. */
  totalGain: Cents;
  /** `totalGain / netContributed`; `null` when `netContributed ≤ 0`. */
  simpleReturn: number | null;
  /** Time-weighted return: chained period returns. */
  twr: number | null;
  annualizedTwr: number | null;
  /** Periods left out of the TWR chain because their return could not be computed. */
  twrExcludedPeriods: number;
  /** Days between the initial balance and the last known balance. */
  elapsedDays: number;
  /** Fewer than {@link SHORT_PERIOD_DAYS} days: annualized figures are only an estimate. */
  isShortPeriod: boolean;
  avgDailyGain: Cents | null;
  avgMonthlyGain: Cents | null;
}

export interface AccountComputation {
  periods: Period[];
  /** `null` when the account has no events yet. */
  summary: AccountSummary | null;
}

export const SHORT_PERIOD_DAYS = 30;
export const DAYS_PER_YEAR = 365;
export const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
