import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  formatAxisDate,
  moneyTickFormatter,
  niceTicks,
  percentTickFormatter,
  toTimestamp,
  yAxisScale,
} from '../chartFormat';
import { Sparkline } from '../Sparkline';

describe('Sparkline', () => {
  it('draws the trend with an end dot, hidden from assistive tech', () => {
    const { container } = render(<Sparkline values={[1, 3, 2]} color="var(--account-1)" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(3);
    expect(container.querySelector('circle')).toHaveAttribute('r', '4');
  });

  it('draws nothing without a trend', () => {
    expect(render(<Sparkline values={[5]} color="red" />).container).toBeEmptyDOMElement();
  });

  it('handles a flat trend', () => {
    const { container } = render(<Sparkline values={[2, 2]} color="red" />);
    expect(container.querySelector('polyline')).not.toBeNull();
  });
});

describe('niceTicks', () => {
  it('covers the data with round, evenly spaced steps', () => {
    expect(niceTicks([1_000_000, 1_240_000])).toEqual([
      1_000_000, 1_050_000, 1_100_000, 1_150_000, 1_200_000, 1_250_000,
    ]);
    expect(niceTicks([-4_000, 13_000], { includeZero: true })).toEqual([
      -5_000, 0, 5_000, 10_000, 15_000,
    ]);
  });

  it('includes zero when asked and pads a flat series', () => {
    expect(niceTicks([300, 900], { includeZero: true })).toEqual([0, 200, 400, 600, 800, 1_000]);
    expect(niceTicks([150_000, 150_000])).toEqual([148_000, 149_000, 150_000, 151_000, 152_000]);
    expect(niceTicks([0, 0], { includeZero: true, minStep: 1 })).toEqual([-1, 0, 1]);
  });

  it('never steps below the minimum (1 cent for money)', () => {
    const ticks = niceTicks([100, 101], { minStep: 1 });
    expect(ticks.every((t) => Number.isInteger(t))).toBe(true);
  });
});

describe('axis labels', () => {
  it('keeps every money tick distinct (no repeated "1.5 k")', () => {
    const ticks = niceTicks([150_000, 152_000], { minStep: 1 });
    const labels = ticks.map(moneyTickFormatter(ticks));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('1,505');
  });

  it('uses compact thousands and millions when they stay exact', () => {
    const thousands = [1_000_000, 1_050_000, 1_100_000];
    expect(thousands.map(moneyTickFormatter(thousands))).toEqual(['10.0 k', '10.5 k', '11.0 k']);
    const millions = [0, 1_000_000_000, 2_000_000_000];
    expect(millions.map(moneyTickFormatter(millions))).toEqual(['0 M', '10 M', '20 M']);
    const awkward = [100_000_000, 100_050_000];
    expect(awkward.map(moneyTickFormatter(awkward))).toEqual(['1,000,000', '1,000,500']);
  });

  it('formats percent ticks with just enough decimals', () => {
    const ticks = [-0.004, 0, 0.004, 0.008];
    // Same decimals on every tick of an axis.
    expect(ticks.map(percentTickFormatter(ticks))).toEqual(['-0.4%', '0.0%', '0.4%', '0.8%']);
    expect(percentTickFormatter([0.00123])(0.00123)).toBe('0.12%');
  });

  it('sizes the axis to its longest label', () => {
    const scale = yAxisScale([0, 1_000_000], (v) => String(v));
    expect(scale.domain).toEqual([0, 1_000_000]);
    expect(scale.width).toBeGreaterThan(40);
  });

  it('formats dates on time axes', () => {
    expect(toTimestamp('2026-10-01')).toBe(Date.UTC(2026, 9, 1));
    expect(formatAxisDate(Date.UTC(2026, 9, 1))).toMatch(/^1 oct\.?$/);
  });
});
