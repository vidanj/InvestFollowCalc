import { computeAccount } from './engine';
import type { AccountEvent, AccountSummary, Period } from './types';
import { validateCandidate, type ValidationIssue } from './validation';

export type EventPreview =
  | { ok: false; issues: ValidationIssue[] }
  | {
      ok: true;
      /** The period this event closes (gain realized up to it); `null` if it closes none. */
      closedPeriod: Period | null;
      /** Account summary once the event is saved. */
      summary: AccountSummary;
    };

/**
 * What saving `candidate` would do to the account: the gain it reveals and the new totals.
 * `candidate` replaces the existing event with the same id, so this also previews edits.
 */
export function previewEvent(
  events: readonly AccountEvent[],
  candidate: AccountEvent,
): EventPreview {
  const issues = validateCandidate(events, candidate);
  if (issues.length > 0) return { ok: false, issues };

  const next = [...events.filter((e) => e.id !== candidate.id), candidate];
  const { periods, summary } = computeAccount(next);
  // A valid, non-empty timeline always has a summary.
  return {
    ok: true,
    closedPeriod: periods.find((p) => p.endEventId === candidate.id) ?? null,
    summary: summary as AccountSummary,
  };
}
