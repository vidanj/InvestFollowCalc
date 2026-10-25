import Dexie, { type Table } from 'dexie';
import type { BudgetItem } from '../domain/budget';
import type { Credit } from '../domain/credit';
import type { Account, AccountEvent } from '../domain/types';

export const DB_NAME = 'investfollowcalc';

/**
 * Bump together with a new `db.version(...)` block and a migration test. Backups store it too,
 * so old backups can be migrated on import.
 */
export const SCHEMA_VERSION = 2;

interface Timestamps {
  /** ISO datetime. */
  createdAt: string;
  updatedAt: string;
}

export type AccountRecord = Account & Timestamps;
export type EventRecord = AccountEvent & Timestamps & { accountId: string };
export type BudgetItemRecord = BudgetItem & Timestamps;
export type CreditRecord = Credit & Timestamps;

/** Everything the user stored, as backups carry it. */
export interface DataSet {
  accounts: AccountRecord[];
  events: EventRecord[];
  budgetItems: BudgetItemRecord[];
  credits: CreditRecord[];
}

export type MetaKey = 'lastDataChangeAt' | 'lastBackupAt';
export interface MetaRecord {
  key: MetaKey;
  value: string;
}

export type InvestDb = Dexie & {
  accounts: Table<AccountRecord, string>;
  events: Table<EventRecord, string>;
  meta: Table<MetaRecord, MetaKey>;
  budgetItems: Table<BudgetItemRecord, string>;
  credits: Table<CreditRecord, string>;
};

export function createDb(name: string = DB_NAME): InvestDb {
  const db = new Dexie(name) as InvestDb;
  // v1: investment accounts and their movements.
  db.version(1).stores({
    accounts: 'id',
    events: 'id, accountId',
    meta: 'key',
  });
  // v2: monthly budget and credits. Only new tables: existing data stays as it is.
  db.version(2).stores({
    budgetItems: 'id',
    credits: 'id',
  });
  return db;
}
