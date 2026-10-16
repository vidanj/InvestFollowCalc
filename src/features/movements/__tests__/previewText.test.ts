import { describe, expect, it } from 'vitest';
import { balance, deposit, withdrawal } from '../../../domain/__tests__/builders';
import { previewEvent } from '../../../domain/preview';
import type { AccountEvent } from '../../../domain/types';
import { describePreview } from '../previewText';

function linesFor(events: AccountEvent[], candidate: AccountEvent): string[] {
  const preview = previewEvent(events, candidate);
  if (!preview.ok) throw new Error('expected a valid preview');
  return describePreview(preview, candidate, 'MXN');
}

describe('describePreview', () => {
  const start = () => [balance('2026-10-01', 10_000)];

  it('tells how much a balance update generated and in how long', () => {
    expect(linesFor(start(), balance('2026-10-12', 10_001))).toEqual([
      'Generaste $1.00 en 11 días (1.6 semanas).',
      'Rendimiento del periodo: +0.01%',
      'Ganancia total: +$1.00.',
    ]);
  });

  it('reports losses and unchanged balances', () => {
    expect(linesFor(start(), balance('2026-10-11', 9_950))[0]).toBe(
      'Perdiste $50.00 en 10 días (1.4 semanas).',
    );
    expect(linesFor(start(), balance('2026-10-04', 10_000))).toEqual([
      'Sin cambios en 3 días.',
      'Ganancia total: $0.00.',
    ]);
  });

  it('explains that pending deposits and withdrawals were not counted as gain', () => {
    const withDeposit = [...start(), deposit('2026-10-05', 500)];
    expect(linesFor(withDeposit, balance('2026-10-12', 10_510))).toContain(
      'Ya se descontaron $500.00 de aportaciones.',
    );
    const withWithdrawal = [...start(), withdrawal('2026-10-05', 500)];
    expect(linesFor(withWithdrawal, balance('2026-10-12', 9_510))).toContain(
      'Ya se sumaron $500.00 de retiros.',
    );
  });

  it('describes deposits with and without the balance after', () => {
    const history = [...start(), balance('2026-10-12', 10_001)];
    expect(linesFor(history, deposit('2026-10-15', 500, 10_503))).toEqual([
      'Antes de este movimiento: generaste $2.00 en 3 días.',
      'Rendimiento del periodo: +0.02%',
      'Capital aportado: $10,500.00.',
      'Ganancia total: +$3.00.',
    ]);
    expect(linesFor(history, deposit('2026-10-15', 500))).toEqual([
      'La ganancia se calculará en tu próxima actualización de saldo.',
      'Capital aportado: $10,500.00.',
      'Ganancia total: +$1.00.',
    ]);
  });
});
