// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AccountRecord, EventRecord } from '../../db/schema';
import { SCHEMA_VERSION } from '../../db/schema';
import { backupFileName, BackupError, createBackup, readBackup, type BackupData } from '../backup';
import { decrypt, encrypt, fromBase64, PBKDF2_ITERATIONS, toBase64 } from '../crypto';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from '../schema';

// Tests use few PBKDF2 iterations for speed; the count travels inside the file.
const FAST = { now: '2026-10-16T12:00:00.000Z', appVersion: '0.1.0', iterations: 1_000 };
const PASSWORD = 'correct horse battery';

const stamp = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const account: AccountRecord = {
  id: 'acc-1',
  name: 'Ahorro',
  currency: 'MXN',
  color: '#2a78d6',
  archived: false,
  ...stamp,
};
const events: EventRecord[] = [
  {
    id: 'e1',
    accountId: 'acc-1',
    seq: 1,
    date: '2026-10-01',
    type: 'balance',
    balance: 1_000_000,
    ...stamp,
  },
  {
    id: 'e2',
    accountId: 'acc-1',
    seq: 2,
    date: '2026-10-12',
    type: 'balance',
    balance: 1_000_100,
    ...stamp,
  },
  {
    id: 'e3',
    accountId: 'acc-1',
    seq: 3,
    date: '2026-10-15',
    type: 'deposit',
    amount: 50_000,
    balanceAfter: 1_050_100,
    ...stamp,
  },
  {
    id: 'e4',
    accountId: 'acc-1',
    seq: 4,
    date: '2026-10-16',
    type: 'withdrawal',
    amount: 100,
    ...stamp,
  },
];
const data: BackupData = { accounts: [account], events };

async function expectBackupError(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BackupError);
  expect((error as BackupError).code).toBe(code);
}

/** A well-formed, correctly encrypted file around an arbitrary payload. */
async function fileWithPayload(payload: unknown): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    ...(await encrypt(plaintext, PASSWORD, 1_000)),
  });
}

const validPayload = () => ({
  schemaVersion: SCHEMA_VERSION,
  appVersion: '0.1.0',
  exportedAt: FAST.now,
  accounts: [account],
  events,
  settings: {},
});

