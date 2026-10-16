import { computeAccount } from '../../domain/engine';
import type { AccountComputation, AccountEvent } from '../../domain/types';

/**
 * Account identity colors: the 8 categorical slots of the validated dataviz palette, in their
 * fixed order (light-mode hex is what gets stored). Each maps to a `--account-N` CSS variable
 * whose value switches to the dark step in dark mode.
 */
export const ACCOUNT_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;

// Colors offered before the palette was validated; mapped slot by slot.
const LEGACY_COLORS = [
  '#0f766e',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#65a30d',
  '#0891b2',
  '#ca8a04',
];

/** CSS color for an account's stored color, following the light/dark theme. */
export function accountColorVar(color: string): string {
  const normalized = color.toLowerCase();
  let slot = ACCOUNT_COLORS.indexOf(normalized as (typeof ACCOUNT_COLORS)[number]);
  if (slot === -1) slot = LEGACY_COLORS.indexOf(normalized);
  return slot === -1 ? color : `var(--account-${slot + 1})`;
}

/** First palette slot not used yet, in the fixed order (never cycled or generated). */
export function suggestColor(usedColors: readonly string[]): string {
  const used = new Set(usedColors.map((c) => accountColorVar(c)));
  return ACCOUNT_COLORS.find((c) => !used.has(accountColorVar(c))) ?? ACCOUNT_COLORS[0];
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
