// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BudgetItemDraft } from '../../domain/budget';
import type { CreditDraft } from '../../domain/credit';
import { Repository, RepositoryError } from '../repository';
import { createDb, SCHEMA_VERSION } from '../schema';

let tick = 0;
const clock = { now: () => new Date(Date.UTC(2026, 9, 25, 12, 0, tick++)).toISOString() };

let repo: Repository;

beforeEach(() => {
  repo = new Repository(createDb(`budget-test-${crypto.randomUUID()}`), clock);
});

async function expectRepositoryError(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RepositoryError);
  expect((error as RepositoryError).code).toBe(code);
}

const rent: BudgetItemDraft = {
  kind: 'expense',
  name: '  Renta  ',
  amount: 800_000,
  currency: 'MXN',
  category: 'housing',
  month: '2026-01',
  recurring: true,
};

const loan: CreditDraft = {
  name: ' Préstamo ',
  currency: 'MXN',
  annualRateBps: 0,
  ivaOnInterest: false,
  frequency: 'monthly',
  upfrontFees: 0,
  plans: [{ firstPaymentDate: '2026-01-10', balance: 1_200_000, payment: 100_000 }],
};

describe('budget items', () => {
  it('adds, lists and reads items, with trimmed names', async () => {
    const item = await repo.addBudgetItem(rent);
    expect(item).toMatchObject({ name: 'Renta', amount: 800_000, createdAt: item.updatedAt });
    expect(await repo.listBudgetItems()).toEqual([item]);
    expect(await repo.getBudgetItem(item.id)).toEqual(item);
    expect(await repo.getMeta('lastDataChangeAt')).toBe(item.createdAt);
  });

  it('rejects invalid items', async () => {
    await expectRepositoryError(repo.addBudgetItem({ ...rent, amount: 0 }), 'INVALID_BUDGET_ITEM');
    await expectRepositoryError(repo.addBudgetItem({ ...rent, name: ' ' }), 'INVALID_BUDGET_ITEM');
    expect(await repo.listBudgetItems()).toEqual([]);
  });

  it('edits an item in every month', async () => {
    const item = await repo.addBudgetItem(rent);
    const updated = await repo.updateBudgetItem(item.id, { ...rent, amount: 900_000 });
    expect(updated).toMatchObject({ id: item.id, amount: 900_000, createdAt: item.createdAt });
    expect(await repo.listBudgetItems()).toHaveLength(1);
  });

  it('edits a recurring item from a month on, keeping its past', async () => {
    const item = await repo.addBudgetItem(rent);
    const next = await repo.updateBudgetItem(item.id, { ...rent, amount: 900_000 }, '2026-10');

    expect(next).toMatchObject({ month: '2026-10', amount: 900_000, recurring: true });
    expect(next.id).not.toBe(item.id);
    expect(await repo.getBudgetItem(item.id)).toMatchObject({
      amount: 800_000,
      endMonth: '2026-09',
    });
  });

  it('edits in place when the item starts in that month', async () => {
    const item = await repo.addBudgetItem({ ...rent, month: '2026-10' });
    const updated = await repo.updateBudgetItem(item.id, { ...rent, amount: 1 }, '2026-10');
    expect(updated.id).toBe(item.id);
    expect(await repo.listBudgetItems()).toHaveLength(1);
  });

  it('stops a recurring item from a month on, or deletes it everywhere', async () => {
    const item = await repo.addBudgetItem(rent);
    await repo.deleteBudgetItem(item.id, '2026-10');
    expect(await repo.getBudgetItem(item.id)).toMatchObject({ endMonth: '2026-09' });

    await repo.deleteBudgetItem(item.id);
    expect(await repo.listBudgetItems()).toEqual([]);
  });

  it('fails cleanly on missing items or invalid edits', async () => {
    await expectRepositoryError(repo.updateBudgetItem('nope', rent), 'BUDGET_ITEM_NOT_FOUND');
    await expectRepositoryError(repo.deleteBudgetItem('nope'), 'BUDGET_ITEM_NOT_FOUND');
    const item = await repo.addBudgetItem(rent);
    await expectRepositoryError(
      repo.updateBudgetItem(item.id, { ...rent, amount: -1 }, '2026-10'),
      'INVALID_BUDGET_ITEM',
    );
    // Nothing changed: the split happens only after validating.
    expect(await repo.listBudgetItems()).toEqual([item]);
  });
});

