import type { Cents, IsoDate } from '../../domain/types';
import { strings } from '../../i18n/es-MX';

const LOCALE = 'es-MX';
const axisDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const axisMonth = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Time-axis tick for multi-year spans: "dic 2026" (a 2-digit year reads like a day). */
export function formatAxisMonth(timestamp: number): string {
  return axisMonth.format(new Date(timestamp));
}

/** Calendar date as a UTC timestamp, for time axes. */
export function toTimestamp(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Time-axis tick: "1 oct". */
export function formatAxisDate(timestamp: number): string {
  return axisDate.format(new Date(timestamp));
}

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  // Nearest of 1, 2, 5, 10 on a log scale.
  const nice = residual >= 7.07 ? 10 : residual >= 3.16 ? 5 : residual >= 1.41 ? 2 : 1;
  return nice * magnitude;
}

/**
 * About `count` evenly spaced round ticks covering `values` (and zero when asked). Steps are never
 * smaller than `minStep` (1 cent for money).
 */
export function niceTicks(
  values: readonly number[],
  { includeZero = false, minStep = 0, count = 5 } = {},
): number[] {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || Math.max(minStep, 1);
    min -= pad;
    max += pad;
  }
  const step = Math.max(niceStep((max - min) / (count - 1)), minStep);
  const start = Math.floor(min / step) * step;
  const steps = Math.ceil((max - start) / step - 1e-9);
  return Array.from({ length: steps + 1 }, (_, i) => Number((start + i * step).toPrecision(12)));
}

/** Fewest decimals (up to `max`) that show every value exactly; `null` if more are needed. */
function exactDecimals(values: readonly number[], max: number): number | null {
  for (let d = 0; d <= max; d++) {
    const f = 10 ** d;
    if (values.every((v) => Math.abs(Math.round(v * f) - v * f) < 1e-6)) return d;
  }
  return null;
}

// Each scale applies to a magnitude range: "1.5 M", "12.5 k", "1,505".
const SCALES = [
  { divisor: 1e6, from: 1e6, to: Infinity, suffix: () => strings.charts.millionsSuffix },
  { divisor: 1e3, from: 1e4, to: 1e6, suffix: () => strings.charts.thousandsSuffix },
  { divisor: 1, from: 0, to: Infinity, suffix: () => '' },
];

/**
 * Money-axis labels for these ticks (in cents): compact ("10.5 k", "1.2 M") only when that keeps
 * every tick distinct and exact; otherwise full amounts ("1,505"). The card names the currency.
 */
export function moneyTickFormatter(ticks: readonly Cents[]): (cents: Cents) => string {
  const units = ticks.map((c) => c / 100);
  const maxAbs = Math.max(...units.map(Math.abs));
  for (const { divisor, from, to, suffix } of SCALES) {
    if (maxAbs < from || maxAbs >= to) continue;
    const decimals = exactDecimals(
      units.map((u) => u / divisor),
      divisor === 1 ? 2 : 1,
    );
    if (decimals === null) continue;
    const format = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (cents) => `${format.format(cents / 100 / divisor)}${suffix()}`;
  }
  const fallback = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
  return (cents) => fallback.format(cents / 100);
}

/** Percent-axis labels for these ticks (ratios): "0.4%", "1.25%". */
export function percentTickFormatter(ticks: readonly number[]): (rate: number) => string {
  const decimals = exactDecimals(
    ticks.map((t) => t * 100),
    2,
  );
  const format = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals ?? 2,
    maximumFractionDigits: decimals ?? 2,
  });
  return (rate) => `${format.format(rate * 100)}%`;
}

// Shared Recharts chrome: hairline grid and axes one step off the surface, muted tick ink.
export const AXIS_TICK = { fill: 'var(--chart-ink-muted)', fontSize: 12 } as const;
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;
export const ACTIVE_DOT = { r: 4, stroke: 'var(--chart-surface)', strokeWidth: 2 } as const;
export const CROSSHAIR = { stroke: 'var(--chart-axis)', strokeWidth: 1 } as const;

/** Y-axis props for precomputed ticks; the width fits the longest label so nothing is clipped. */
export function yAxisScale(ticks: readonly number[], format: (value: number) => string) {
  const longest = Math.max(...ticks.map((t) => format(t).length));
  return {
    ticks: [...ticks],
    domain: [ticks[0] ?? 0, ticks[ticks.length - 1] ?? 0] as [number, number],
    tickFormatter: format,
    interval: 0 as const,
    width: Math.max(40, longest * 7 + 12),
  };
}
