import { addDays, addMonths, compareIsoDates, isIsoDate } from './dates';
import { isValidCents } from './money';
import { CURRENCIES, type Cents, type Currency, type IsoDate } from './types';

export const PAYMENT_FREQUENCIES = ['monthly', 'semimonthly', 'biweekly', 'weekly'] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

const PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  semimonthly: 24,
  biweekly: 26,
  weekly: 52,
};

/** IVA charged on the interest of each payment, in percent. */
export const IVA_PERCENT = 16;
/** 999.99% a year, in basis points. */
export const MAX_RATE_BPS = 99_999;
/** Longest schedule accepted (100 years of monthly payments). */
export const MAX_PAYMENTS = 1_200;
export const CREDIT_NAME_MAX_LENGTH = 60;

/** The terms in force from one payment on: what was owed then and the fixed payment. */
export interface CreditPlan {
  /** Date of the first payment under this plan. */
  firstPaymentDate: IsoDate;
  /** Capital owed right before that payment. */
  balance: Cents;
  /** Fixed payment per period: capital + interest, before IVA. */
  payment: Cents;
}

export interface Credit {
  id: string;
  name: string;
  currency: Currency;
  /** Fixed ordinary annual rate in basis points: 27.5% → 2750. */
  annualRateBps: number;
  /** Charges IVA on each period's interest, on top of the fixed payment. */
  ivaOnInterest: boolean;
  frequency: PaymentFrequency;
  /** Commissions and insurance charged when the credit was granted (deducted from the money received). */
  upfrontFees: Cents;
  /** The credit as registered first, then each balance update, in date order. */
  plans: CreditPlan[];
}

export type CreditDraft = Omit<Credit, 'id'>;
type CreditTerms = Pick<Credit, 'annualRateBps' | 'ivaOnInterest' | 'frequency' | 'plans'>;

export interface CreditPayment {
  /** 1-based, across the whole credit. */
  number: number;
  date: IsoDate;
  /** Index of the plan this payment belongs to. */
  planIndex: number;
  openingBalance: Cents;
  /** Fixed payment applied (capital + interest); the last one only covers what is left. */
  payment: Cents;
  principal: Cents;
  interest: Cents;
  iva: Cents;
  /** What is actually paid: `payment + iva`. */
  total: Cents;
  closingBalance: Cents;
}

/** A balance update compared with what the previous plan expected at that date. */
export interface PlanChange {
  planIndex: number;
  date: IsoDate;
  expectedBalance: Cents;
  newBalance: Cents;
  /** `expectedBalance − newBalance`: positive when less is owed than planned (e.g. an extra payment). */
  difference: Cents;
}

export interface CreditSchedule {
  payments: CreditPayment[];
  changes: PlanChange[];
}

export type CreditIssueCode =
  | 'INVALID_NAME'
  | 'INVALID_CURRENCY'
  | 'INVALID_RATE'
  | 'INVALID_FREQUENCY'
  | 'INVALID_FEES'
  | 'NO_PLANS'
  | 'INVALID_DATE'
  | 'PLANS_OUT_OF_ORDER'
  | 'INVALID_BALANCE'
  | 'INVALID_PAYMENT'
  | 'PAYMENT_TOO_LOW'
  | 'TOO_MANY_PAYMENTS';

export interface CreditIssue {
  code: CreditIssueCode;
  planIndex?: number;
}

export class CreditScheduleError extends Error {
  readonly code: 'PAYMENT_TOO_LOW' | 'TOO_MANY_PAYMENTS';
  readonly planIndex: number;

  constructor(code: CreditScheduleError['code'], planIndex: number) {
    super(code);
    this.name = 'CreditScheduleError';
    this.code = code;
    this.planIndex = planIndex;
  }
}

// --- Interest ---

/** Days in a period as banks print them: 365 / payments per year, to 4 decimals (15.2083). */
function periodDaysScaled(frequency: PaymentFrequency): number {
  return Math.round((365 / PAYMENTS_PER_YEAR[frequency]) * 10_000);
}

