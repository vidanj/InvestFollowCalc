import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  computeCredit,
  expectedBalanceAt,
  ivaOnInterest,
  minimumPayment,
  parseRateToBps,
  paymentDate,
  paymentForTerm,
  periodDays,
  periodInterest,
  validateCredit,
  withPlan,
  type Credit,
  type CreditPlan,
} from '../credit';

// Expected values come from an independent reference implementation (exact fractions) of the
// rules in docs/calculos.md; the quincenal case follows the structure of a real bank table.

function credit(overrides: Partial<Credit> = {}): Credit {
  return {
    id: 'c1',
    name: 'Préstamo',
    currency: 'MXN',
    annualRateBps: 2750,
    ivaOnInterest: true,
    frequency: 'semimonthly',
    upfrontFees: 0,
    plans: [{ firstPaymentDate: '2026-11-02', balance: 10_000_000, payment: 154_912 }],
    ...overrides,
  };
}

const plan = (firstPaymentDate: string, balance: number, payment: number): CreditPlan => ({
  firstPaymentDate,
  balance,
  payment,
});

describe('interest of a period', () => {
  it('uses the annual rate over a 360-day year and 365/payments-per-year days', () => {
    expect(periodDays('monthly')).toBe(30.4167);
    expect(periodDays('semimonthly')).toBe(15.2083);
    expect(periodDays('biweekly')).toBe(14.0385);
    expect(periodDays('weekly')).toBe(7.0192);
    // 100,000.00 at 27.5% for a quincena: 1,161.75.
    expect(periodInterest(10_000_000, 2750, 'semimonthly')).toBe(116_175);
    expect(periodInterest(1_000_000, 2400, 'monthly')).toBe(20_278);
    expect(periodInterest(1_000_000, 0, 'monthly')).toBe(0);
  });

  it('rounds IVA (16%) to the nearest cent, half up', () => {
    expect(ivaOnInterest(116_175)).toBe(18_588);
    expect(ivaOnInterest(0)).toBe(0);
  });

  it('stays exact for very large balances', () => {
    expect(periodInterest(Number.MAX_SAFE_INTEGER, 99_999, 'monthly')).toBeGreaterThan(0);
  });
});