describe('createBackup / readBackup', () => {
  it('round-trips every account and movement exactly', async () => {
    const { fileName, text } = await createBackup(data, PASSWORD, FAST);

    expect(fileName).toBe('investfollowcalc-respaldo-2026-10-16.json');
    const contents = await readBackup(text, PASSWORD);
    expect(contents.accounts).toEqual(data.accounts);
    expect(contents.events).toEqual(data.events);
    expect(contents.exportedAt).toBe(FAST.now);
    expect(contents.appVersion).toBe('0.1.0');
  });

  it('never stores the data in plain text', async () => {
    const { text } = await createBackup(data, PASSWORD, FAST);
    expect(text).not.toContain('Ahorro');
    expect(text).not.toContain('1000000');
    expect(JSON.parse(text)).toMatchObject({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1_000 },
      cipher: { name: 'AES-GCM' },
    });
  });

  it('uses 600,000 PBKDF2 iterations by default', async () => {
    const { text } = await createBackup(data, PASSWORD, { now: FAST.now, appVersion: '0.1.0' });
    expect((JSON.parse(text) as { kdf: { iterations: number } }).kdf.iterations).toBe(
      PBKDF2_ITERATIONS,
    );
    expect(PBKDF2_ITERATIONS).toBe(600_000);
  });

  it('rejects a wrong password', async () => {
    const { text } = await createBackup(data, PASSWORD, FAST);
    await expectBackupError(readBackup(text, 'wrong password'), 'WRONG_PASSWORD_OR_CORRUPT');
  });

  it('detects any altered byte', async () => {
    const { text } = await createBackup(data, PASSWORD, FAST);
    const envelope = JSON.parse(text) as { data: string; cipher: { iv: string } };
    const bytes = fromBase64(envelope.data);
    bytes[10] = (bytes[10] ?? 0) ^ 0x01;
    const tampered = JSON.stringify({ ...envelope, data: toBase64(bytes) });
    await expectBackupError(readBackup(tampered, PASSWORD), 'WRONG_PASSWORD_OR_CORRUPT');

    const iv = fromBase64(envelope.cipher.iv);
    iv[0] = (iv[0] ?? 0) ^ 0x01;
    const badIv = JSON.stringify({ ...envelope, cipher: { ...envelope.cipher, iv: toBase64(iv) } });
    await expectBackupError(readBackup(badIv, PASSWORD), 'WRONG_PASSWORD_OR_CORRUPT');
  });

  it('rejects files that are not backups', async () => {
    await expectBackupError(readBackup('not json at all', PASSWORD), 'NOT_A_BACKUP');
    await expectBackupError(readBackup('{"hello":"world"}', PASSWORD), 'NOT_A_BACKUP');
    await expectBackupError(readBackup('[1,2,3]', PASSWORD), 'NOT_A_BACKUP');
    await expectBackupError(
      readBackup(JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1 }), PASSWORD),
      'NOT_A_BACKUP',
    );
  });

  it('refuses backups from a newer app version', async () => {
    const { text } = await createBackup(data, PASSWORD, FAST);
    const newerFormat = JSON.stringify({ ...JSON.parse(text), formatVersion: 99 });
    await expectBackupError(readBackup(newerFormat, PASSWORD), 'UNSUPPORTED_VERSION');

    const newerSchema = await fileWithPayload({ ...validPayload(), schemaVersion: 99 });
    await expectBackupError(readBackup(newerSchema, PASSWORD), 'UNSUPPORTED_VERSION');
  });

  it('rejects decrypted content that is incomplete or inconsistent', async () => {
    const cases: unknown[] = [
      'just a string',
      { ...validPayload(), schemaVersion: undefined },
      { ...validPayload(), accounts: [{ ...account, currency: 'EUR' }] },
      { ...validPayload(), events: [...events, { ...events[0], id: 'e9', accountId: 'ghost' }] },
      { ...validPayload(), accounts: [account, account] },
      { ...validPayload(), events: [...events, events[1]] },
      { ...validPayload(), events: events.slice(2) }, // timeline no longer starts with a balance
      { ...validPayload(), events: [] }, // account without its initial balance
      { ...validPayload(), events: [{ ...events[0], balance: 1.5 }] },
    ];
    for (const payload of cases) {
      await expectBackupError(
        readBackup(await fileWithPayload(payload), PASSWORD),
        'INVALID_CONTENT',
      );
    }

    const notJson = JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      ...(await encrypt(new TextEncoder().encode('{oops'), PASSWORD, 1_000)),
    });
    await expectBackupError(readBackup(notJson, PASSWORD), 'INVALID_CONTENT');
  });

  it('drops unknown fields instead of storing them', async () => {
    const contents = await readBackup(
      await fileWithPayload({
        ...validPayload(),
        accounts: [{ ...account, injected: '<script>' }],
      }),
      PASSWORD,
    );
    expect(contents.accounts[0]).not.toHaveProperty('injected');
  });

  it('accepts an empty backup', async () => {
    const { text } = await createBackup({ accounts: [], events: [] }, PASSWORD, FAST);
    expect(await readBackup(text, PASSWORD)).toMatchObject({ accounts: [], events: [] });
  });

  it('names files by export date', () => {
    expect(backupFileName('2027-01-05T23:59:59.000Z')).toBe(
      'investfollowcalc-respaldo-2027-01-05.json',
    );
  });
});

describe('crypto', () => {
  it('uses a fresh salt and IV for every encryption', async () => {
    const plaintext = new TextEncoder().encode('same input');
    const a = await encrypt(plaintext, PASSWORD, 1_000);
    const b = await encrypt(plaintext, PASSWORD, 1_000);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.data).not.toBe(b.data);
    expect(new TextDecoder().decode(await decrypt(b, PASSWORD))).toBe('same input');
  });

  it('round-trips base64 for every byte value', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
