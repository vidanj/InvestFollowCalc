import type { AccountEvent, Cents, Currency, EventDraft, IsoDate } from '../domain/types';
import { nextSeq, sortEvents, validateCandidate, type ValidationIssue } from '../domain/validation';
import type { AccountRecord, EventRecord, InvestDb, MetaKey } from './schema';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

export type RepositoryErrorCode =
  | 'ACCOUNT_NOT_FOUND'
  | 'EVENT_NOT_FOUND'
  | 'INVALID_ACCOUNT'
  | 'INVALID_EVENT'
  | 'CANNOT_DELETE_INITIAL';

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

  // --- Whole dataset (backups) ---

  /** Every account and movement, in a deterministic order (stable backup files). */
  async exportData(): Promise<{ accounts: AccountRecord[]; events: EventRecord[] }> {
    return this.db.transaction('r', this.db.accounts, this.db.events, async () => ({
      accounts: await this.listAccounts(),
      events: sortEvents(await this.db.events.toArray()) as EventRecord[],
    }));
  }

  /**
   * Replaces all accounts and movements with `data` in one transaction: either everything is
   * replaced or nothing changes. The data was just read from a backup, so it counts as backed up.
   */
  async replaceAll(data: { accounts: AccountRecord[]; events: EventRecord[] }): Promise<void> {
    await this.db.transaction('rw', this.db.accounts, this.db.events, this.db.meta, async () => {
      await this.db.accounts.clear();
      await this.db.events.clear();
      await this.db.accounts.bulkAdd(data.accounts);
      await this.db.events.bulkAdd(data.events);
      const now = this.clock.now();
      await this.touch(now);
      await this.db.meta.put({ key: 'lastBackupAt', value: now });
    });
  }

  /** Deletes every account, movement and backup record on this device. */
  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.accounts, this.db.events, this.db.meta, async () => {
      await this.db.accounts.clear();
      await this.db.events.clear();
      await this.db.meta.clear();
    });
  }

  async markBackedUp(): Promise<void> {
    await this.db.meta.put({ key: 'lastBackupAt', value: this.clock.now() });
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
