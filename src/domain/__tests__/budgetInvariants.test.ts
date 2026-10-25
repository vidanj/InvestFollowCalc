import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  creditMonthPayments,
  EXPENSE_CATEGORIES,
  occurrencesIn,
  REPEATS,
  scheduledIn,
  summarizeMonth,
  summarizeYear,
  validateBudgetItem,
  type BudgetItem,
} from '../budget';
import {
  buildSchedule,
  computeCredit,
  minimumPayment,
  PAYMENT_FREQUENCIES,
  type Credit,
} from '../credit';
import { addDays } from '../dates';
import { addMonthsToYearMonth } from '../months';
import { CURRENCIES } from '../types';

const MAX_AMOUNT = 100_000_000; // 1 million in cents

const creditArb: fc.Arbitrary<Credit> = fc
  .record({
    rate: fc.integer({ min: 0, max: 9_999 }),
    iva: fc.boolean(),
    frequency: fc.constantFrom(...PAYMENT_FREQUENCIES),
    balance: fc.integer({ min: 1, max: MAX_AMOUNT }),
    // Payments between the minimum and twice the balance: from very long to a single payment.
    paymentShare: fc.double({ min: 0.02, max: 2, noNaN: true }),
    updates: fc.array(
      fc.record({
        gap: fc.integer({ min: 1, max: 200 }),
        balance: fc.integer({ min: 0, max: MAX_AMOUNT }),
        paymentShare: fc.double({ min: 0.02, max: 2, noNaN: true }),
      }),
      { maxLength: 3 },
    ),
  })
  .map(({ rate, iva, frequency, balance, paymentShare, updates }) => {
    const payment = (owed: number, share: number) =>
      Math.max(minimumPayment(owed, rate, frequency), Math.ceil(owed * share));
    let date = '2026-01-05';
    const plans = [{ firstPaymentDate: date, balance, payment: payment(balance, paymentShare) }];
    for (const update of updates) {
      date = addDays(date, update.gap);
      plans.push({
        firstPaymentDate: date,
        balance: update.balance,
        payment: payment(update.balance, update.paymentShare),
      });
    }
    return {
      id: 'c',
      name: 'c',
      currency: 'MXN' as const,
      annualRateBps: rate,
      ivaOnInterest: iva,
      frequency,
      upfrontFees: 0,
      plans,
    };
  });

/** Skips the rare generated credits whose schedule is longer than the app accepts. */
function scheduleOf(credit: Credit) {
  try {
    return buildSchedule(credit);
  } catch {
    return null;
  }
}