export function periodDays(frequency: PaymentFrequency): number {
  return periodDaysScaled(frequency) / 10_000;
}

/** `numerator / denominator` rounded to the nearest integer, halves up (both non-negative). */
function divRoundHalfUp(numerator: bigint, denominator: bigint): number {
  return Number((2n * numerator + denominator) / (2n * denominator));
}

/**
 * Interest of one period: `balance × annual rate / 360 × days of the period`, rounded to the cent.
 * Integer arithmetic, so it stays exact for any balance.
 */
export function periodInterest(
  balance: Cents,
  annualRateBps: number,
  frequency: PaymentFrequency,
): Cents {
  return divRoundHalfUp(
    BigInt(balance) * BigInt(annualRateBps) * BigInt(periodDaysScaled(frequency)),
    10_000n * 10_000n * 360n,
  );
}

export function ivaOnInterest(interest: Cents): Cents {
  return divRoundHalfUp(BigInt(interest) * BigInt(IVA_PERCENT), 100n);
}

/** Smallest fixed payment that still lowers the debt (it must exceed the interest). */
export function minimumPayment(
  balance: Cents,
  annualRateBps: number,
  frequency: PaymentFrequency,
): Cents {
  return periodInterest(balance, annualRateBps, frequency) + 1;
}

// --- Dates ---

