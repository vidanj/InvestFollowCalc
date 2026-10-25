import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Repository } from '../../db/repository';
import { strings } from '../../i18n/es-MX';
import { createTestRepository, daysAgo, renderRoute } from '../../test/renderApp';

function statValue(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.parentElement as HTMLElement;
}

async function seedAccount(repository: Repository, initialBalance = 1_000_000, ago = 32) {
  return repository.createAccount({
    name: 'Ahorro',
    currency: 'MXN',
    color: '#0f766e',
    initialBalance,
    initialDate: daysAgo(ago),
  });
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(strings.movement.date), { target: { value } });
}

describe('creating an account', () => {
  it('creates the account with its initial balance and opens it', async () => {
    const { user } = renderRoute('/accounts/new');

    await user.type(await screen.findByLabelText(strings.accountForm.name), 'Ahorro');
    await user.click(screen.getByLabelText(strings.currencyNames.USD));
    await user.type(screen.getByLabelText(strings.accountForm.initialBalance), '10,000');
    fireEvent.change(screen.getByLabelText(strings.accountForm.initialDate), {
      target: { value: daysAgo(5) },
    });
    await user.click(screen.getByRole('button', { name: strings.accountForm.create }));

    expect(await screen.findByRole('heading', { name: 'Ahorro' })).toBeInTheDocument();
    expect(
      within(statValue(strings.account.currentBalance)).getByText(/USD\s10,000\.00/),
    ).toBeInTheDocument();
  });

  it('validates the form before saving', async () => {
    const { user, repository } = renderRoute('/accounts/new');

    await user.click(await screen.findByRole('button', { name: strings.accountForm.create }));

    expect(screen.getByText(strings.errors.nameLength(60))).toBeInTheDocument();
    expect(screen.getByText(strings.errors.required)).toBeInTheDocument();
    expect(await repository.listAccounts()).toEqual([]);
  });
});

