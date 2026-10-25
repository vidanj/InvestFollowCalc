import {
  CREDIT_NAME_MAX_LENGTH,
  MAX_PAYMENTS,
  parseRateToBps,
  paymentForTerm,
  validateCredit,
  withPlan,
  type Credit,
  type CreditDraft,
  type CreditIssue,
  type CreditPlan,
  type PaymentFrequency,
} from '../../domain/credit';
import { compareIsoDates, isIsoDate } from '../../domain/dates';
import { formatAmountInput, parseAmountToCents } from '../../domain/money';
import type { Currency, IsoDate } from '../../domain/types';
import { formatDate, strings } from '../../i18n/es-MX';

export type PaymentMode = 'term' | 'payment';

export interface CreditFormValues {
  name: string;
  currency: Currency;
  balance: string;
  rate: string;
  ivaOnInterest: boolean;
  frequency: PaymentFrequency;
  firstPaymentDate: string;
  /** Whether the user knows the number of payments or the fixed payment. */
  mode: PaymentMode;
  count: string;
  payment: string;
  fees: string;
}

export interface CreditFormErrors {
  name?: string;
  balance?: string;
  rate?: string;
  firstPaymentDate?: string;
  count?: string;
  payment?: string;
  fees?: string;
  other?: string[];
}

export type ParsedCredit =
  { ok: true; draft: CreditDraft } | { ok: false; errors: CreditFormErrors };

export function emptyCreditValues(today: IsoDate): CreditFormValues {
  return {
    name: '',
    currency: 'MXN',
    balance: '',
    rate: '',
    ivaOnInterest: true,
    frequency: 'monthly',
    firstPaymentDate: today,
    mode: 'term',
    count: '',
    payment: '',
    fees: '',
  };
}

export function valuesFromCredit(credit: Credit): CreditFormValues {
  const first = credit.plans[0];
  return {
    name: credit.name,
    currency: credit.currency,
    balance: first ? formatAmountInput(first.balance) : '',
    rate: String(credit.annualRateBps / 100),
    ivaOnInterest: credit.ivaOnInterest,
    frequency: credit.frequency,
    firstPaymentDate: first?.firstPaymentDate ?? '',
    mode: 'payment',
    count: '',
    payment: first ? formatAmountInput(first.payment) : '',
    fees: credit.upfrontFees > 0 ? formatAmountInput(credit.upfrontFees) : '',
  };
}

function parseCount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const count = Number(text.trim());
  return count >= 1 && count <= MAX_PAYMENTS ? count : null;
}

/** Puts domain issues next to the field they belong to; the rest go together. */
function placeIssues(issues: readonly CreditIssue[]): CreditFormErrors {
  const errors: CreditFormErrors = {};
  const other: string[] = [];
  for (const issue of issues) {
    const message = strings.errors.creditIssue(issue.code);
    if (issue.code === 'INVALID_FEES') errors.fees = message;
    else if (
      issue.planIndex === 0 &&
      (issue.code === 'PAYMENT_TOO_LOW' || issue.code === 'TOO_MANY_PAYMENTS')
    ) {
      errors.payment = message;
    } else other.push(message);
  }
  if (other.length > 0) errors.other = [...new Set(other)];
  return errors;
}

/**
 * Turns form text into a credit. `laterPlans` are the balance updates of the credit being edited:
 * they are kept (never dropped silently), and the whole credit must stay valid with the new terms.
 */
