import { describe, expect, it } from 'vitest';
import { balance, deposit } from '../../../domain/__tests__/builders';
import {
  ACCOUNT_COLORS,
  accountColorVar,
  computeSafely,
  readFlash,
  suggestColor,
} from '../accountHelpers';

describe('account colors', () => {
  it('maps palette slots (and earlier colors) to theme-aware CSS variables', () => {
    expect(accountColorVar('#2a78d6')).toBe('var(--account-1)');
    expect(accountColorVar('#E34948')).toBe('var(--account-8)');
    expect(accountColorVar('#0f766e')).toBe('var(--account-1)');
    expect(accountColorVar('#123456')).toBe('#123456');
  });

  it('suggests slots in fixed order, skipping used ones, never generating new hues', () => {
    expect(suggestColor([])).toBe(ACCOUNT_COLORS[0]);
    expect(suggestColor([ACCOUNT_COLORS[0]])).toBe(ACCOUNT_COLORS[1]);
    expect(suggestColor(['#0f766e', '#2563eb'])).toBe(ACCOUNT_COLORS[2]);
    expect(suggestColor([...ACCOUNT_COLORS])).toBe(ACCOUNT_COLORS[0]);
  });
});

describe('computeSafely', () => {
  it('returns the computation, or null for a corrupted timeline', () => {
    expect(computeSafely([balance('2026-01-01', 1)])?.summary).not.toBeNull();
    expect(computeSafely([deposit('2026-01-01', 1)])).toBeNull();
  });
});

describe('readFlash', () => {
  it('only accepts a list of strings', () => {
    expect(readFlash({ flash: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(readFlash({ flash: [1] })).toBeNull();
    expect(readFlash({ other: true })).toBeNull();
    expect(readFlash(null)).toBeNull();
  });
});
