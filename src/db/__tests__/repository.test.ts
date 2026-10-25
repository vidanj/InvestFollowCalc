// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeAccount } from '../../domain/engine';
import { Repository, RepositoryError, type NewAccountInput } from '../repository';
import { createDb } from '../schema';

let tick = 0;
const clock = { now: () => new Date(Date.UTC(2026, 9, 16, 12, 0, tick++)).toISOString() };

let repo: Repository;

beforeEach(() => {
  repo = new Repository(createDb(`repo-test-${crypto.randomUUID()}`), clock);
});

const newAccount = (overrides: Partial<NewAccountInput> = {}): NewAccountInput => ({
  name: 'Ahorro',
  currency: 'MXN',
  color: '#0f766e',
  initialBalance: 1_000_000,
  initialDate: '2026-10-01',
  ...overrides,
});

async function expectRepositoryError(promise: Promise<unknown>, code: string, issues?: string[]) {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RepositoryError);
  expect((error as RepositoryError).code).toBe(code);
  if (issues) expect((error as RepositoryError).issues.map((i) => i.code)).toEqual(issues);
}

describe('accounts', () => {
  it('creates an account together with its initial balance', async () => {
    const account = await repo.createAccount(newAccount({ name: '  Ahorro  ' }));

    expect(account).toMatchObject({ name: 'Ahorro', currency: 'MXN', archived: false });
    const events = await repo.listEvents(account.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accountId: account.id,
      type: 'balance',
      balance: 1_000_000,
      date: '2026-10-01',
      seq: 1,
    });
    expect(await repo.getMeta('lastDataChangeAt')).toBe(account.createdAt);
  });

  it('rejects empty or too long names and invalid initial data', async () => {
    await expectRepositoryError(repo.createAccount(newAccount({ name: '   ' })), 'INVALID_ACCOUNT');
    await expectRepositoryError(
      repo.createAccount(newAccount({ name: 'x'.repeat(61) })),
      'INVALID_ACCOUNT',
    );
    await expectRepositoryError(
      repo.createAccount(newAccount({ initialBalance: -1 })),
      'INVALID_EVENT',
      ['INVALID_BALANCE'],
    );
    await expectRepositoryError(
      repo.createAccount(newAccount({ initialDate: '2026-02-30' })),
      'INVALID_EVENT',
      ['INVALID_DATE'],
    );
    expect(await repo.listAccounts()).toEqual([]);
  });

  it('lists accounts in creation order, each with its events', async () => {
    const first = await repo.createAccount(newAccount({ name: 'Primera' }));
    const second = await repo.createAccount(newAccount({ name: 'Segunda', currency: 'USD' }));
    await repo.addEvent(first.id, { type: 'balance', date: '2026-10-05', balance: 1_000_100 });

    const items = await repo.listAccountsWithEvents();
    expect(items.map((i) => [i.account.name, i.events.length])).toEqual([
      ['Primera', 2],
      ['Segunda', 1],
    ]);
    expect(items[1]?.account.id).toBe(second.id);
  });

  it('updates only the given fields', async () => {
    const account = await repo.createAccount(newAccount());
    const updated = await repo.updateAccount(account.id, { name: 'Nuevo', archived: true });

    expect(updated).toMatchObject({ name: 'Nuevo', archived: true, currency: 'MXN' });
    expect(updated.updatedAt > account.updatedAt).toBe(true);
    expect(await repo.getAccount(account.id)).toEqual(updated);
    await expectRepositoryError(repo.updateAccount('missing', { name: 'x' }), 'ACCOUNT_NOT_FOUND');
    await expectRepositoryError(repo.updateAccount(account.id, { name: '' }), 'INVALID_ACCOUNT');
  });

  it('deletes an account with all of its movements', async () => {
    const keep = await repo.createAccount(newAccount({ name: 'Queda' }));
    const gone = await repo.createAccount(newAccount({ name: 'Se va' }));
    await repo.addEvent(gone.id, { type: 'deposit', date: '2026-10-02', amount: 100 });

    await repo.deleteAccount(gone.id);

    expect((await repo.listAccounts()).map((a) => a.id)).toEqual([keep.id]);
    expect(await repo.listEvents(gone.id)).toEqual([]);
    expect(await repo.listEvents(keep.id)).toHaveLength(1);
    await expectRepositoryError(repo.deleteAccount(gone.id), 'ACCOUNT_NOT_FOUND');
  });
});