describe('credits', () => {
  it('adds, lists, edits and deletes credits', async () => {
    const credit = await repo.addCredit(loan);
    expect(credit.name).toBe('Préstamo');
    expect(await repo.listCredits()).toEqual([credit]);

    const updated = await repo.updateCredit(credit.id, { ...loan, annualRateBps: 1200 });
    expect(updated).toMatchObject({ id: credit.id, annualRateBps: 1200 });

    await repo.deleteCredit(credit.id);
    expect(await repo.getCredit(credit.id)).toBeUndefined();
  });

  it('rejects credits that could never be paid off', async () => {
    await expectRepositoryError(
      repo.addCredit({ ...loan, annualRateBps: 9_000, plans: [{ ...loan.plans[0]!, payment: 1 }] }),
      'INVALID_CREDIT',
    );
  });

  it('records balance updates as new plans, in date order', async () => {
    const credit = await repo.addCredit(loan);
    const later = { firstPaymentDate: '2026-06-10', balance: 300_000, payment: 100_000 };
    const earlier = { firstPaymentDate: '2026-04-10', balance: 700_000, payment: 100_000 };

    await repo.setCreditPlan(credit.id, later);
    const updated = await repo.setCreditPlan(credit.id, earlier);
    expect(updated.plans.map((p) => p.firstPaymentDate)).toEqual([
      '2026-01-10',
      '2026-04-10',
      '2026-06-10',
    ]);

    // Same date: replaces that update.
    const replaced = await repo.setCreditPlan(credit.id, { ...later, balance: 200_000 });
    expect(replaced.plans).toHaveLength(3);
    expect(replaced.plans[2]?.balance).toBe(200_000);

    const removed = await repo.deleteCreditPlan(credit.id, 1);
    expect(removed.plans.map((p) => p.firstPaymentDate)).toEqual(['2026-01-10', '2026-06-10']);
  });

  it('protects the credit as first registered', async () => {
    const credit = await repo.addCredit(loan);
    await expectRepositoryError(
      repo.setCreditPlan(credit.id, { firstPaymentDate: '2025-12-10', balance: 1, payment: 1 }),
      'INVALID_CREDIT',
    );
    await expectRepositoryError(repo.deleteCreditPlan(credit.id, 0), 'CANNOT_DELETE_FIRST_PLAN');
    await expectRepositoryError(repo.deleteCreditPlan(credit.id, 5), 'INVALID_CREDIT');
  });

  it('fails cleanly on missing credits', async () => {
    await expectRepositoryError(repo.updateCredit('nope', loan), 'CREDIT_NOT_FOUND');
    await expectRepositoryError(repo.setCreditPlan('nope', loan.plans[0]!), 'CREDIT_NOT_FOUND');
    await expectRepositoryError(repo.deleteCreditPlan('nope', 1), 'CREDIT_NOT_FOUND');
    await expectRepositoryError(repo.deleteCredit('nope'), 'CREDIT_NOT_FOUND');
  });
});

describe('whole dataset with budget and credits', () => {
  it('exports, replaces and clears budget items and credits too', async () => {
    expect(await repo.hasData()).toBe(false);
    await repo.addBudgetItem(rent);
    await repo.addCredit(loan);
    expect(await repo.hasData()).toBe(true);

    const exported = await repo.exportData();
    expect(exported.budgetItems).toHaveLength(1);
    expect(exported.credits).toHaveLength(1);

    await repo.addCredit({ ...loan, name: 'Otro' });
    await repo.replaceAll(exported);
    expect(await repo.exportData()).toEqual(exported);

    await repo.clearAll();
    expect(await repo.hasData()).toBe(false);
  });
});

describe('schema migration', () => {
  it('opens a version 1 database keeping its data, with empty budget and credit tables', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ accounts: 'id', events: 'id, accountId', meta: 'key' });
    await v1.table('accounts').add({ id: 'a1', name: 'Ahorro' });
    await v1.table('meta').put({ key: 'lastBackupAt', value: '2026-10-01T00:00:00.000Z' });
    v1.close();

    const db = createDb(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.accounts.toArray()).toEqual([{ id: 'a1', name: 'Ahorro' }]);
    expect(await db.meta.get('lastBackupAt')).toBeDefined();
    expect(await db.budgetItems.count()).toBe(0);
    expect(await db.credits.count()).toBe(0);
    db.close();
  });
});
