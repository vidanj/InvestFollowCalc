import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meter } from '../../Meter';
import { MonthTotalsTable } from '../CashflowChart';
import { formatAxisMonth } from '../chartFormat';
import { CostSplit } from '../CostSplit';
import { monthTitle, toMonthRows } from '../monthRows';

describe('budget chart helpers', () => {
  it('labels long time axes with month and full year', () => {
    expect(formatAxisMonth(Date.UTC(2030, 1, 15))).toMatch(/^feb\.? 2030$/);
  });

  it('marks months after the current one as projections', () => {
    const rows = toMonthRows(
      [
        { month: '2026-10', income: 1, expenses: 0, left: 1 },
        { month: '2026-11', income: 1, expenses: 0, left: 1 },
      ],
      '2026-10',
    );
    expect(rows.map((r) => [r.label, r.projected])).toEqual([
      ['oct 26', false],
      ['nov 26', true],
    ]);
    expect(monthTitle(rows[1]!)).toBe('noviembre de 2026 (proyección)');
  });

  it('gives the monthly charts a table view, newest first', () => {
    const rows = toMonthRows(
      [
        { month: '2026-09', income: 3_000_000, expenses: 3_100_000, left: -100_000 },
        { month: '2026-10', income: 3_000_000, expenses: 1_000_000, left: 2_000_000 },
      ],
      '2026-10',
    );
    render(<MonthTotalsTable rows={rows} currency="MXN" />);
    const [, newest, oldest] = screen.getAllByRole('row');
    expect(within(newest!).getByText('+$20,000.00')).toBeVisible();
    expect(within(oldest!).getByText('-$1,000.00')).toBeVisible();
  });
});

describe('CostSplit', () => {
  it('lists every part with its amount and share, leaving out empty parts', () => {
    render(
      <CostSplit
        title="¿A dónde se va?"
        subtitle="Todo"
        currency="MXN"
        parts={[
          { label: 'Capital', amount: 7_500, color: 'var(--series-principal)' },
          { label: 'Intereses', amount: 2_500, color: 'var(--series-interest)' },
          { label: 'IVA', amount: 0, color: 'var(--series-tax)' },
        ]}
      />,
    );
    expect(screen.getByText('Capital').closest('div')).toHaveTextContent('$75.00 (75%)');
    expect(screen.getByText('Intereses').closest('div')).toHaveTextContent('$25.00 (25%)');
    expect(screen.queryByText('IVA')).toBeNull();
  });

  it('renders nothing without amounts', () => {
    const { container } = render(
      <CostSplit
        title="t"
        subtitle="s"
        currency="MXN"
        parts={[{ label: 'a', amount: 0, color: 'x' }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Meter', () => {
  it('exposes the ratio to assistive tech and caps the fill at 100%', () => {
    render(<Meter label="Gastado" ratio={1.4} valueText="Gastas el 140%" />);
    const meter = screen.getByRole('meter', { name: 'Gastado' });
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('aria-valuetext', 'Gastas el 140%');
    expect(meter.firstElementChild).toHaveStyle({ width: '100%' });
    expect(screen.getByText('Gastas el 140%')).toBeVisible();
  });
});
