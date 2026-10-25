import { describe, expect, it } from 'vitest';
import { countOf, strings } from '../es-MX';

describe('backup texts', () => {
  it('warn about everything that will be replaced', () => {
    expect(strings.backup.replaceWarning(false)).toMatch(/no tiene datos/);
    expect(strings.backup.replaceWarning(true)).toMatch(/cuentas, presupuesto y créditos/);
  });

  it('pluralizes counts', () => {
    expect(countOf(1, 'cuenta', 'cuentas')).toBe('1 cuenta');
    expect(countOf(0, 'cuenta', 'cuentas')).toBe('0 cuentas');
    expect(strings.backup.previewSummary(2, 1, '16 oct 2026')).toBe(
      '2 cuentas y 1 movimiento, creado el 16 oct 2026.',
    );
    expect(strings.backup.previewBudget(1, 2)).toBe('Presupuesto: 1 concepto y 2 créditos.');
  });
});