describe('events', () => {
  it('stores the user example and computes it back', async () => {
    const account = await repo.createAccount(newAccount());
    await repo.addEvent(account.id, { type: 'balance', date: '2026-10-12', balance: 1_000_100 });
    await repo.addEvent(account.id, {
      type: 'deposit',
      date: '2026-10-15',
      amount: 50_000,
      balanceAfter: 1_050_100,
    });
    await repo.addEvent(account.id, { type: 'balance', date: '2026-11-02', balance: 1_055_000 });

    const events = await repo.listEvents(account.id);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    const { summary } = computeAccount(events);
    expect(summary?.totalGain).toBe(5_000);
    expect(summary?.netContributed).toBe(1_050_000);
  });

  it('keeps capture order for movements on the same day', async () => {
    const account = await repo.createAccount(newAccount());
    const deposit = await repo.addEvent(account.id, {
      type: 'deposit',
      date: '2026-10-01',
      amount: 100,
    });
    const balance = await repo.addEvent(account.id, {
      type: 'balance',
      date: '2026-10-01',
      balance: 1_000_150,
    });

    expect((await repo.listEvents(account.id)).map((e) => e.id).slice(1)).toEqual([
      deposit.id,
      balance.id,
    ]);
  });

  it('rejects movements dated before the initial balance or otherwise invalid', async () => {
    const account = await repo.createAccount(newAccount());
    await expectRepositoryError(
      repo.addEvent(account.id, { type: 'balance', date: '2026-09-30', balance: 1 }),
      'INVALID_EVENT',
      ['BEFORE_INITIAL_BALANCE'],
    );
    await expectRepositoryError(
      repo.addEvent(account.id, {
        type: 'deposit',
        date: '2026-10-02',
        amount: 500,
        balanceAfter: 300,
      }),
      'INVALID_EVENT',
      ['BALANCE_AFTER_TOO_LOW'],
    );
    await expectRepositoryError(
      repo.addEvent('missing', { type: 'balance', date: '2026-10-02', balance: 1 }),
      'ACCOUNT_NOT_FOUND',
    );
    expect(await repo.listEvents(account.id)).toHaveLength(1);
  });

  it('edits a movement keeping its id, account and order', async () => {
    const account = await repo.createAccount(newAccount());
    const original = await repo.addEvent(account.id, {
      type: 'deposit',
      date: '2026-10-05',
      amount: 100,
      balanceAfter: 1_000_100,
    });

    const edited = await repo.updateEvent(original.id, {
      type: 'withdrawal',
      date: '2026-10-06',
      amount: 200,
    });

    expect(edited).toMatchObject({
      id: original.id,
      seq: original.seq,
      accountId: account.id,
      createdAt: original.createdAt,
      type: 'withdrawal',
      amount: 200,
    });
    expect(edited).not.toHaveProperty('balanceAfter');
    expect(await repo.getEvent(original.id)).toEqual(edited);
  });

  it('protects the initial balance', async () => {
    const account = await repo.createAccount(newAccount());
    await repo.addEvent(account.id, { type: 'balance', date: '2026-10-10', balance: 1_000_500 });
    const [initial] = await repo.listEvents(account.id);
    if (!initial) throw new Error('missing initial balance');

    await expectRepositoryError(
      repo.updateEvent(initial.id, { type: 'deposit', date: '2026-10-01', amount: 1 }),
      'INVALID_EVENT',
      ['INITIAL_MUST_BE_BALANCE'],
    );
    await expectRepositoryError(
      repo.updateEvent(initial.id, { type: 'balance', date: '2026-10-20', balance: 1 }),
      'INVALID_EVENT',
      ['INITIAL_MUST_BE_FIRST'],
    );
    await expectRepositoryError(repo.deleteEvent(initial.id), 'CANNOT_DELETE_INITIAL');

    const moved = await repo.updateEvent(initial.id, {
      type: 'balance',
      date: '2026-09-25',
      balance: 900_000,
    });
    expect(moved).toMatchObject({ date: '2026-09-25', balance: 900_000 });
  });

  it('deletes a movement', async () => {
    const account = await repo.createAccount(newAccount());
    const event = await repo.addEvent(account.id, {
      type: 'balance',
      date: '2026-10-10',
      balance: 1_000_500,
    });

    await repo.deleteEvent(event.id);

    expect(await repo.listEvents(account.id)).toHaveLength(1);
    await expectRepositoryError(repo.deleteEvent(event.id), 'EVENT_NOT_FOUND');
    await expectRepositoryError(
      repo.updateEvent(event.id, { type: 'balance', date: '2026-10-10', balance: 1 }),
      'EVENT_NOT_FOUND',
    );
  });
});

describe('whole dataset', () => {
  it('exports, replaces and clears everything', async () => {
    const first = await repo.createAccount(newAccount({ name: 'Primera' }));
    await repo.addEvent(first.id, { type: 'balance', date: '2026-10-05', balance: 1_000_100 });
    const exported = await repo.exportData();
    expect(exported.accounts).toHaveLength(1);
    expect(exported.events).toHaveLength(2);

    await repo.createAccount(newAccount({ name: 'Otra' }));
    await repo.replaceAll(exported);
    expect((await repo.listAccounts()).map((a) => a.name)).toEqual(['Primera']);
    expect(await repo.listEvents(first.id)).toEqual(exported.events);
    // Imported data is, by definition, backed up.
    expect(await repo.getMeta('lastBackupAt')).toBe(await repo.getMeta('lastDataChangeAt'));

    await repo.clearAll();
    expect(await repo.exportData()).toEqual({
      accounts: [],
      events: [],
      budgetItems: [],
      credits: [],
    });
    expect(await repo.getMeta('lastBackupAt')).toBeUndefined();
  });

  it('leaves the data untouched when a replacement fails halfway', async () => {
    const keep = await repo.createAccount(newAccount({ name: 'Queda' }));
    const exported = await repo.exportData();
    const broken = { ...exported, accounts: [...exported.accounts, ...exported.accounts] };

    await expect(repo.replaceAll(broken)).rejects.toThrow();
    expect((await repo.listAccounts()).map((a) => a.id)).toEqual([keep.id]);
  });

  it('records when a backup was made', async () => {
    expect(await repo.getMeta('lastBackupAt')).toBeUndefined();
    await repo.markBackedUp();
    expect(await repo.getMeta('lastBackupAt')).toMatch(/^2026-10-16T/);
  });
});