describe('registering movements', () => {
  it('reproduces the user example: 50 generated over 10,500 contributed', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/movements/new`, repository);

    // 11 days later the account shows 10,001.
    await user.type(await screen.findByLabelText(strings.movement.balance), '10,001');
    setDate(daysAgo(21));
    expect(await screen.findByText('Generaste $1.00 en 11 días (1.6 semanas).')).toBeVisible();
    await user.click(screen.getByRole('button', { name: strings.common.save }));

    await screen.findByRole('heading', { name: 'Ahorro' });
    // The same sentence is confirmed on the account page.
    expect(screen.getByText('Generaste $1.00 en 11 días (1.6 semanas).')).toBeVisible();
    expect(within(statValue(strings.account.totalGain)).getByText('+$1.00')).toBeVisible();

    // 3 days later: deposit 500, the account shows 10,501.
    await user.click(screen.getByRole('link', { name: strings.account.registerMovement }));
    await user.click(await screen.findByLabelText(strings.movement.types.deposit));
    await user.type(screen.getByLabelText(strings.movement.amount), '500');
    await user.type(screen.getByLabelText(new RegExp(strings.movement.balanceAfter)), '10,501');
    setDate(daysAgo(18));
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    await screen.findByRole('heading', { name: 'Ahorro' });

    // 18 days later the account shows 10,550: 49 more, 50 in total.
    await user.click(screen.getByRole('link', { name: strings.account.registerMovement }));
    await user.type(await screen.findByLabelText(strings.movement.balance), '10,550');
    expect(await screen.findByText('Generaste $49.00 en 18 días (2.6 semanas).')).toBeVisible();
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    await screen.findByRole('heading', { name: 'Ahorro' });

    expect(within(statValue(strings.account.totalGain)).getByText('+$50.00')).toBeVisible();
    expect(within(statValue(strings.account.netContributed)).getByText('$10,500.00')).toBeVisible();
    expect(within(statValue(strings.account.currentBalance)).getByText('$10,550.00')).toBeVisible();
    expect(screen.getByText('+$49.00')).toBeVisible();
  });

  it('does not let a withdrawal take out more than the account holds', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/movements/new`, repository);

    await user.click(await screen.findByLabelText(strings.movement.types.withdrawal));
    await user.type(screen.getByLabelText(strings.movement.amount), '10,000.01');
    expect(
      await screen.findByText(strings.errors.issue('WITHDRAWAL_EXCEEDS_BALANCE')),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    expect(await repository.listEvents(account.id)).toHaveLength(1);

    // With the balance after it, the app knows how much there was before: it is accepted.
    await user.type(screen.getByLabelText(new RegExp(strings.movement.balanceAfter)), '500');
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    await screen.findByRole('heading', { name: 'Ahorro' });
    expect(await repository.listEvents(account.id)).toHaveLength(2);
  });

  it('shows rule violations before saving', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/movements/new`, repository);

    await user.type(await screen.findByLabelText(strings.movement.balance), '1');
    setDate(daysAgo(40));
    expect(
      await screen.findByText(strings.errors.issue('BEFORE_INITIAL_BALANCE')),
    ).toBeInTheDocument();

    setDate(daysAgo(-1));
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    expect(await screen.findByText(strings.errors.futureDate)).toBeInTheDocument();
    expect(await repository.listEvents(account.id)).toHaveLength(1);
  });

  it('edits and deletes a movement, but never the initial balance', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const update = await repository.addEvent(account.id, {
      type: 'balance',
      date: daysAgo(10),
      balance: 1_000_500,
    });
    const [initial] = await repository.listEvents(account.id);
    const { user } = renderRoute(`/accounts/${account.id}/movements/${update.id}`, repository);

    const amount = await screen.findByLabelText(strings.movement.balance);
    await user.clear(amount);
    await user.type(amount, '10,200');
    await user.click(screen.getByRole('button', { name: strings.common.save }));
    await screen.findByRole('heading', { name: 'Ahorro' });
    expect(within(statValue(strings.account.totalGain)).getByText('+$200.00')).toBeVisible();

    await user.click(screen.getByRole('link', { name: /Actualizar saldo/ }));
    await user.click(await screen.findByRole('button', { name: strings.movement.deleteMovement }));
    await user.click(screen.getByRole('button', { name: strings.common.confirmDelete }));
    await screen.findByRole('heading', { name: 'Ahorro' });
    await waitFor(async () => {
      expect(await repository.listEvents(account.id)).toHaveLength(1);
    });

    await user.click(screen.getByRole('link', { name: new RegExp(strings.movement.initial) }));
    expect(
      await screen.findByRole('heading', { name: strings.movement.editInitialTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: strings.movement.deleteMovement })).toBeNull();
    expect(screen.queryByLabelText(strings.movement.types.deposit)).toBeNull();
    expect(initial?.type).toBe('balance');
  });
});

describe('managing an account', () => {
  it('archives an account and lists it apart', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/edit`, repository);

    await user.click(await screen.findByRole('button', { name: strings.accountForm.archive }));

    expect(await screen.findByText(new RegExp(strings.accounts.archivedTitle))).toBeVisible();
    expect((await repository.getAccount(account.id))?.archived).toBe(true);
  });

  it('asks for confirmation before deleting an account', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    const { user } = renderRoute(`/accounts/${account.id}/edit`, repository);

    await user.click(
      await screen.findByRole('button', { name: strings.accountForm.deleteAccount }),
    );
    expect(screen.getByText(strings.accountForm.deleteWarning)).toBeVisible();
    expect(await repository.getAccount(account.id)).toBeDefined();

    await user.click(screen.getByRole('button', { name: strings.common.confirmDelete }));
    expect(await screen.findByText(strings.accounts.emptyTitle)).toBeVisible();
    expect(await repository.getAccount(account.id)).toBeUndefined();
  });

  it('shows the account summary in the list', async () => {
    const repository = createTestRepository();
    const account = await seedAccount(repository);
    await repository.addEvent(account.id, {
      type: 'balance',
      date: daysAgo(1),
      balance: 1_010_000,
    });
    renderRoute('/', repository);

    const card = await screen.findByRole('link', { name: /Ahorro/ });
    expect(within(card).getByText('$10,100.00')).toBeVisible();
    expect(within(card).getByText(/\+\$100\.00/)).toBeVisible();
  });
});
