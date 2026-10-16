import type { AccountRecord, EventRecord } from '../db/schema';
import { SCHEMA_VERSION } from '../db/schema';
import { validateTimeline } from '../domain/validation';
import { decrypt, DecryptionError, encrypt, PBKDF2_ITERATIONS } from './crypto';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  envelopeSchema,
  payloadHeaderSchema,
  payloadSchema,
  type BackupEnvelope,
  type BackupPayload,
} from './schema';

export type BackupErrorCode =
  'NOT_A_BACKUP' | 'UNSUPPORTED_VERSION' | 'WRONG_PASSWORD_OR_CORRUPT' | 'INVALID_CONTENT';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BackupError';
    this.code = code;
  }
}

export interface BackupData {
  accounts: AccountRecord[];
  events: EventRecord[];
}

export interface BackupContents extends BackupData {
  exportedAt: string;
  appVersion: string;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Upgrades payloads written by older app versions, one schema step at a time. Add an entry here
 * whenever SCHEMA_VERSION goes up, so old backups always stay importable.
 */
const MIGRATIONS: Record<number, (payload: unknown) => unknown> = {
  // 1: (payload) => ({ ...payload, schemaVersion: 2, ... }),
};

function migrate(payload: unknown): unknown {
  let current = payload;
  for (;;) {
    const header = payloadHeaderSchema.safeParse(current);
    if (!header.success) throw new BackupError('INVALID_CONTENT', 'missing schemaVersion');
    const { schemaVersion } = header.data;
    if (schemaVersion === SCHEMA_VERSION) return current;
    if (schemaVersion > SCHEMA_VERSION) throw new BackupError('UNSUPPORTED_VERSION');
    const step = MIGRATIONS[schemaVersion];
    if (!step) throw new BackupError('INVALID_CONTENT', `no migration from v${schemaVersion}`);
    current = step(current);
  }
}

/** Checks what zod cannot: unique ids, events pointing at real accounts, computable timelines. */
function checkIntegrity({ accounts, events }: BackupData): void {
  const accountIds = new Set(accounts.map((a) => a.id));
  if (accountIds.size !== accounts.length)
    throw new BackupError('INVALID_CONTENT', 'duplicate account id');
  if (new Set(events.map((e) => e.id)).size !== events.length) {
    throw new BackupError('INVALID_CONTENT', 'duplicate event id');
  }
  for (const event of events) {
    if (!accountIds.has(event.accountId)) {
      throw new BackupError('INVALID_CONTENT', 'event without account');
    }
  }
  for (const account of accounts) {
    const timeline = events.filter((e) => e.accountId === account.id);
    if (timeline.length === 0 || validateTimeline(timeline).length > 0) {
      throw new BackupError('INVALID_CONTENT', 'invalid account timeline');
    }
  }
}

export function backupFileName(exportedAt: string): string {
  return `investfollowcalc-respaldo-${exportedAt.slice(0, 10)}.json`;
}

export interface CreateBackupOptions {
  /** ISO datetime of the export. */
  now: string;
  appVersion: string;
  /** Only tests lower this; the value is stored in the file, so reading always uses the right one. */
  iterations?: number;
}

/** Encrypts all user data into the text of a backup file. */
export async function createBackup(
  data: BackupData,
  password: string,
  { now, appVersion, iterations = PBKDF2_ITERATIONS }: CreateBackupOptions,
): Promise<{ fileName: string; text: string }> {
  const payload: BackupPayload = {
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    accounts: data.accounts,
    events: data.events,
    settings: {},
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    ...(await encrypt(plaintext, password, iterations)),
  };
  return { fileName: backupFileName(now), text: JSON.stringify(envelope, null, 2) };
}

/**
 * Reads, decrypts, migrates and fully validates a backup file. Nothing is written anywhere: the
 * caller decides whether to replace the current data with the result.
 *
 * @throws {BackupError}
 */
export async function readBackup(text: string, password: string): Promise<BackupContents> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('NOT_A_BACKUP');
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    throw new BackupError('NOT_A_BACKUP');
  }
  const { formatVersion } = raw as { formatVersion?: unknown };
  if (typeof formatVersion === 'number' && formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError('UNSUPPORTED_VERSION');
  }
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) throw new BackupError('NOT_A_BACKUP');

  let plaintext: Uint8Array;
  try {
    plaintext = await decrypt(envelope.data, password);
  } catch (error) {
    if (error instanceof DecryptionError) throw new BackupError('WRONG_PASSWORD_OR_CORRUPT');
    throw error;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new BackupError('INVALID_CONTENT', 'not JSON');
  }
  const parsed = payloadSchema.safeParse(migrate(decoded));
  if (!parsed.success) throw new BackupError('INVALID_CONTENT', parsed.error.message);

  const { accounts, events, exportedAt, appVersion } = parsed.data;
  const data = { accounts, events: events as EventRecord[] };
  checkIntegrity(data);
  return { ...data, exportedAt, appVersion };
}
