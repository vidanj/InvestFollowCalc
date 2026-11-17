import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Repository } from '../../db/repository';
import { toYearMonth } from '../../domain/months';
import { formatMonth, strings } from '../../i18n/es-MX';
import { createTestRepository, daysAgo, renderRoute } from '../../test/renderApp';

const m = strings.movement;

async function seedAccount(repository: Repository) {
  return repository.createAccount({
    name: 'Ahorro',
    currency: 'MXN',
    color: '#0f766e',
    initialBalance: 1_000_000,
    initialDate: daysAgo(40),
  });
}

describe('a contribution taken from the budget', () => {
  it('asks only for contributions and withdrawals, unchecked by default', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/movements/new`, repository);

    await screen.findByLabelText(m.balance);
    expect(screen.queryByLabelText(m.fromBudget.deposit)).toBeNull();
    await user.click(screen.getByLabelText(m.types.deposit));
    expect(screen.getByLabelText(m.fromBudget.deposit)).not.toBeChecked();
    await user.click(screen.getByLabelText(m.types.withdrawal));
    expect(screen.getByLabelText(m.fromBudget.withdrawal)).not.toBeChecked();
  });

  it('registers the contribution once and it shows up in the budget', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/movements/new`, repository);

    await user.click(await screen.findByLabelText(m.types.deposit));
    await user.type(screen.getByLabelText(m.amount), '2,500');
    await user.click(screen.getByLabelText(m.fromBudget.deposit));
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    await screen.findByRole('heading', { name: 'Ahorro' });
    const month = toYearMonth(daysAgo(0));
    expect(screen.getByText(m.budgetFlash(formatMonth(month)))).toBeVisible();
    const items = await repository.listBudgetItems();
    expect(items).toMatchObject([
      {
        kind: 'expense',
        category: 'investment',
        name: m.budgetName.deposit('Ahorro'),
        amount: 250_000,
        month,
      },
    ]);
  });

  it('unlinks it when unchecked while editing, and warns that deleting also affects the budget', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const event = await repository.addEvent(
      account.id,
      { type: 'deposit', date: daysAgo(3), amount: 10_000 },
      m.budgetName.deposit('Ahorro'),
    );
    const { user } = renderRoute(`/accounts/${account.id}/movements/${event.id}`, repository);

    const box = await screen.findByLabelText(m.fromBudget.deposit);
    expect(box).toBeChecked();
    await user.click(screen.getByRole('button', { name: m.deleteMovement }));
    expect(screen.getByText(m.deleteLinkedWarning)).toBeVisible();
    await user.click(screen.getByRole('button', { name: strings.common.cancel }));

    await user.click(box);
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    await screen.findByRole('heading', { name: 'Ahorro' });
    await waitFor(async () => {
      expect(await repository.listBudgetItems()).toEqual([]);
    });
  });
});

describe('the suggested investment', () => {
  it('shows how much of it was already invested from the budget', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const date = daysAgo(0);
    await repository.addBudgetItem({
      kind: 'income',
      name: 'Sueldo',
      amount: 3_000_000,
      currency: 'MXN',
      month: toYearMonth(date),
      repeat: 'monthly',
    });
    await repository.addEvent(
      account.id,
      { type: 'deposit', date, amount: 250_000 },
      m.budgetName.deposit('Ahorro'),
    );
    renderRoute(`/budget?month=${toYearMonth(date)}`, repository);

    // 20% of 30,000 is 6,000: the contribution does not shrink it, it counts toward it.
    expect(
      await screen.findByText(
        `${strings.invest.invested('$2,500.00', '$6,000.00')} ${strings.invest.pending('$3,500.00')}`,
      ),
    ).toBeVisible();
  });
});

describe('a mirrored item in the budget', () => {
  it('is read-only and links back to its movement', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const event = await repository.addEvent(
      account.id,
      { type: 'withdrawal', date: daysAgo(3), amount: 10_000 },
      m.budgetName.withdrawal('Ahorro'),
    );
    const item = await repository.getLinkedBudgetItem(event.id);
    const { user } = renderRoute(`/budget/items/${item?.id ?? ''}`, repository);

    expect(
      await screen.findByRole('heading', { name: strings.budgetItem.linkedIncomeTitle }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(strings.budgetItem.linkedNotice('income', 'Ahorro')),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: strings.common.save })).toBeNull();

    await user.click(screen.getByRole('link', { name: strings.budgetItem.goToMovement }));
    expect(await screen.findByLabelText(m.fromBudget.withdrawal)).toBeChecked();
  });
});
