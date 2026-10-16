import { compareIsoDates, isIsoDate } from './dates';
import { isValidCents } from './money';
import type { AccountEvent } from './types';

export type ValidationIssueCode =
  | 'FIRST_EVENT_NOT_BALANCE'
  | 'BEFORE_INITIAL_BALANCE'
  | 'INITIAL_MUST_BE_FIRST'
  | 'INITIAL_MUST_BE_BALANCE'
  | 'INVALID_DATE'
  | 'INVALID_SEQ'
  | 'INVALID_BALANCE'
  | 'INVALID_AMOUNT'
  | 'BALANCE_AFTER_TOO_LOW';

export interface ValidationIssue {
  code: ValidationIssueCode;
  eventId: string;
}

export class DomainValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Invalid account timeline: ${issues.map((i) => `${i.code}@${i.eventId}`).join(', ')}`);
    this.name = 'DomainValidationError';
    this.issues = issues;
  }
}

/** Deterministic timeline order: date, then capture order, then id. */
export function sortEvents(events: readonly AccountEvent[]): AccountEvent[] {
  return [...events].sort(
    (a, b) =>
      compareIsoDates(a.date, b.date) || a.seq - b.seq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function isNonNegativeCents(value: number): boolean {
  return isValidCents(value) && value >= 0;
}

/**
 * Checks a whole account timeline. Messages are not produced here: the UI maps each issue code
 * to a text in `src/i18n`.
 */
export function validateTimeline(events: readonly AccountEvent[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sorted = sortEvents(events);

  const first = sorted[0];
  if (first && first.type !== 'balance') {
    issues.push({ code: 'FIRST_EVENT_NOT_BALANCE', eventId: first.id });
  }

  for (const event of sorted) {
    if (!isIsoDate(event.date)) issues.push({ code: 'INVALID_DATE', eventId: event.id });
    if (!Number.isFinite(event.seq)) issues.push({ code: 'INVALID_SEQ', eventId: event.id });

    if (event.type === 'balance') {
      if (!isNonNegativeCents(event.balance)) {
        issues.push({ code: 'INVALID_BALANCE', eventId: event.id });
      }
      continue;
    }

    if (!isValidCents(event.amount) || event.amount <= 0) {
      issues.push({ code: 'INVALID_AMOUNT', eventId: event.id });
    }
    if (event.balanceAfter !== undefined) {
      if (!isNonNegativeCents(event.balanceAfter)) {
        issues.push({ code: 'INVALID_BALANCE', eventId: event.id });
      } else if (event.type === 'deposit' && event.balanceAfter < event.amount) {
        // The balance right before the deposit would be negative.
        issues.push({ code: 'BALANCE_AFTER_TOO_LOW', eventId: event.id });
      }
    }
  }

  return issues;
}

/**
 * Validates adding `candidate` to an account, or replacing the event with the same id. Besides the
 * timeline rules, the initial balance must stay a balance and stay the earliest event, and no
 * other event may be dated before it.
 */
export function validateCandidate(
  events: readonly AccountEvent[],
  candidate: AccountEvent,
): ValidationIssue[] {
  const initial = sortEvents(events)[0];
  const next = [...events.filter((e) => e.id !== candidate.id), candidate];
  const timelineIssues = validateTimeline(next);
  if (!initial) return timelineIssues;

  const structural: ValidationIssue[] = [];
  if (candidate.id === initial.id) {
    if (candidate.type !== 'balance') {
      structural.push({ code: 'INITIAL_MUST_BE_BALANCE', eventId: candidate.id });
    } else if (sortEvents(next)[0]?.id !== candidate.id) {
      structural.push({ code: 'INITIAL_MUST_BE_FIRST', eventId: candidate.id });
    }
  } else if (compareIsoDates(candidate.date, initial.date) < 0) {
    structural.push({ code: 'BEFORE_INITIAL_BALANCE', eventId: candidate.id });
  }

  if (structural.length === 0) return timelineIssues;
  // The structural issue already explains why the timeline would not start with a balance.
  return [...structural, ...timelineIssues.filter((i) => i.code !== 'FIRST_EVENT_NOT_BALANCE')];
}

/** Capture order for a new event: after every existing event of the account. */
export function nextSeq(events: readonly AccountEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}