describe('payment dates', () => {
  it('repeats monthly on the same day, clamped to short months', () => {
    expect(paymentDate('2026-01-31', 'monthly', 0)).toBe('2026-01-31');
    expect(paymentDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(paymentDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
  });

  it('pays twice a month, 15 days apart (2 and 17)', () => {
    const dates = [0, 1, 2, 3].map((i) => paymentDate('2026-11-02', 'semimonthly', i));
    expect(dates).toEqual(['2026-11-02', '2026-11-17', '2026-12-02', '2026-12-17']);
  });

  it('starting on the second payment day of the month (17 then 2)', () => {
    const dates = [0, 1, 2, 3].map((i) => paymentDate('2026-11-17', 'semimonthly', i));
    expect(dates).toEqual(['2026-11-17', '2026-12-02', '2026-12-17', '2027-01-02']);
  });

  it('clamps the second quincena to the end of short months', () => {
    const dates = [0, 1, 2, 3].map((i) => paymentDate('2027-01-15', 'semimonthly', i));
    expect(dates).toEqual(['2027-01-15', '2027-01-30', '2027-02-15', '2027-02-28']);
  });

  it('pays every 14 or 7 days', () => {
    expect(paymentDate('2026-11-06', 'biweekly', 2)).toBe('2026-12-04');
    expect(paymentDate('2026-11-06', 'weekly', 4)).toBe('2026-12-04');
  });
});

describe('payment for a number of payments', () => {
  it('matches the reference for each frequency', () => {
    expect(paymentForTerm(10_000_000, 2750, 'semimonthly', 120)).toBe(154_912);
    expect(paymentForTerm(1_000_000, 2400, 'monthly', 12)).toBe(94_722);
    expect(paymentForTerm(500_000, 6000, 'weekly', 52)).toBe(12_890);
    expect(paymentForTerm(800_000, 4500, 'biweekly', 26)).toBe(38_585);
  });

  it('splits interest-free credit (MSI) evenly and never needs an extra payment', () => {
    expect(paymentForTerm(1_200_000, 0, 'monthly', 12)).toBe(100_000);
    // 100.00 / 3 = 33.33…: rounding up keeps it at 3 payments.
    expect(paymentForTerm(10_000, 0, 'monthly', 3)).toBe(3_334);
  });

  it('returns 0 when nothing is owed and rejects impossible terms', () => {
    expect(paymentForTerm(0, 2750, 'monthly', 12)).toBe(0);
    expect(() => paymentForTerm(1_000, 2750, 'monthly', 0)).toThrow(RangeError);
    expect(() => paymentForTerm(1_000, 2750, 'monthly', 1.5)).toThrow(RangeError);
  });

  it('knows the smallest payment that still lowers the debt', () => {
    expect(minimumPayment(10_000_000, 2750, 'semimonthly')).toBe(116_176);
  });
});

describe('amortization schedule', () => {
  it('fixed payment covers capital + interest; IVA is added on top', () => {
    const { payments } = buildSchedule(credit());

    expect(payments).toHaveLength(120);
    expect(payments[0]).toEqual({
      number: 1,
      date: '2026-11-02',
      planIndex: 0,
      openingBalance: 10_000_000,
      payment: 154_912,
      principal: 38_737,
      interest: 116_175,
      iva: 18_588,
      total: 173_500,
      closingBalance: 9_961_263,
    });
    expect(payments[1]).toMatchObject({
      date: '2026-11-17',
      principal: 39_188,
      interest: 115_724,
      iva: 18_516,
      total: 173_428,
      closingBalance: 9_922_075,
    });
    // The last payment only covers what is left: the balance ends at exactly 0.
    expect(payments[119]).toMatchObject({
      number: 120,
      date: '2031-10-17',
      payment: 154_787,
      principal: 153_009,
      interest: 1_778,
      iva: 284,
      total: 155_071,
      closingBalance: 0,
    });
  });

  it('without IVA the total is the fixed payment', () => {
    const { payments } = buildSchedule(
      credit({
        annualRateBps: 2400,
        ivaOnInterest: false,
        frequency: 'monthly',
        plans: [plan('2026-11-15', 1_000_000, 94_722)],
      }),
    );
    expect(payments).toHaveLength(12);
    expect(payments[0]).toMatchObject({ interest: 20_278, iva: 0, total: 94_722 });
    expect(payments[11]).toMatchObject({ date: '2027-10-15', payment: 94_710, closingBalance: 0 });
  });

  it('a balance update starts a new plan and records the difference', () => {
    const { payments, changes } = buildSchedule(
      credit({
        frequency: 'monthly',
        annualRateBps: 0,
        ivaOnInterest: false,
        plans: [plan('2026-01-10', 1_200_000, 100_000), plan('2026-04-10', 500_000, 100_000)],
      }),
    );
    // Jan, Feb, Mar under the first plan: 900,000 left. Then the user reports 500,000.
    expect(changes).toEqual([
      {
        planIndex: 1,
        date: '2026-04-10',
        expectedBalance: 900_000,
        newBalance: 500_000,
        difference: 400_000,
      },
    ]);
    expect(payments.map((p) => p.date)).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
      '2026-04-10',
      '2026-05-10',
      '2026-06-10',
      '2026-07-10',
      '2026-08-10',
    ]);
    expect(payments[3]).toMatchObject({ planIndex: 1, openingBalance: 500_000 });
  });

  it('a credit that was already paid off can get a new balance', () => {
    const { payments, changes } = buildSchedule(
      credit({
        frequency: 'monthly',
        annualRateBps: 0,
        ivaOnInterest: false,
        plans: [plan('2026-01-10', 200_000, 100_000), plan('2026-06-10', 50_000, 50_000)],
      }),
    );
    expect(changes[0]).toMatchObject({
      expectedBalance: 0,
      newBalance: 50_000,
      difference: -50_000,
    });
    expect(payments).toHaveLength(3);
  });

  it('a balance update to 0 settles what the earlier plan still expected', () => {
    // Found by the property tests: the debt ends through the update, not a payment.
    const { payments, changes } = buildSchedule(
      credit({
        frequency: 'monthly',
        annualRateBps: 0,
        ivaOnInterest: false,
        plans: [plan('2026-01-05', 2, 1), plan('2026-01-06', 0, 1)],
      }),
    );
    expect(payments).toHaveLength(1);
    expect(payments[0]?.closingBalance).toBe(1);
    expect(changes).toEqual([
      { planIndex: 1, date: '2026-01-06', expectedBalance: 1, newBalance: 0, difference: 1 },
    ]);
  });

  it('a balance of 0 means nothing else to pay', () => {
    const { payments } = buildSchedule(credit({ plans: [plan('2026-11-02', 0, 0)] }));
    expect(payments).toEqual([]);
  });

  it('refuses payments that never lower the debt', () => {
    expect(() =>
      buildSchedule(credit({ plans: [plan('2026-11-02', 10_000_000, 116_175)] })),
    ).toThrow('PAYMENT_TOO_LOW');
  });

  it('refuses schedules that would never end in practice', () => {
    expect(() =>
      buildSchedule(
        credit({
          frequency: 'weekly',
          annualRateBps: 0,
          plans: [plan('2026-11-02', 10_000_000, 1_000)],
        }),
      ),
    ).toThrow('TOO_MANY_PAYMENTS');
  });
});

