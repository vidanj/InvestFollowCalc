import {
  canSplitAt,
  endBefore,
  startingIn,
  validateBudgetItem,
  type BudgetItemDraft,
} from '../domain/budget';
import { validateCredit, withPlan, type CreditDraft, type CreditPlan } from '../domain/credit';
import { compareIsoDates } from '../domain/dates';
import { DEFAULT_INVEST_PLAN, parseInvestPlan, type InvestPlan } from '../domain/investPlan';
import type { YearMonth } from '../domain/months';
import type { AccountEvent, Cents, Currency, EventDraft, IsoDate } from '../domain/types';
import { nextSeq, sortEvents, validateCandidate, type ValidationIssue } from '../domain/validation';
import type {
  AccountRecord,
  BudgetItemRecord,
  CreditRecord,
  DataSet,
  EventRecord,
  InvestDb,
  MetaKey,
} from './schema';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

export type RepositoryErrorCode =
  | 'ACCOUNT_NOT_FOUND'
  | 'EVENT_NOT_FOUND'
  | 'INVALID_ACCOUNT'
  | 'INVALID_EVENT'
  | 'CANNOT_DELETE_INITIAL'
  | 'BUDGET_ITEM_NOT_FOUND'
  | 'INVALID_BUDGET_ITEM'
  | 'CREDIT_NOT_FOUND'
  | 'INVALID_CREDIT'
  | 'CANNOT_DELETE_FIRST_PLAN'
  | 'INVALID_INVEST_PLAN';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly issues: readonly ValidationIssue[];

  constructor(code: RepositoryErrorCode, issues: readonly ValidationIssue[] = []) {
    super(issues.length > 0 ? `${code}: ${issues.map((i) => i.code).join(', ')}` : code);
    this.name = 'RepositoryError';
    this.code = code;
    this.issues = issues;
  }
}

export interface Clock {
  /** Current time as an ISO datetime. */
  now(): string;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };

export interface NewAccountInput {
  name: string;
  currency: Currency;
  color: string;
  initialBalance: Cents;
  initialDate: IsoDate;
}

export interface AccountPatch {
  name?: string;
  currency?: Currency;
  color?: string;
  archived?: boolean;
}

export interface AccountWithEvents {
  account: AccountRecord;
  events: EventRecord[];
}

const byCreation = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

function assertValidBudgetItem(draft: BudgetItemDraft): void {
  if (validateBudgetItem(draft).length > 0) throw new RepositoryError('INVALID_BUDGET_ITEM');
}

function assertValidCredit(draft: CreditDraft): void {
  if (validateCredit(draft).length > 0) throw new RepositoryError('INVALID_CREDIT');
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > ACCOUNT_NAME_MAX_LENGTH) {
    throw new RepositoryError('INVALID_ACCOUNT');
  }
  return trimmed;
}

/**
 * All reads and writes of user data. Every write validates the resulting timeline with the
 * domain rules, so the stored data is always computable.
 */
export class Repository {
  readonly db: InvestDb;
  private readonly clock: Clock;

  constructor(db: InvestDb, clock: Clock = systemClock) {
    this.db = db;
    this.clock = clock;
  }

  // --- Accounts ---

