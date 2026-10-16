import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration } from '../es-MX';

describe('formatDuration', () => {
  it.each([
    [0, 'el mismo día'],
    [1, '1 día'],
    [5, '5 días'],
    [7, '7 días (1 semana)'],
    [11, '11 días (1.6 semanas)'],
    [59, '59 días (8.4 semanas)'],
    [365, '365 días (12 meses)'],
    [90, '90 días (3 meses)'],
  ])('%i days → %s', (days, expected) => {
    expect(formatDuration(days)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('shows a short Spanish date that does not shift with the timezone', () => {
    expect(formatDate('2026-10-01')).toMatch(/^1 oct\.? 2026$/);
    expect(formatDate('2026-12-31')).toMatch(/^31 dic\.? 2026$/);
  });
});