/** `date`'s month with `day`, clamped to the month's length. */
function withDay(date: IsoDate, day: number): IsoDate {
  const monthStart = `${date.slice(0, 8)}01`;
  const lastDay = Number(addDays(addMonths(monthStart, 1), -1).slice(8));
  return `${date.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Date of payment `index` (0 = the first) of a plan starting on `first`. */
export function paymentDate(first: IsoDate, frequency: PaymentFrequency, index: number): IsoDate {
  switch (frequency) {
    case 'monthly':
      return addMonths(first, index);
    case 'weekly':
      return addDays(first, 7 * index);
    case 'biweekly':
      return addDays(first, 14 * index);
    case 'semimonthly': {
      const half = Math.floor(index / 2);
      if (index % 2 === 0) return addMonths(first, half);
      // The month's other payment day is 15 days apart: 2 ↔ 17, 15 ↔ 30, 20 ↔ 5.
      const day = Number(first.slice(8));
      return day <= 15
        ? withDay(addMonths(first, half), day + 15)
        : withDay(addMonths(first, half + 1), day - 15);
    }
  }
}

// --- Schedule ---

/** Payments of one plan if nothing changed; `Infinity` when the debt would never go down. */
function countPayments(
  balance: Cents,
  annualRateBps: number,
  frequency: PaymentFrequency,
  payment: Cents,
): number {
  let count = 0;
  for (let left = balance; left > 0; count++) {
    const interest = periodInterest(left, annualRateBps, frequency);
    if (payment <= interest || count >= MAX_PAYMENTS) return Infinity;
    left -= payment - interest;
  }
  return count;
}

/**
 * Fixed payment (before IVA) that pays `balance` off in `count` payments: the standard annuity
 * formula, rounded to the cent and raised by cents if rounding would leave a tiny extra payment.
 */
export function paymentForTerm(
  balance: Cents,
  annualRateBps: number,
  frequency: PaymentFrequency,
  count: number,
): Cents {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`Invalid term: ${count}`);
  if (balance <= 0) return 0;
  const rate = (annualRateBps / 10_000) * (periodDays(frequency) / 360);
  const exact = rate === 0 ? balance / count : (balance * rate) / (1 - (1 + rate) ** -count);
  let payment = Math.max(1, Math.round(exact));
  while (countPayments(balance, annualRateBps, frequency, payment) > count) payment++;
  return payment;
}

/**
 * Every payment of the credit. Each plan runs from its first payment until the debt is paid or
 * the next plan starts; the last payment of the credit only covers what is left.
 *
 * @throws {CreditScheduleError} when a payment never lowers the debt or the schedule is too long.
 */
export function buildSchedule(credit: CreditTerms): CreditSchedule {
  const { annualRateBps, ivaOnInterest: withIva, frequency, plans } = credit;
  const payments: CreditPayment[] = [];
  const changes: PlanChange[] = [];
  let balance = 0;

  plans.forEach((plan, planIndex) => {
    if (planIndex > 0) {
      changes.push({
        planIndex,
        date: plan.firstPaymentDate,
        expectedBalance: balance,
        newBalance: plan.balance,
        difference: balance - plan.balance,
      });
    }
    balance = plan.balance;
    const nextPlanDate = plans[planIndex + 1]?.firstPaymentDate;

    for (let index = 0; balance > 0; index++) {
      const date = paymentDate(plan.firstPaymentDate, frequency, index);
      if (nextPlanDate !== undefined && compareIsoDates(date, nextPlanDate) >= 0) break;
      if (payments.length >= MAX_PAYMENTS) {
        throw new CreditScheduleError('TOO_MANY_PAYMENTS', planIndex);
      }
      const interest = periodInterest(balance, annualRateBps, frequency);
      if (plan.payment <= interest) throw new CreditScheduleError('PAYMENT_TOO_LOW', planIndex);

      const payment = Math.min(plan.payment, balance + interest);
      const principal = payment - interest;
      const iva = withIva ? ivaOnInterest(interest) : 0;
      payments.push({
        number: payments.length + 1,
        date,
        planIndex,
        openingBalance: balance,
        payment,
        principal,
        interest,
        iva,
        total: payment + iva,
        closingBalance: balance - principal,
      });
      balance -= principal;
    }
  });

  return { payments, changes };
}

/**
 * The plans with `plan` added: a plan starting on the same date is replaced, and the list stays in
 * date order.
 */
export function withPlan(plans: readonly CreditPlan[], plan: CreditPlan): CreditPlan[] {
  return [...plans.filter((p) => p.firstPaymentDate !== plan.firstPaymentDate), plan].sort((a, b) =>
    compareIsoDates(a.firstPaymentDate, b.firstPaymentDate),
  );
}

/** Capital the schedule expects to be owed right before a payment on `date` (0 once paid off). */
export function expectedBalanceAt(payments: readonly CreditPayment[], date: IsoDate): Cents {
  return payments.find((p) => compareIsoDates(p.date, date) >= 0)?.openingBalance ?? 0;
}

// --- Summary ---

export interface CreditSummary extends CreditSchedule {
  /** What was owed when the credit was registered. */
  principal: Cents;
  /** `principal − upfrontFees`: the money actually received. */
  received: Cents;
  /** Every payment of the schedule, IVA included. */
  totalPaid: Cents;
  totalInterest: Cents;
  totalIva: Cents;
  /** What the credit costs on top of the money received: interest + IVA + upfront fees. */
  totalCost: Cents;
  /** Sum of the balance updates' differences (positive: less owed than planned). */
  balanceAdjustments: Cents;
  /** Payments dated today or earlier: the plan assumes each one is made on its date. */
  paidSoFar: Cents;
  paymentsMade: number;
  remainingToPay: Cents;
  paymentsLeft: number;
  /** Capital owed right before the next payment; 0 once paid off. */
  currentBalance: Cents;
  nextPayment: CreditPayment | null;
  /** Date of the final payment: when the credit is paid off. */
  lastPaymentDate: IsoDate | null;
  isPaidOff: boolean;
  /** Share of `totalPaid` already paid, from 0 to 1. */
  progress: number;
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Schedule and totals of a credit as of `today`. */
export function computeCredit(
  credit: Pick<Credit, 'upfrontFees'> & CreditTerms,
  today: IsoDate,
): CreditSummary {
  const schedule = buildSchedule(credit);
  const { payments, changes } = schedule;
  const paid = payments.filter((p) => compareIsoDates(p.date, today) <= 0);
  const nextPayment = payments[paid.length] ?? null;
  const principal = credit.plans[0]?.balance ?? 0;
  const totalInterest = sum(payments.map((p) => p.interest));
  const totalIva = sum(payments.map((p) => p.iva));
  const totalPaid = sum(payments.map((p) => p.total));
  const paidSoFar = sum(paid.map((p) => p.total));

  return {
    ...schedule,
    principal,
    received: principal - credit.upfrontFees,
    totalPaid,
    totalInterest,
    totalIva,
    totalCost: totalInterest + totalIva + credit.upfrontFees,
    balanceAdjustments: sum(changes.map((c) => c.difference)),
    paidSoFar,
    paymentsMade: paid.length,
    remainingToPay: totalPaid - paidSoFar,
    paymentsLeft: payments.length - paid.length,
    currentBalance: nextPayment?.openingBalance ?? 0,
    nextPayment,
    lastPaymentDate: payments.at(-1)?.date ?? null,
    isPaidOff: nextPayment === null,
    progress: totalPaid === 0 ? 1 : paidSoFar / totalPaid,
  };
}

// --- Input and validation ---

const RATE_PATTERN = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** Reads an annual rate typed as a percentage ("27.5", "27.50 %") into basis points. */
export function parseRateToBps(input: string): number | null {
  const match = RATE_PATTERN.exec(input.trim().replace(/\s*%$/, ''));
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return bps <= MAX_RATE_BPS ? bps : null;
}

function isNonNegativeCents(value: number): boolean {
  return isValidCents(value) && value >= 0;
}

/** Checks a credit before it is stored. The UI maps each issue code to a text in `src/i18n`. */
export function validateCredit(credit: CreditDraft): CreditIssue[] {
  const issues: CreditIssue[] = [];
  const nameLength = credit.name.trim().length;
  if (nameLength === 0 || nameLength > CREDIT_NAME_MAX_LENGTH)
    issues.push({ code: 'INVALID_NAME' });
  if (!CURRENCIES.includes(credit.currency)) issues.push({ code: 'INVALID_CURRENCY' });
  if (
    !Number.isInteger(credit.annualRateBps) ||
    credit.annualRateBps < 0 ||
    credit.annualRateBps > MAX_RATE_BPS
  ) {
    issues.push({ code: 'INVALID_RATE' });
  }
  if (!PAYMENT_FREQUENCIES.includes(credit.frequency)) issues.push({ code: 'INVALID_FREQUENCY' });
  // An invalid first balance is reported on its own plan.
  const principal = Math.max(credit.plans[0]?.balance ?? 0, 0);
  if (!isNonNegativeCents(credit.upfrontFees) || credit.upfrontFees > principal) {
    issues.push({ code: 'INVALID_FEES' });
  }
  if (credit.plans.length === 0) issues.push({ code: 'NO_PLANS' });

  credit.plans.forEach((plan, planIndex) => {
    if (!isIsoDate(plan.firstPaymentDate)) {
      issues.push({ code: 'INVALID_DATE', planIndex });
    } else {
      const previous = credit.plans[planIndex - 1];
      if (previous && compareIsoDates(plan.firstPaymentDate, previous.firstPaymentDate) <= 0) {
        issues.push({ code: 'PLANS_OUT_OF_ORDER', planIndex });
      }
    }
    if (!isNonNegativeCents(plan.balance)) issues.push({ code: 'INVALID_BALANCE', planIndex });
    const minimum = plan.balance > 0 ? 1 : 0;
    if (!isValidCents(plan.payment) || plan.payment < minimum) {
      issues.push({ code: 'INVALID_PAYMENT', planIndex });
    }
  });

  // The schedule is only meaningful once every field is valid.
  if (issues.length > 0) return issues;
  try {
    buildSchedule(credit);
  } catch (error) {
    if (!(error instanceof CreditScheduleError)) throw error;
    issues.push({ code: error.code, planIndex: error.planIndex });
  }
  return issues;
}