  async listAccounts(): Promise<AccountRecord[]> {
    const accounts = await this.db.accounts.toArray();
    return accounts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getAccount(id: string): Promise<AccountRecord | undefined> {
    return this.db.accounts.get(id);
  }

  async listAccountsWithEvents(): Promise<AccountWithEvents[]> {
    return this.db.transaction('r', this.db.accounts, this.db.events, async () => {
      const [accounts, events] = await Promise.all([this.listAccounts(), this.db.events.toArray()]);
      return accounts.map((account) => ({
        account,
        events: sortEvents(events.filter((e) => e.accountId === account.id)) as EventRecord[],
      }));
    });
  }

  async createAccount(input: NewAccountInput): Promise<AccountRecord> {
    const name = normalizeName(input.name);
    const now = this.clock.now();
    const account: AccountRecord = {
      id: crypto.randomUUID(),
      name,
      currency: input.currency,
      color: input.color,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const initial: EventRecord = {
      id: crypto.randomUUID(),
      accountId: account.id,
      seq: 1,
      date: input.initialDate,
      type: 'balance',
      balance: input.initialBalance,
      createdAt: now,
      updatedAt: now,
    };
    this.assertValid([], initial);

    await this.db.transaction('rw', this.db.accounts, this.db.events, this.db.meta, async () => {
      await this.db.accounts.add(account);
      await this.db.events.add(initial);
      await this.touch(now);
    });
    return account;
  }

  async updateAccount(id: string, patch: AccountPatch): Promise<AccountRecord> {
    return this.db.transaction('rw', this.db.accounts, this.db.meta, async () => {
      const current = await this.db.accounts.get(id);
      if (!current) throw new RepositoryError('ACCOUNT_NOT_FOUND');
      const now = this.clock.now();
      const updated: AccountRecord = { ...current, updatedAt: now };
      if (patch.name !== undefined) updated.name = normalizeName(patch.name);
      if (patch.currency !== undefined) updated.currency = patch.currency;
      if (patch.color !== undefined) updated.color = patch.color;
      if (patch.archived !== undefined) updated.archived = patch.archived;
      await this.db.accounts.put(updated);
      await this.touch(now);
      return updated;
    });
  }

  /** Deletes the account and all of its movements. */
  async deleteAccount(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.accounts, this.db.events, this.db.meta, async () => {
      if (!(await this.db.accounts.get(id))) throw new RepositoryError('ACCOUNT_NOT_FOUND');
      await this.db.events.where('accountId').equals(id).delete();
      await this.db.accounts.delete(id);
      await this.touch(this.clock.now());
    });
  }

  // --- Events ---

  /** Events of one account in timeline order. */
  async listEvents(accountId: string): Promise<EventRecord[]> {
    const events = await this.db.events.where('accountId').equals(accountId).toArray();
    return sortEvents(events) as EventRecord[];
  }

  async getEvent(id: string): Promise<EventRecord | undefined> {
    return this.db.events.get(id);
  }

  async addEvent(accountId: string, draft: EventDraft): Promise<EventRecord> {
    return this.db.transaction('rw', this.db.accounts, this.db.events, this.db.meta, async () => {
      if (!(await this.db.accounts.get(accountId))) {
        throw new RepositoryError('ACCOUNT_NOT_FOUND');
      }
      const existing = await this.listEvents(accountId);
      const now = this.clock.now();
      const record: EventRecord = {
        ...draft,
        id: crypto.randomUUID(),
        seq: nextSeq(existing),
        accountId,
        createdAt: now,
        updatedAt: now,
      };
      this.assertValid(existing, record);
      await this.db.events.add(record);
      await this.touch(now);
      return record;
    });
  }

  /** Replaces the event's data with `draft`, keeping its id, account and capture order. */
  async updateEvent(id: string, draft: EventDraft): Promise<EventRecord> {
    return this.db.transaction('rw', this.db.events, this.db.meta, async () => {
      const current = await this.db.events.get(id);
      if (!current) throw new RepositoryError('EVENT_NOT_FOUND');
      const existing = await this.listEvents(current.accountId);
      const now = this.clock.now();
      const record: EventRecord = {
        ...draft,
        id: current.id,
        seq: current.seq,
        accountId: current.accountId,
        createdAt: current.createdAt,
        updatedAt: now,
      };
      this.assertValid(existing, record);
      await this.db.events.put(record);
      await this.touch(now);
      return record;
    });
  }

  /** Deletes a movement. The initial balance can only go away with the whole account. */
  async deleteEvent(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.events, this.db.meta, async () => {
      const current = await this.db.events.get(id);
      if (!current) throw new RepositoryError('EVENT_NOT_FOUND');
      const existing = await this.listEvents(current.accountId);
      if (existing[0]?.id === id) throw new RepositoryError('CANNOT_DELETE_INITIAL');
      await this.db.events.delete(id);
      await this.touch(this.clock.now());
    });
  }

  // --- Budget ---

  async listBudgetItems(): Promise<BudgetItemRecord[]> {
    return (await this.db.budgetItems.toArray()).sort(byCreation);
  }

  async getBudgetItem(id: string): Promise<BudgetItemRecord | undefined> {
    return this.db.budgetItems.get(id);
  }

  async addBudgetItem(draft: BudgetItemDraft): Promise<BudgetItemRecord> {
    const item = { ...draft, name: draft.name.trim() };
    assertValidBudgetItem(item);
    const now = this.clock.now();
    const record: BudgetItemRecord = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction('rw', this.db.budgetItems, this.db.meta, async () => {
      await this.db.budgetItems.add(record);
      await this.touch(now);
    });
    return record;
  }

