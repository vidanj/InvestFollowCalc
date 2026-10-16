import { computeAccount } from '../../domain/engine';
import type { AccountComputation, AccountEvent } from '../../domain/types';

/** Chart/series colors offered when creating an account. Readable on light and dark themes. */
export const ACCOUNT_COLORS = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#65a30d',
  '#0891b2',
  '#ca8a04',
] as const;

/** First palette color not used yet, so new accounts are easy to tell apart. */
export function suggestColor(usedColors: readonly string[]): string {
  return ACCOUNT_COLORS.find((c) => !usedColors.includes(c)) ?? ACCOUNT_COLORS[0];
}

/**
 * Stored data is validated on every write, so this only fails if the database was corrupted
 * from outside the app. The UI shows a message instead of crashing.
 */
export function computeSafely(events: readonly AccountEvent[]): AccountComputation | null {
  try {
    return computeAccount(events);
  } catch {
    return null;
  }
}

/** Lines shown once on the account page right after saving a movement. */
export interface FlashState {
  flash: string[];
}

export function readFlash(state: unknown): string[] | null {
  if (typeof state !== 'object' || state === null || !('flash' in state)) return null;
  const { flash } = state;
  return Array.isArray(flash) && flash.every((line) => typeof line === 'string') ? flash : null;
}
