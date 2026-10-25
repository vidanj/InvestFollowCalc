import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Repository } from '../../db/repository';
import { minimumPayment, type CreditDraft } from '../../domain/credit';
import { formatMoney } from '../../domain/money';
import { addMonthsToYearMonth, toYearMonth } from '../../domain/months';
import { formatMonth, strings } from '../../i18n/es-MX';
import { createTestRepository, daysAgo, renderRoute } from '../../test/renderApp';

const b = strings.budget;
const bi = strings.budgetItem;
const c = strings.credit;
const thisMonth = toYearMonth(daysAgo(0));

function stat(label: string): HTMLElement {
  return screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
}

async function seedBudget(repository: Repository) {
  await repository.addBudgetItem({
    kind: 'income',
    name: 'Sueldo',
    amount: 3_000_000,
    currency: 'MXN',
    month: addMonthsToYearMonth(thisMonth, -3),
    recurring: true,
  });
  return repository.addBudgetItem({
    kind: 'expense',
    name: 'Renta',
    amount: 800_000,
    currency: 'MXN',
    category: 'housing',
    month: addMonthsToYearMonth(thisMonth, -3),
    recurring: true,
  });
}

/** 12,000 interest-free (MSI), 1,000 a month, first payment this month. */
const msi = (firstPaymentDate: string): CreditDraft => ({
  name: 'Televisión',
  currency: 'MXN',
  annualRateBps: 0,
  ivaOnInterest: false,
  frequency: 'monthly',
  upfrontFees: 0,
  plans: [{ firstPaymentDate, balance: 1_200_000, payment: 100_000 }],
});

