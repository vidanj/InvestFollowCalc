import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyThemePreference, readThemePreference, saveThemePreference } from '../theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme preference', () => {
  it('defaults to the system theme', () => {
    expect(readThemePreference()).toBe('system');
    localStorage.setItem('investfollowcalc.theme', 'neon');
    expect(readThemePreference()).toBe('system');
  });

  it('saves explicit choices and clears them for "system"', () => {
    saveThemePreference('light');
    expect(readThemePreference()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    saveThemePreference('system');
    expect(readThemePreference()).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readThemePreference()).toBe('system');
    saveThemePreference('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyThemePreference('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
