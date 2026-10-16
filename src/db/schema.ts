import Dexie, { type Table } from 'dexie';
import type { Account, AccountEvent } from '../domain/types';

export const DB_NAME = 'investfollowcalc';

/**
 * Bump together with a new `db.version(...)` block and a migration test. Backups store it too,
 * so old backups can be migrated on import.
 */
export const SCHEMA_VERSION = 1;

interface Timestamps {
  /** ISO datetime. */
  createdAt: string;
  updatedAt: string;
}

export type AccountRecord = Account & Timestamps;
export type EventRecord = AccountEvent & Timestamps & { accountId: string };

export type MetaKey = 'lastDataChangeAt' | 'lastBackupAt';
export interface MetaRecord {
  key: MetaKey;
  value: string;
}

export type InvestDb = Dexie & {
  accounts: Table<AccountRecord, string>;
  events: Table<EventRecord, string>;
  meta: Table<MetaRecord, MetaKey>;
};

export function createDb(name: string = DB_NAME): InvestDb {
  const db = new Dexie(name) as InvestDb;
  db.version(SCHEMA_VERSION).stores({
    accounts: 'id',
    events: 'id, accountId',
    meta: 'key',
  });
  return db;
}