describe('balance updates', () => {
  const first = plan('2026-01-10', 1_200_000, 100_000);

  it('insert a plan in date order, replacing one on the same date', () => {
    const april = plan('2026-04-10', 500_000, 100_000);
    const june = plan('2026-06-10', 300_000, 100_000);
    expect(withPlan([first, june], april)).toEqual([first, april, june]);
    expect(withPlan([first, april], { ...april, balance: 1 })).toEqual([
      first,
      { ...april, balance: 1 },
    ]);
  });

  it('compare with what the schedule expected before a payment', () => {
    const { payments } = buildSchedule(
      credit({ frequency: 'monthly', annualRateBps: 0, ivaOnInterest: false, plans: [first] }),
    );
    expect(expectedBalanceAt(payments, '2026-04-10')).toBe(900_000);
    // Between payments: the next one's opening balance.
    expect(expectedBalanceAt(payments, '2026-04-01')).toBe(900_000);
    expect(expectedBalanceAt(payments, '2030-01-01')).toBe(0);
  });
});

describe('credit summary', () => {
  it('splits paid and pending payments at today (a payment counts on its date)', () => {
    const summary = computeCredit(credit({ upfrontFees: 1_000_000 }), '2026-12-02');

    expect(summary.paymentsMade).toBe(3);
    expect(summary.paymentsLeft).toBe(117);
    expect(summary.paidSoFar).toBe(173_500 + 173_428 + summary.payments[2]!.total);
    expect(summary.currentBalance).toBe(summary.payments[2]!.closingBalance);
    expect(summary.nextPayment?.date).toBe('2026-12-17');
    expect(summary.lastPaymentDate).toBe('2031-10-17');
    expect(summary.isPaidOff).toBe(false);

    expect(summary.totalInterest).toBe(8_589_315);
    expect(summary.totalIva).toBe(1_374_293);
    expect(summary.totalPaid).toBe(19_963_608);
    expect(summary.paidSoFar + summary.remainingToPay).toBe(summary.totalPaid);
    // Fees were deducted when the money was handed over.
    expect(summary.received).toBe(9_000_000);
    expect(summary.totalCost).toBe(8_589_315 + 1_374_293 + 1_000_000);
    expect(summary.progress).toBeCloseTo(summary.paidSoFar / summary.totalPaid, 10);
  });

  it('before the first payment everything is still owed', () => {
    const summary = computeCredit(credit(), '2026-10-25');
    expect(summary.paidSoFar).toBe(0);
    expect(summary.currentBalance).toBe(10_000_000);
    expect(summary.nextPayment?.number).toBe(1);
    expect(summary.progress).toBe(0);
  });

  it('after the last payment the credit is paid off', () => {
    const summary = computeCredit(credit(), '2031-10-17');
    expect(summary.isPaidOff).toBe(true);
    expect(summary.currentBalance).toBe(0);
    expect(summary.remainingToPay).toBe(0);
    expect(summary.nextPayment).toBeNull();
    expect(summary.progress).toBe(1);
  });

  it('between plans, the balance owed is the one the user reported', () => {
    const summary = computeCredit(
      credit({
        frequency: 'monthly',
        annualRateBps: 0,
        ivaOnInterest: false,
        plans: [plan('2026-01-10', 1_200_000, 100_000), plan('2026-04-10', 500_000, 100_000)],
      }),
      '2026-03-20',
    );
    expect(summary.currentBalance).toBe(500_000);
    expect(summary.balanceAdjustments).toBe(400_000);
  });

  it('a credit with nothing owed is paid off from the start', () => {
    const summary = computeCredit(credit({ plans: [plan('2026-11-02', 0, 0)] }), '2026-10-25');
    expect(summary).toMatchObject({
      totalPaid: 0,
      isPaidOff: true,
      lastPaymentDate: null,
      progress: 1,
    });
  });
});