describe('credit invariants', () => {
  it('capital paid = first balance − balance updates; each payment = capital + interest + IVA', () => {
    fc.assert(
      fc.property(creditArb, (credit) => {
        const schedule = scheduleOf(credit);
        if (!schedule) return;
        const { payments, changes } = schedule;
        const principal = payments.reduce((s, p) => s + p.principal, 0);
        const adjustments = changes.reduce((s, c) => s + c.difference, 0);
        expect(principal).toBe(credit.plans[0]!.balance - adjustments);

        for (const p of payments) {
          expect(p.total).toBe(p.payment + p.iva);
          expect(p.payment).toBe(p.principal + p.interest);
          expect(p.principal).toBeGreaterThan(0);
          expect(p.closingBalance).toBe(p.openingBalance - p.principal);
          expect(p.closingBalance).toBeGreaterThanOrEqual(0);
          if (!credit.ivaOnInterest) expect(p.iva).toBe(0);
        }
        // The debt always ends at exactly 0: the last payment closes it, or a later balance
        // update set it to 0.
        const last = payments.at(-1);
        if (last && last.planIndex === credit.plans.length - 1) {
          expect(last.closingBalance).toBe(0);
        } else {
          expect(credit.plans.at(-1)!.balance).toBe(0);
        }
        // Payment dates only move forward.
        for (let i = 1; i < payments.length; i++) {
          expect(payments[i]!.date > payments[i - 1]!.date).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('paid so far + still to pay = total, on any day', () => {
    fc.assert(
      fc.property(creditArb, fc.integer({ min: -30, max: 4_000 }), (credit, offset) => {
        if (!scheduleOf(credit)) return;
        const summary = computeCredit(credit, addDays('2026-01-05', offset));
        expect(summary.paidSoFar + summary.remainingToPay).toBe(summary.totalPaid);
        expect(summary.paymentsMade + summary.paymentsLeft).toBe(summary.payments.length);
        expect(summary.totalPaid).toBe(
          credit.plans[0]!.balance -
            summary.balanceAdjustments +
            summary.totalInterest +
            summary.totalIva,
        );
        expect(summary.progress).toBeGreaterThanOrEqual(0);
        expect(summary.progress).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });
});

const itemArb: fc.Arbitrary<BudgetItem> = fc
  .record({
    id: fc.uuid(),
    kind: fc.constantFrom('income' as const, 'expense' as const),
    amount: fc.integer({ min: 1, max: MAX_AMOUNT }),
    currency: fc.constantFrom(...CURRENCIES),
    category: fc.constantFrom(...EXPENSE_CATEGORIES),
    start: fc.integer({ min: 0, max: 24 }),
    day: fc.integer({ min: 1, max: 28 }),
    repeat: fc.constantFrom(...REPEATS),
    length: fc.option(fc.integer({ min: 0, max: 24 }), { nil: null }),
    skips: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 4 }),
  })
  .map(({ id, kind, amount, currency, category, start, day, repeat, length, skips }) => {
    const month = addMonthsToYearMonth('2026-01', start);
    const base = {
      id,
      name: id,
      amount,
      currency,
      month,
      repeat,
      ...(repeat === 'weekly' ? { firstDate: `${month}-${String(day).padStart(2, '0')}` } : {}),
      ...(repeat !== 'none' && length !== null
        ? { endMonth: addMonthsToYearMonth(month, length) }
        : {}),
    };
    if (kind === 'income') return { ...base, kind };
    // Monthly and weekly expenses may skip some months.
    const skippedMonths = [...skips]
      .sort((a, b) => a - b)
      .map((offset) => addMonthsToYearMonth(month, offset));
    return repeat === 'monthly' || repeat === 'weekly'
      ? {
          ...base,
          kind,
          category,
          ...(skippedMonths.length > 0 ? { skippedMonths } : {}),
        }
      : { ...base, kind, category };
  });

describe('budget invariants', () => {
  it('left = income − expenses; categories add up to expenses; nothing is mixed', () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { maxLength: 20 }),
        fc.array(creditArb, { maxLength: 2 }),
        fc.integer({ min: 0, max: 30 }),
        (items, credits, offset) => {
          const valid = credits.filter((c) => scheduleOf(c) !== null);
          const data = { items, creditPayments: creditMonthPayments(valid) };
          const month = addMonthsToYearMonth('2026-01', offset);

          for (const summary of summarizeMonth(data, month)) {
            const sumOf = (kind: BudgetItem['kind']) =>
              items
                .filter((i) => i.currency === summary.currency && i.kind === kind)
                .reduce((s, i) => s + i.amount * occurrencesIn(i, month), 0);

            expect(summary.income).toBe(sumOf('income'));
            expect(summary.expenses).toBe(sumOf('expense') + summary.creditPayments);
            expect(summary.left).toBe(summary.income - summary.expenses);
            expect(summary.byCategory.reduce((s, c) => s + c.amount, 0)).toBe(summary.expenses);
            // Fixed charges = everything except one-off expenses.
            const oneOffs = items
              .filter(
                (i) =>
                  i.currency === summary.currency && i.kind === 'expense' && i.repeat === 'none',
              )
              .reduce((s, i) => s + i.amount * occurrencesIn(i, month), 0);
            expect(summary.fixedCharges).toBe(summary.expenses - oneOffs);
            // A skipped item is listed apart and never counted.
            for (const { item } of summary.skippedItems) {
              expect(occurrencesIn(item, month)).toBe(0);
              expect(summary.expenseItems.some((e) => e.item.id === item.id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('generated items are valid, and a weekly item is charged 52 or 53 times a year', () => {
    fc.assert(
      fc.property(itemArb, fc.integer({ min: 0, max: 30 }), (item, offset) => {
        expect(validateBudgetItem(item)).toEqual([]);
        if (item.repeat !== 'weekly' || item.endMonth !== undefined) return;
        const from = addMonthsToYearMonth(item.month, offset + 1);
        const months = Array.from({ length: 12 }, (_, i) => addMonthsToYearMonth(from, i));
        // The cadence itself (skipped months aside).
        const charges = months.reduce((s, m) => s + scheduledIn(item, m), 0);
        expect([52, 53]).toContain(charges);
      }),
      { numRuns: 200 },
    );
  });

  it('a year is the sum of its months, registered + projected', () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { maxLength: 15 }),
        fc.constantFrom(...CURRENCIES),
        fc.integer({ min: 0, max: 30 }),
        (items, currency, offset) => {
          const data = { items, creditPayments: [] };
          const current = addMonthsToYearMonth('2026-01', offset);
          const year = summarizeYear(data, currency, 2027, current);
          expect(year.toDate.income + year.projected.income).toBe(year.income);
          expect(year.toDate.expenses + year.projected.expenses).toBe(year.expenses);
          expect(year.left).toBe(year.income - year.expenses);
          expect(year.toDate.months + year.projected.months).toBe(12);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every credit payment lands in exactly one month', () => {
    fc.assert(
      fc.property(creditArb, (credit) => {
        const schedule = scheduleOf(credit);
        if (!schedule) return;
        const byMonth = creditMonthPayments([credit]);
        const total = byMonth.reduce((s, m) => s + m.amount, 0);
        expect(total).toBe(schedule.payments.reduce((s, p) => s + p.total, 0));
        expect(byMonth.flatMap((m) => m.numbers)).toEqual(schedule.payments.map((p) => p.number));
        expect(new Set(byMonth.map((m) => m.month)).size).toBe(byMonth.length);
      }),
      { numRuns: 200 },
    );
  });
});
