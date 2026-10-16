import { describe, expect, it } from 'vitest';
import { countOf, strings } from '../es-MX';

describe('backup texts', () => {
  it('agree in number with the accounts being replaced', () => {
    expect(strings.backup.replaceWarning(0)).toMatch(/no tiene datos/);
    expect(strings.backup.replaceWarning(1)).toMatch(/^Se borrará la cuenta que hay/);
    expect(strings.backup.replaceWarning(3)).toMatch(/^Se borrarán las 3 cuentas que hay/);
  });

  it('pluralizes counts', () => {
    expect(countOf(1, 'cuenta', 'cuentas')).toBe('1 cuenta');
    expect(countOf(0, 'cuenta', 'cuentas')).toBe('0 cuentas');
    expect(strings.backup.previewSummary(2, 1, '16 oct 2026')).toBe(
      '2 cuentas y 1 movimiento, creado el 16 oct 2026.',
    );
  });
});
