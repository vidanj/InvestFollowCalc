import { z } from 'zod';
import { CURRENCIES } from '../domain/types';
import { MAX_ITERATIONS } from './crypto';

export const BACKUP_FORMAT = 'investfollowcalc-backup';
/** Envelope/encryption format. Bump when crypto parameters or the envelope shape change. */
export const BACKUP_FORMAT_VERSION = 1;

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);

/** The file on disk: only metadata is readable; the data itself is encrypted. */
export const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().min(1).max(MAX_ITERATIONS),
    salt: base64,
  }),
  cipher: z.object({ name: z.literal('AES-GCM'), iv: base64 }),
  data: base64,
});
export type BackupEnvelope = z.infer<typeof envelopeSchema>;

/** Only the version fields, read before migrating older payloads. */
export const payloadHeaderSchema = z.object({
  schemaVersion: z.number().int().positive(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cents = z.number().int().refine(Number.isSafeInteger);
const timestamps = { createdAt: z.string(), updatedAt: z.string() };
const eventBase = {
  id: z.string().min(1),
  accountId: z.string().min(1),
  date: isoDate,
  seq: z.number().finite(),
  ...timestamps,
};

export const accountRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  currency: z.enum(CURRENCIES),
  color: z.string(),
  archived: z.boolean(),
  ...timestamps,
});

export const eventRecordSchema = z.discriminatedUnion('type', [
  z.object({ ...eventBase, type: z.literal('balance'), balance: cents }),
  z.object({
    ...eventBase,
    type: z.enum(['deposit', 'withdrawal']),
    amount: cents,
    balanceAfter: cents.optional(),
  }),
]);

/** Decrypted content, current schema version. */
export const payloadSchema = z.object({
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  exportedAt: z.string(),
  accounts: z.array(accountRecordSchema),
  events: z.array(eventRecordSchema),
  /** Reserved for synced settings; device-only preferences (theme) never go here. */
  settings: z.object({}),
});
export type BackupPayload = z.infer<typeof payloadSchema>;
