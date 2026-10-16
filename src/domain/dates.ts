import type { IsoDate } from './types';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function parts(date: IsoDate): [number, number, number] | null {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True for a real calendar date written as `YYYY-MM-DD` (rejects e.g. `2026-02-30`). */
export function isIsoDate(value: string): boolean {
  const p = parts(value);
  if (!p) return false;
  const [year, month, day] = p;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function toUtcDayNumber(date: IsoDate): number {
  const p = parts(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  const [year, month, day] = p;
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). DST-safe. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toUtcDayNumber(to) - toUtcDayNumber(from);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  // ISO dates sort lexicographically.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Local calendar date of `date` (defaults to now) as `YYYY-MM-DD`. */
export function toIsoDate(date: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `date` moved by `days` calendar days (negative goes back). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const p = parts(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  const [year, month, day] = p;
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** `date` moved by whole months; the day is clamped to the target month (Mar 31 − 1 → Feb 28). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const p = parts(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  const [year, month, day] = p;
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
