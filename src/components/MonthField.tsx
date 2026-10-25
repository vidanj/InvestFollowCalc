import type { YearMonth } from '../domain/months';
import { MONTH_NAMES, strings } from '../i18n/es-MX';
import { FIELD_CLASS } from './fieldStyles';

const YEARS_AROUND = 10;

interface MonthFieldProps {
  legend: string;
  value: YearMonth;
  onChange: (value: YearMonth) => void;
  /** The current year; the year list spans ten years around it (and `value`). */
  currentYear: number;
  error?: string | undefined;
}

/**
 * Month + year as two native selects: works on every browser, unlike `<input type="month">`
 * (missing in Firefox and desktop Safari).
 */
export function MonthField({ legend, value, onChange, currentYear, error }: MonthFieldProps) {
  const [year = currentYear, month = 1] = value.split('-').map(Number);
  const from = Math.min(currentYear - YEARS_AROUND, year);
  const to = Math.max(currentYear + YEARS_AROUND, year);
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const emit = (nextYear: number, nextMonth: number) => {
    onChange(`${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`);
  };
  const border = error ? 'border-red-600' : 'border-slate-300 dark:border-slate-700';

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <select
          aria-label={`${legend}: ${strings.budgetItem.month}`}
          value={month}
          onChange={(e) => {
            emit(year, Number(e.target.value));
          }}
          className={`${FIELD_CLASS} ${border}`}
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label={`${legend}: ${strings.budgetItem.year}`}
          value={year}
          onChange={(e) => {
            emit(Number(e.target.value), month);
          }}
          className={`${FIELD_CLASS} ${border}`}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
