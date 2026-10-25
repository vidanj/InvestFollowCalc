import Dexie, { type Table } from 'dexie';
import type { BudgetItem, Repeat } from '../domain/budget';
import type { Credit } from '../domain/credit';
import type { InvestPlan } from '../domain/investPlan';
import type { Account, AccountEvent } from '../domain/types';

export const DB_NAME = 'investfollowcalc';

/**
 * Bump together with a new `db.version(...)` block and a migration test. Backups store it too,
 * so old backups can be migrated on import.
 */
export const SCHEMA_VERSION = 3;

interface Timestamps {
  /** ISO datetime. */
  createdAt: string;
  updatedAt: string;
}

export type AccountRecord = Account & Timestamps;
export type EventRecord = AccountEvent & Timestamps & { accountId: string };
export type BudgetItemRecord = BudgetItem & Timestamps;
export type CreditRecord = Credit & Timestamps;

/** Preferences that travel with the data (device-only ones, like the theme, never do). */
export interface DataSettings {
  investPlan?: InvestPlan;
}

/** Everything the user stored, as backups carry it. */
export interface DataSet {
  accounts: AccountRecord[];
  events: EventRecord[];
  budgetItems: BudgetItemRecord[];
  credits: CreditRecord[];
  settings: DataSettings;
}

export type MetaKey = 'lastDataChangeAt' | 'lastBackupAt' | 'investPlan';
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
  // v3: budget items repeat weekly, monthly or yearly (`repeat`) instead of only monthly.
  db.version(3)
    .stores({})
    .upgrade(async (tx) => {
      await tx
        .table<V2BudgetItem>('budgetItems')
        .toCollection()
        .modify((item) => {
          Object.assign(item, upgradeBudgetItemV2(item));
          delete item.recurring;
        });
    });
  return db;
}

/** A budget item as schema v2 stored it. */
export interface V2BudgetItem {
  recurring?: boolean;
  repeat?: Repeat;
}

/** v2 → v3: `recurring: true` repeated every month; `false` was a one-off. */
export function upgradeBudgetItemV2<T extends V2BudgetItem>(
  item: T,
): Omit<T, 'recurring'> & { repeat: Repeat } {
  const { recurring, ...rest } = item;
  return { ...rest, repeat: recurring ? 'monthly' : 'none' };
}