describe('monthly budget', () => {
  it('starts empty and invites to register income and expenses', async () => {
    renderRoute('/budget');
    expect(await screen.findByText(b.emptyTitle)).toBeVisible();
    expect(screen.getByText(c.empty)).toBeVisible();
    // Bottom bar and side navigation both mark the section.
    for (const link of screen.getAllByRole('link', { name: strings.nav.budget })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
  });

  it('adds income and expenses and shows what is spent and what is left', async () => {
    const { user, repository } = renderRoute(`/budget?month=${thisMonth}`);

    await user.click(await screen.findByRole('link', { name: b.addIncome }));
    expect(await screen.findByRole('heading', { name: bi.newIncomeTitle })).toBeVisible();
    await user.type(screen.getByLabelText(bi.name), 'Sueldo');
    await user.type(screen.getByLabelText(bi.amount), '30,000');
    expect(screen.getByLabelText(bi.recurring)).toBeChecked();
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    await user.click(await screen.findByRole('link', { name: b.addExpense }));
    await user.type(await screen.findByLabelText(bi.name), 'Café');
    await user.type(screen.getByLabelText(bi.amount), '85.50');
    await user.selectOptions(screen.getByLabelText(bi.category), b.categories.small);
    expect(screen.getByLabelText(bi.recurring)).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    await screen.findByRole('heading', { name: b.title });
    expect(await screen.findByText('Café')).toBeVisible();
    expect(within(stat(b.income)).getByText('$30,000.00')).toBeVisible();
    expect(within(stat(b.expenses)).getByText('$85.50')).toBeVisible();
    expect(within(stat(b.left)).getByText('+$29,914.50')).toBeVisible();
    expect(screen.getByRole('meter', { name: b.meterLabel })).toHaveAttribute('aria-valuenow', '0');
    expect(await repository.listBudgetItems()).toHaveLength(2);
  });

  it('moves between months: recurring items repeat, one-offs stay in their month', async () => {
    const repository = createTestRepository();
    await seedBudget(repository);
    await repository.addBudgetItem({
      kind: 'expense',
      name: 'Regalo',
      amount: 50_000,
      currency: 'MXN',
      category: 'other',
      month: thisMonth,
      recurring: false,
    });
    const { user } = renderRoute(`/budget?month=${thisMonth}`, repository);

    expect(await screen.findByText('Regalo')).toBeVisible();
    await user.click(screen.getByRole('link', { name: b.nextMonth }));
    expect(
      await screen.findByRole('heading', { name: formatMonth(addMonthsToYearMonth(thisMonth, 1)) }),
    ).toBeVisible();
    expect(screen.queryByText('Regalo')).toBeNull();
    expect(screen.getByText('Renta')).toBeVisible();
    expect(screen.getByText(b.projection)).toBeVisible();

    await user.click(screen.getByRole('link', { name: b.currentMonth }));
    expect(await screen.findByText('Regalo')).toBeVisible();
  });

  it('changes a recurring expense from this month on, keeping past months', async () => {
    const repository = createTestRepository();
    const rent = await seedBudget(repository);
    const { user } = renderRoute(`/budget/items/${rent.id}?month=${thisMonth}`, repository);

    const amount = await screen.findByLabelText(bi.amount);
    expect(screen.getByLabelText(bi.scopeFrom(formatMonth(thisMonth)))).toBeChecked();
    await user.clear(amount);
    await user.type(amount, '9,000');
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    await screen.findByRole('heading', { name: b.title });
    const items = await repository.listBudgetItems();
    expect(items.filter((i) => i.name === 'Renta').map((i) => [i.amount, i.month])).toEqual([
      [800_000, addMonthsToYearMonth(thisMonth, -3)],
      [900_000, thisMonth],
    ]);
    expect(await repository.getBudgetItem(rent.id)).toMatchObject({
      endMonth: addMonthsToYearMonth(thisMonth, -1),
    });
  });

  it('stops a recurring expense from this month on', async () => {
    const repository = createTestRepository();
    const rent = await seedBudget(repository);
    const { user } = renderRoute(`/budget/items/${rent.id}?month=${thisMonth}`, repository);

    const month = formatMonth(thisMonth);
    await user.click(await screen.findByRole('button', { name: bi.stopFrom(month) }));
    await user.click(screen.getByRole('button', { name: bi.confirmStop }));
    await screen.findByRole('heading', { name: b.title });
    await waitFor(async () => {
      expect(await repository.getBudgetItem(rent.id)).toMatchObject({
        endMonth: addMonthsToYearMonth(thisMonth, -1),
      });
    });
  });

  it('validates the item form', async () => {
    const { user, repository } = renderRoute('/budget/items/new?kind=expense');
    await user.click(await screen.findByRole('button', { name: strings.common.save }));
    expect(screen.getByText(strings.errors.nameLength(60))).toBeVisible();
    expect(screen.getByText(strings.errors.required)).toBeVisible();
    expect(await repository.listBudgetItems()).toEqual([]);
  });

  it('counts credit payments as expenses of their month', async () => {
    const repository = createTestRepository();
    await seedBudget(repository);
    await repository.addCredit(msi(`${thisMonth}-01`));
    renderRoute(`/budget?month=${thisMonth}`, repository);

    const credits = await screen.findByRole('region', { name: b.creditsTitle });
    expect(within(credits).getByText('Televisión')).toBeVisible();
    expect(within(credits).getByText(b.paymentNumbers([1], 12))).toBeVisible();
    expect(within(stat(b.expenses)).getByText('$9,000.00')).toBeVisible();
    expect(within(stat(b.creditPayments)).getByText('$1,000.00')).toBeVisible();
    expect(within(stat(b.left)).getByText('+$21,000.00')).toBeVisible();
  });
});

describe('credits', () => {
  it('registers a credit from its number of payments and shows its plan', async () => {
    const { user, repository } = renderRoute('/credits/new');

    await user.type(await screen.findByLabelText(c.name), 'Préstamo');
    await user.type(screen.getByLabelText(c.balance), '100,000');
    await user.type(screen.getByLabelText(c.rate), '27.5');
    await user.selectOptions(screen.getByLabelText(c.frequency), c.frequencies.semimonthly);
    fireEvent.change(screen.getByLabelText(c.firstPaymentDate), {
      target: { value: '2026-11-02' },
    });
    await user.type(screen.getByLabelText(c.count), '120');

    // Fixed payment from the number of payments; IVA on the first interest goes on top.
    expect(await screen.findByText(c.previewPayment('$1,549.12', 'semimonthly'))).toBeVisible();
    expect(screen.getByText(c.previewFirstTotal('$1,735.00'))).toBeVisible();
    expect(screen.getByText(c.previewEnds('17 oct 2031', 120))).toBeVisible();

    await user.click(screen.getByRole('button', { name: strings.common.save }));
    expect(await screen.findByRole('heading', { name: 'Préstamo' })).toBeVisible();
    const [credit] = await repository.listCredits();
    expect(credit).toMatchObject({
      annualRateBps: 2750,
      ivaOnInterest: true,
      frequency: 'semimonthly',
      plans: [{ firstPaymentDate: '2026-11-02', balance: 10_000_000, payment: 154_912 }],
    });
    expect(screen.getByRole('heading', { name: c.scheduleTitle })).toBeVisible();
    expect(within(stat(c.payoff)).getByText('17 oct 2031')).toBeVisible();
  });

  it('explains a payment that would never pay the debt off', async () => {
    const { user } = renderRoute('/credits/new');

    await user.type(await screen.findByLabelText(c.name), 'Tarjeta');
    await user.type(screen.getByLabelText(c.balance), '10,000');
    await user.type(screen.getByLabelText(c.rate), '60');
    await user.click(screen.getByLabelText(c.modes.payment));
    await user.type(screen.getByLabelText(c.payment(true)), '100');
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    const minimum = formatMoney(minimumPayment(1_000_000, 6_000, 'monthly'), 'MXN');
    const hint = c.previewMinimum(minimum);
    expect(await screen.findByText((text) => text.includes(hint))).toBeVisible();
    expect(
      screen.getByText((text) => text.includes(strings.errors.creditIssue('PAYMENT_TOO_LOW'))),
    ).toBeVisible();
  });

  it('updates the balance from the next payment on and compares it with the plan', async () => {
    const repository = createTestRepository();
    const credit = await repository.addCredit(msi(daysAgo(65)));
    const { user } = renderRoute(`/credits/${credit.id}/balance`, repository);

    const owed = await screen.findByLabelText(c.owed);
    const date = screen.getByLabelText<HTMLInputElement>(c.nextPaymentDate).value;
    await user.type(owed, '5,000');
    // Three payments made: 9,000 still owed according to the plan.
    expect(await screen.findByText(c.differenceLess('$4,000.00'))).toBeVisible();
    expect(screen.getByText(c.extraPaymentHint)).toBeVisible();
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    expect(await screen.findByRole('heading', { name: c.plansTitle })).toBeVisible();
    const updated = await repository.getCredit(credit.id);
    expect(updated?.plans.at(-1)).toEqual({
      firstPaymentDate: date,
      balance: 500_000,
      payment: 100_000,
    });
    expect(within(stat(c.currentBalance)).getByText('$5,000.00')).toBeVisible();
  });

  it('deletes a credit from its edit page', async () => {
    const repository = createTestRepository();
    const credit = await repository.addCredit(msi('2026-11-15'));
    const { user } = renderRoute(`/credits/${credit.id}/edit`, repository);

    await user.click(await screen.findByRole('button', { name: c.deleteCredit }));
    await user.click(screen.getByRole('button', { name: strings.common.confirmDelete }));
    await screen.findByRole('heading', { name: b.title });
    expect(await repository.listCredits()).toEqual([]);
  });

  it('shows a missing credit as not found', async () => {
    renderRoute('/credits/nope');
    expect(await screen.findByRole('heading', { name: c.notFound })).toBeVisible();
  });
});
