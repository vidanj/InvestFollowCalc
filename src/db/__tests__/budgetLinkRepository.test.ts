// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { Repository, RepositoryError } from '../repository';
import { createDb } from '../schema';

let tick = 0;
const clock = { now: () => new Date(Date.UTC(2026, 10, 17, 12, 0, tick++)).toISOString() };

let repo: Repository;
let accountId: string;

beforeEach(async () => {
  repo = new Repository(createDb(`link-test-${crypto.randomUUID()}`), clock);
  const account = await repo.createAccount({
    name: 'GBM',
    currency: 'MXN',
    color: '#0f766e',
    initialBalance: 1_000_000,
    initialDate: '2026-09-01',
  });
  accountId = account.id;
});

async function expectRepositoryError(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RepositoryError);
  expect((error as RepositoryError).code).toBe(code);
}

const deposit = { type: 'deposit' as const, date: '2026-10-15', amount: 250_000 };

describe('movements taken from the budget', () => {
  it('adds a contribution with its investment expense, in the same month and currency', async () => {
    const event = await repo.addEvent(accountId, deposit, 'Aportación · GBM');
    const item = await repo.getLinkedBudgetItem(event.id);
    expect(item).toMatchObject({
      kind: 'expense',
      category: 'investment',
      name: 'Aportación · GBM',
      amount: 250_000,
      currency: 'MXN',
      month: '2026-10',
      repeat: 'none',
      sourceEventId: event.id,
    });
    expect(await repo.listBudgetItems()).toHaveLength(1);
  });

  it('adds nothing to the budget unless asked, nor for balance updates', async () => {
    await repo.addEvent(accountId, deposit);
    await repo.addEvent(
      accountId,
      { type: 'balance', date: '2026-10-20', balance: 1_300_000 },
      'x',
    );
    expect(await repo.listBudgetItems()).toEqual([]);
  });

  it('adds a withdrawal as an income', async () => {
    const event = await repo.addEvent(
      accountId,
      { type: 'withdrawal', date: '2026-11-02', amount: 10_000 },
      'Retiro · GBM',
    );
    expect(await repo.getLinkedBudgetItem(event.id)).toMatchObject({
      kind: 'income',
      amount: 10_000,
      month: '2026-11',
    });
  });

  it('follows the movement when it is edited', async () => {
    const event = await repo.addEvent(accountId, deposit, 'Aportación · GBM');
    const before = await repo.getLinkedBudgetItem(event.id);

    // Undefined keeps the link: amount and month follow the movement.
    await repo.updateEvent(event.id, { ...deposit, date: '2026-11-01', amount: 300_000 });
    const moved = await repo.getLinkedBudgetItem(event.id);
    expect(moved).toMatchObject({ id: before?.id, amount: 300_000, month: '2026-11' });
    expect(moved?.createdAt).toBe(before?.createdAt);

    // A contribution turned into a withdrawal becomes an income.
    await repo.updateEvent(event.id, { type: 'withdrawal', date: '2026-11-01', amount: 5_000 });
    expect(await repo.getLinkedBudgetItem(event.id)).toMatchObject({ kind: 'income' });

    // Unchecked, it leaves the budget; checked again, it comes back.
    await repo.updateEvent(event.id, deposit, null);
    expect(await repo.listBudgetItems()).toEqual([]);
    await repo.updateEvent(event.id, deposit, 'Aportación · GBM');
    expect(await repo.listBudgetItems()).toHaveLength(1);

    // A balance update has nothing to mirror.
    await repo.updateEvent(event.id, { type: 'balance', date: '2026-10-15', balance: 1 });
    expect(await repo.listBudgetItems()).toEqual([]);
  });

  it('removes the budget item with the movement or the account', async () => {
    const first = await repo.addEvent(accountId, deposit, 'Aportación · GBM');
    await repo.addEvent(accountId, { ...deposit, date: '2026-10-16' }, 'Aportación · GBM');
    const other = await repo.createAccount({
      name: 'Cetes',
      currency: 'MXN',
      color: '#0f766e',
      initialBalance: 1,
      initialDate: '2026-09-01',
    });
    const kept = await repo.addEvent(other.id, deposit, 'Aportación · Cetes');

    await repo.deleteEvent(first.id);
    expect(await repo.listBudgetItems()).toHaveLength(2);
    await repo.deleteAccount(accountId);
    expect((await repo.listBudgetItems()).map((i) => i.sourceEventId)).toEqual([kept.id]);
  });

  it('moves the budget items to the new currency when the account changes it', async () => {
    const event = await repo.addEvent(accountId, deposit, 'Aportación · GBM');
    await repo.updateAccount(accountId, { currency: 'USD' });
    expect(await repo.getLinkedBudgetItem(event.id)).toMatchObject({ currency: 'USD' });
  });

  it('rolls everything back when the budget item is invalid', async () => {
    await expectRepositoryError(repo.addEvent(accountId, deposit, '  '), 'INVALID_BUDGET_ITEM');
    expect(await repo.listEvents(accountId)).toHaveLength(1);
    expect(await repo.listBudgetItems()).toEqual([]);
  });

  it('only changes mirrored items through their movement', async () => {
    const event = await repo.addEvent(accountId, deposit, 'Aportación · GBM');
    const item = await repo.getLinkedBudgetItem(event.id);
    if (!item) throw new Error('missing item');
    const { id, createdAt, updatedAt, ...draft } = item;
    void createdAt;
    void updatedAt;
    await expectRepositoryError(repo.updateBudgetItem(id, { ...draft, amount: 1 }), 'LINKED_ITEM');
    await expectRepositoryError(repo.deleteBudgetItem(id), 'LINKED_ITEM');
    await expectRepositoryError(repo.setSkipped(id, '2026-10', true), 'LINKED_ITEM');
    await expectRepositoryError(repo.setPaid(id, '2026-10', true), 'LINKED_ITEM');
    await expectRepositoryError(repo.addBudgetItem(draft), 'LINKED_ITEM');
    expect(await repo.listBudgetItems()).toEqual([item]);
  });
});

describe('schema migration to version 4', () => {
  it('keeps version 3 budget items and indexes the movement they mirror', async () => {
    const name = `migration-v3-${crypto.randomUUID()}`;
    const v3 = new Dexie(name);
    v3.version(1).stores({ accounts: 'id', events: 'id, accountId', meta: 'key' });
    v3.version(2).stores({ budgetItems: 'id', credits: 'id' });
    v3.version(3).stores({});
    await v3.table('budgetItems').add({ id: 'a', name: 'Renta', repeat: 'monthly' });
    v3.close();

    const db = createDb(name);
    await db.open();
    expect(db.verno).toBe(4);
    expect(await db.budgetItems.toArray()).toEqual([{ id: 'a', name: 'Renta', repeat: 'monthly' }]);
    expect(await db.budgetItems.where('sourceEventId').equals('x').count()).toBe(0);
    db.close();
  });
});