export function parseCreditForm(
  values: CreditFormValues,
  laterPlans: readonly CreditPlan[] = [],
): ParsedCredit {
  const errors: CreditFormErrors = {};
  const nameLength = values.name.trim().length;
  if (nameLength === 0 || nameLength > CREDIT_NAME_MAX_LENGTH) {
    errors.name = strings.errors.nameLength(CREDIT_NAME_MAX_LENGTH);
  }

  const balance = parseAmountToCents(values.balance);
  if (values.balance.trim() === '') errors.balance = strings.errors.required;
  else if (balance === null || balance <= 0) errors.balance = strings.errors.invalidAmount;

  const rate = parseRateToBps(values.rate);
  if (values.rate.trim() === '') errors.rate = strings.errors.required;
  else if (rate === null) errors.rate = strings.errors.creditIssue('INVALID_RATE');

  if (!isIsoDate(values.firstPaymentDate)) errors.firstPaymentDate = strings.errors.invalidDate;

  const fees = values.fees.trim() === '' ? 0 : parseAmountToCents(values.fees);
  if (fees === null) errors.fees = strings.errors.invalidAmount;

  let payment: number | null = null;
  if (values.mode === 'term') {
    const count = parseCount(values.count);
    if (count === null) errors.count = strings.credit.invalidCount;
    else if (balance !== null && rate !== null) {
      payment = paymentForTerm(balance, rate, values.frequency, count);
    }
  } else {
    payment = parseAmountToCents(values.payment);
    if (values.payment.trim() === '') errors.payment = strings.errors.required;
    else if (payment === null || payment <= 0) errors.payment = strings.errors.invalidAmount;
  }

  if (Object.keys(errors).length > 0 || balance === null || rate === null || fees === null) {
    return { ok: false, errors };
  }
  if (payment === null) return { ok: false, errors };

  const draft: CreditDraft = {
    name: values.name.trim(),
    currency: values.currency,
    annualRateBps: rate,
    ivaOnInterest: values.ivaOnInterest,
    frequency: values.frequency,
    upfrontFees: fees,
    plans: [{ firstPaymentDate: values.firstPaymentDate, balance, payment }, ...laterPlans],
  };
  const issues = validateCredit(draft);
  return issues.length > 0 ? { ok: false, errors: placeIssues(issues) } : { ok: true, draft };
}

// --- Balance update ("actualizar saldo") ---

export interface PlanFormValues {
  owed: string;
  nextPaymentDate: string;
  payment: string;
}

export interface PlanFormErrors {
  owed?: string;
  nextPaymentDate?: string;
  payment?: string;
  other?: string[];
}

export type ParsedPlan =
  { ok: true; plan: CreditPlan; draft: CreditDraft } | { ok: false; errors: PlanFormErrors };

/** A balance update must come after the credit's first payment (that one is edited instead). */
export function parsePlanForm(values: PlanFormValues, credit: Credit): ParsedPlan {
  const errors: PlanFormErrors = {};
  const owed = parseAmountToCents(values.owed);
  if (values.owed.trim() === '') errors.owed = strings.errors.required;
  else if (owed === null) errors.owed = strings.errors.invalidAmount;

  const first = credit.plans[0]?.firstPaymentDate;
  if (!isIsoDate(values.nextPaymentDate)) errors.nextPaymentDate = strings.errors.invalidDate;
  else if (first && compareIsoDates(values.nextPaymentDate, first) <= 0) {
    errors.nextPaymentDate = strings.credit.updateAfterFirst(formatDate(first));
  }

  // Nothing owed: no payment needed.
  const payment =
    owed === 0 && values.payment.trim() === '' ? 0 : parseAmountToCents(values.payment);
  if (owed !== 0 && values.payment.trim() === '') errors.payment = strings.errors.required;
  else if (payment === null) errors.payment = strings.errors.invalidAmount;

  if (Object.keys(errors).length > 0 || owed === null || payment === null) {
    return { ok: false, errors };
  }
  const plan: CreditPlan = { firstPaymentDate: values.nextPaymentDate, balance: owed, payment };
  const draft: CreditDraft = { ...credit, plans: withPlan(credit.plans, plan) };
  const issues = validateCredit(draft);
  if (issues.length === 0) return { ok: true, plan, draft };

  const planIndex = draft.plans.indexOf(plan);
  const planErrors: PlanFormErrors = {};
  const other: string[] = [];
  for (const issue of issues) {
    const message = strings.errors.creditIssue(issue.code);
    if (issue.planIndex === planIndex && issue.code === 'PAYMENT_TOO_LOW')
      planErrors.payment = message;
    else other.push(message);
  }
  if (other.length > 0) planErrors.other = [...new Set(other)];
  return { ok: false, errors: planErrors };
}