describe('parseRateToBps', () => {
  it('reads percentages with up to 2 decimals', () => {
    expect(parseRateToBps('27.5')).toBe(2750);
    expect(parseRateToBps('27.50 %')).toBe(2750);
    expect(parseRateToBps(' 0 ')).toBe(0);
    expect(parseRateToBps('999.99')).toBe(99_999);
    expect(parseRateToBps('7.05%')).toBe(705);
  });

  it('rejects anything else', () => {
    for (const value of ['', 'abc', '-1', '27.555', '1000', '27,5']) {
      expect(parseRateToBps(value), value).toBeNull();
    }
  });
});

describe('validateCredit', () => {
  const codes = (c: Credit) => validateCredit(c).map((i) => i.code);

  it('accepts a valid credit', () => {
    expect(validateCredit(credit())).toEqual([]);
  });

  it('checks the credit fields', () => {
    expect(codes(credit({ name: '  ' }))).toEqual(['INVALID_NAME']);
    expect(codes(credit({ name: 'x'.repeat(61) }))).toEqual(['INVALID_NAME']);
    expect(codes(credit({ currency: 'EUR' as Credit['currency'] }))).toEqual(['INVALID_CURRENCY']);
    expect(codes(credit({ annualRateBps: -1 }))).toEqual(['INVALID_RATE']);
    expect(codes(credit({ annualRateBps: 1.5 }))).toEqual(['INVALID_RATE']);
    expect(codes(credit({ annualRateBps: 100_000 }))).toEqual(['INVALID_RATE']);
    expect(codes(credit({ frequency: 'daily' as Credit['frequency'] }))).toEqual([
      'INVALID_FREQUENCY',
    ]);
    expect(codes(credit({ upfrontFees: -1 }))).toEqual(['INVALID_FEES']);
    expect(codes(credit({ upfrontFees: 10_000_001 }))).toEqual(['INVALID_FEES']);
    expect(codes(credit({ plans: [] }))).toEqual(['NO_PLANS']);
  });

  it('checks every plan', () => {
    expect(validateCredit(credit({ plans: [plan('2026-02-30', 1_000, 500)] }))).toEqual([
      { code: 'INVALID_DATE', planIndex: 0 },
    ]);
    expect(codes(credit({ plans: [plan('2026-11-02', -1, 500)] }))).toEqual(['INVALID_BALANCE']);
    expect(codes(credit({ plans: [plan('2026-11-02', 1.5, 500)] }))).toEqual(['INVALID_BALANCE']);
    expect(codes(credit({ plans: [plan('2026-11-02', 1_000, 0)] }))).toEqual(['INVALID_PAYMENT']);
    expect(codes(credit({ plans: [plan('2026-11-02', 0, -5)] }))).toEqual(['INVALID_PAYMENT']);
    expect(
      validateCredit(
        credit({ plans: [plan('2026-11-02', 10_000_000, 154_912), plan('2026-11-02', 50, 50)] }),
      ),
    ).toEqual([{ code: 'PLANS_OUT_OF_ORDER', planIndex: 1 }]);
  });

  it('reports schedules that cannot be paid off', () => {
    expect(
      validateCredit(
        credit({
          plans: [plan('2026-11-02', 10_000_000, 154_912), plan('2027-01-02', 9_000_000, 10)],
        }),
      ),
    ).toEqual([{ code: 'PAYMENT_TOO_LOW', planIndex: 1 }]);
    expect(
      codes(
        credit({
          frequency: 'weekly',
          annualRateBps: 0,
          plans: [plan('2026-11-02', 10_000_000, 1_000)],
        }),
      ),
    ).toEqual(['TOO_MANY_PAYMENTS']);
  });
});
