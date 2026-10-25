import { z } from 'zod';
import { EXPENSE_CATEGORIES, REPEATS } from '../domain/budget';
import { MAX_RATE_BPS, PAYMENT_FREQUENCIES } from '../domain/credit';
import { CURRENCIES } from '../domain/types';
import { MAX_ITERATIONS } from './crypto';

// No eval: zod would otherwise probe `new Function`, which the strict CSP (script-src 'self')
// blocks and reports as a violation. Interpreted parsing is plenty fast for backup-sized data.
z.config({ jitless: true });

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
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);
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

const budgetItemBase = {
  id: z.string().min(1),
  name: z.string(),
  amount: cents,
  currency: z.enum(CURRENCIES),
  month: yearMonth,
  repeat: z.enum(REPEATS),
  firstDate: isoDate.optional(),
  endMonth: yearMonth.optional(),
  ...timestamps,
};

export const budgetItemRecordSchema = z.discriminatedUnion('kind', [
  z.object({ ...budgetItemBase, kind: z.literal('income') }),
  z.object({ ...budgetItemBase, kind: z.literal('expense'), category: z.enum(EXPENSE_CATEGORIES) }),
]);

export const creditRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  currency: z.enum(CURRENCIES),
  annualRateBps: z.number().int(),
  ivaOnInterest: z.boolean(),
  frequency: z.enum(PAYMENT_FREQUENCIES),
  upfrontFees: cents,
  plans: z.array(z.object({ firstPaymentDate: isoDate, balance: cents, payment: cents })),
  ...timestamps,
});

const rateSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('portfolio') }),
  z.object({ kind: z.literal('account'), accountId: z.string().min(1) }),
  z.object({ kind: z.literal('manual'), rateBps: z.number().int().min(0).max(MAX_RATE_BPS) }),
]);

export const investPlanSchema = z.object({
  percent: z.number().int().min(0).max(100),
  sources: z.object({
    USD: rateSourceSchema.optional(),
    MXN: rateSourceSchema.optional(),
  }),
});

/** Decrypted content, current schema version. */
export const payloadSchema = z.object({
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  exportedAt: z.string(),
  accounts: z.array(accountRecordSchema),
  events: z.array(eventRecordSchema),
  /** Since schema v2. */
  budgetItems: z.array(budgetItemRecordSchema),
  credits: z.array(creditRecordSchema),
  /** Synced settings (since v3); device-only preferences (theme) never go here. */
  settings: z.object({ investPlan: investPlanSchema.optional() }),
});
export type BackupPayload = z.infer<typeof payloadSchema>;