  /**
   * Replaces the item with `draft`. With `fromMonth`, a recurring item that started earlier keeps
   * its past: it ends the month before, and the changed version starts in `fromMonth`.
   */
  async updateBudgetItem(
    id: string,
    draft: BudgetItemDraft,
    fromMonth?: YearMonth,
  ): Promise<BudgetItemRecord> {
    return this.db.transaction('rw', this.db.budgetItems, this.db.meta, async () => {
      const current = await this.db.budgetItems.get(id);
      if (!current) throw new RepositoryError('BUDGET_ITEM_NOT_FOUND');
      const now = this.clock.now();
      const item = { ...draft, name: draft.name.trim() };

      if (fromMonth !== undefined && canSplitAt(current, fromMonth)) {
        const next = startingIn(item, fromMonth);
        assertValidBudgetItem(next);
        const record: BudgetItemRecord = {
          ...next,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        await this.db.budgetItems.put({ ...endBefore(current, fromMonth), updatedAt: now });
        await this.db.budgetItems.add(record);
        await this.touch(now);
        return record;
      }

      assertValidBudgetItem(item);
      const record: BudgetItemRecord = {
        ...item,
        id,
        createdAt: current.createdAt,
        updatedAt: now,
      };
      await this.db.budgetItems.put(record);
      await this.touch(now);
      return record;
    });
  }

  /**
   * Deletes the item from every month; with `fromMonth`, a recurring item that started earlier
   * only stops repeating from that month on.
   */
  async deleteBudgetItem(id: string, fromMonth?: YearMonth): Promise<void> {
    await this.db.transaction('rw', this.db.budgetItems, this.db.meta, async () => {
      const current = await this.db.budgetItems.get(id);
      if (!current) throw new RepositoryError('BUDGET_ITEM_NOT_FOUND');
      const now = this.clock.now();
      if (fromMonth !== undefined && canSplitAt(current, fromMonth)) {
        await this.db.budgetItems.put({ ...endBefore(current, fromMonth), updatedAt: now });
      } else {
        await this.db.budgetItems.delete(id);
      }
      await this.touch(now);
    });
  }

  // --- Credits ---

  async listCredits(): Promise<CreditRecord[]> {
    return (await this.db.credits.toArray()).sort(byCreation);
  }

  async getCredit(id: string): Promise<CreditRecord | undefined> {
    return this.db.credits.get(id);
  }

  async addCredit(draft: CreditDraft): Promise<CreditRecord> {
    const credit = { ...draft, name: draft.name.trim() };
    assertValidCredit(credit);
    const now = this.clock.now();
    const record: CreditRecord = {
      ...credit,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction('rw', this.db.credits, this.db.meta, async () => {
      await this.db.credits.add(record);
      await this.touch(now);
    });
    return record;
  }

  /** Replaces the credit's data, balance updates included. */
  async updateCredit(id: string, draft: CreditDraft): Promise<CreditRecord> {
    return this.db.transaction('rw', this.db.credits, this.db.meta, async () => {
      const current = await this.db.credits.get(id);
      if (!current) throw new RepositoryError('CREDIT_NOT_FOUND');
      const credit = { ...draft, name: draft.name.trim() };
      assertValidCredit(credit);
      const now = this.clock.now();
      const record: CreditRecord = { ...credit, id, createdAt: current.createdAt, updatedAt: now };
      await this.db.credits.put(record);
      await this.touch(now);
      return record;
    });
  }

  /**
   * Records what is owed before a given payment ("actualizar saldo"): a new plan from that payment
   * on. A plan already starting on that date is replaced; it cannot start before the credit.
   */
  async setCreditPlan(id: string, plan: CreditPlan): Promise<CreditRecord> {
    return this.db.transaction('rw', this.db.credits, this.db.meta, async () => {
      const current = await this.db.credits.get(id);
      if (!current) throw new RepositoryError('CREDIT_NOT_FOUND');
      const first = current.plans[0];
      if (first && compareIsoDates(plan.firstPaymentDate, first.firstPaymentDate) < 0) {
        throw new RepositoryError('INVALID_CREDIT');
      }
      const updated = { ...current, plans: withPlan(current.plans, plan) };
      assertValidCredit(updated);
      const now = this.clock.now();
      const record: CreditRecord = { ...updated, updatedAt: now };
      await this.db.credits.put(record);
      await this.touch(now);
      return record;
    });
  }

  /** Removes a balance update; the credit as first registered can only be edited. */
  async deleteCreditPlan(id: string, planIndex: number): Promise<CreditRecord> {
    return this.db.transaction('rw', this.db.credits, this.db.meta, async () => {
      const current = await this.db.credits.get(id);
      if (!current) throw new RepositoryError('CREDIT_NOT_FOUND');
      if (planIndex === 0) throw new RepositoryError('CANNOT_DELETE_FIRST_PLAN');
      if (!current.plans[planIndex]) throw new RepositoryError('INVALID_CREDIT');
      const updated = { ...current, plans: current.plans.filter((_, i) => i !== planIndex) };
      assertValidCredit(updated);
      const now = this.clock.now();
      const record: CreditRecord = { ...updated, updatedAt: now };
      await this.db.credits.put(record);
      await this.touch(now);
      return record;
    });
  }

  async deleteCredit(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.credits, this.db.meta, async () => {
      if (!(await this.db.credits.get(id))) throw new RepositoryError('CREDIT_NOT_FOUND');
      await this.db.credits.delete(id);
      await this.touch(this.clock.now());
    });
  }

  // --- Whole dataset (backups) ---

  private get dataTables() {
    return [this.db.accounts, this.db.events, this.db.budgetItems, this.db.credits];
  }

  /** Everything the user stored, in a deterministic order (stable backup files). */
  async exportData(): Promise<DataSet> {
    return this.db.transaction('r', [...this.dataTables, this.db.meta], async () => {
      const investPlan = await this.readInvestPlan();
      return {
        accounts: await this.listAccounts(),
        events: sortEvents(await this.db.events.toArray()) as EventRecord[],
        budgetItems: await this.listBudgetItems(),
        credits: await this.listCredits(),
        settings: investPlan ? { investPlan } : {},
      };
    });
  }

  /** Whether there is anything worth backing up. */
  async hasData(): Promise<boolean> {
    return this.db.transaction('r', this.dataTables, async () => {
      const counts = await Promise.all(this.dataTables.map((table) => table.count()));
      return counts.some((count) => count > 0);
    });
  }

  /**
   * Replaces all the user's data with `data` in one transaction: either everything is replaced or
   * nothing changes. The data was just read from a backup, so it counts as backed up.
   */
  async replaceAll(data: DataSet): Promise<void> {
    await this.db.transaction('rw', [...this.dataTables, this.db.meta], async () => {
      await Promise.all(this.dataTables.map((table) => table.clear()));
      await this.db.accounts.bulkAdd(data.accounts);
      await this.db.events.bulkAdd(data.events);
      await this.db.budgetItems.bulkAdd(data.budgetItems);
      await this.db.credits.bulkAdd(data.credits);
      if (data.settings.investPlan) {
        await this.db.meta.put({
          key: 'investPlan',
          value: JSON.stringify(data.settings.investPlan),
        });
      } else {
        await this.db.meta.delete('investPlan');
      }
      const now = this.clock.now();
      await this.touch(now);
      await this.db.meta.put({ key: 'lastBackupAt', value: now });
    });
  }

  /** Deletes all the user's data and backup records on this device. */
  async clearAll(): Promise<void> {
    await this.db.transaction('rw', [...this.dataTables, this.db.meta], async () => {
      await Promise.all([...this.dataTables, this.db.meta].map((table) => table.clear()));
    });
  }

  async markBackedUp(): Promise<void> {
    await this.db.meta.put({ key: 'lastBackupAt', value: this.clock.now() });
  }

  // --- Investment plan ---

  /** The stored plan, or `undefined` when the user never changed the defaults. */
  private async readInvestPlan(): Promise<InvestPlan | undefined> {
    const stored = await this.getMeta('investPlan');
    if (stored === undefined) return undefined;
    try {
      return parseInvestPlan(JSON.parse(stored));
    } catch {
      return undefined;
    }
  }

  /** The suggested-investment choices (defaults when never set). */
  async getInvestPlan(): Promise<InvestPlan> {
    return (await this.readInvestPlan()) ?? DEFAULT_INVEST_PLAN;
  }

  async setInvestPlan(plan: InvestPlan): Promise<void> {
    // Only what parses back unchanged is valid.
    if (JSON.stringify(parseInvestPlan(plan)) !== JSON.stringify(plan)) {
      throw new RepositoryError('INVALID_INVEST_PLAN');
    }
    await this.db.transaction('rw', this.db.meta, async () => {
      await this.db.meta.put({ key: 'investPlan', value: JSON.stringify(plan) });
      await this.touch(this.clock.now());
    });
  }

  // --- Meta ---

  async getMeta(key: MetaKey): Promise<string | undefined> {
    return (await this.db.meta.get(key))?.value;
  }

  private async touch(now: string): Promise<void> {
    await this.db.meta.put({ key: 'lastDataChangeAt', value: now });
  }

  private assertValid(existing: readonly AccountEvent[], candidate: AccountEvent): void {
    const issues = validateCandidate(existing, candidate);
    if (issues.length > 0) throw new RepositoryError('INVALID_EVENT', issues);
  }
}
