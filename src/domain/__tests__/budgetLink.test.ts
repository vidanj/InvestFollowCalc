import { describe, expect, it } from 'vitest';
import { validateBudgetItem } from '../budget';
import { isLinkConsistent, linkedBudgetItem } from '../budgetLink';
import { balance, cents, deposit, withdrawal } from './builders';

describe('linkedBudgetItem', () => {
  it('mirrors a contribution as a one-off investment expense in its month', () => {
    const event = deposit('2026-03-14', 1_500);
    const item = linkedBudgetItem(event, 'USD', 'Aportación · GBM');
    expect(item).toEqual({
      kind: 'expense',
      category: 'investment',
      name: 'Aportación · GBM',
      amount: cents(1_500),
      currency: 'USD',
      month: '2026-03',
      repeat: 'none',
      sourceEventId: event.id,
    });
    expect(validateBudgetItem(item)).toEqual([]);
  });

  it('mirrors a withdrawal as a one-off income', () => {
    const event = withdrawal('2026-12-31', 200);
    const item = linkedBudgetItem(event, 'MXN', 'Retiro · Cetes');
    expect(item).toEqual({
      kind: 'income',
      name: 'Retiro · Cetes',
      amount: cents(200),
      currency: 'MXN',
      month: '2026-12',
      repeat: 'none',
      sourceEventId: event.id,
    });
    expect(validateBudgetItem(item)).toEqual([]);
  });

  it('keeps the name within the budget limit', () => {
    const item = linkedBudgetItem(deposit('2026-01-02', 1), 'MXN', `  ${'x'.repeat(80)}  `);
    expect(item.name).toBe('x'.repeat(60));
    expect(validateBudgetItem(item)).toEqual([]);
  });
});

describe('isLinkConsistent', () => {
  const event = deposit('2026-03-14', 1_500);
  const item = { id: 'b1', ...linkedBudgetItem(event, 'MXN', 'Aportación') };

  it('accepts the item built from the movement', () => {
    expect(isLinkConsistent(item, event, 'MXN')).toBe(true);
    const out = withdrawal('2026-03-14', 10);
    expect(isLinkConsistent({ id: 'b2', ...linkedBudgetItem(out, 'MXN', 'R') }, out, 'MXN')).toBe(
      true,
    );
  });

  it('rejects any difference with the movement', () => {
    expect(isLinkConsistent(item, event, 'USD')).toBe(false);
    expect(isLinkConsistent({ ...item, amount: 1 }, event, 'MXN')).toBe(false);
    expect(isLinkConsistent({ ...item, month: '2026-04' }, event, 'MXN')).toBe(false);
    expect(isLinkConsistent({ ...item, sourceEventId: 'other' }, event, 'MXN')).toBe(false);
    expect(isLinkConsistent(item, { ...event, type: 'withdrawal' }, 'MXN')).toBe(false);
    expect(isLinkConsistent(item, balance('2026-03-14', 10), 'MXN')).toBe(false);
  });
});
