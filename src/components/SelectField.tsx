import { useId, type SelectHTMLAttributes } from 'react';
import { FIELD_CLASS } from './fieldStyles';

type SelectFieldProps<T extends string> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> & {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  help?: string;
  error?: string | undefined;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
  error,
  ...select
}: SelectFieldProps<T>) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => {
          onChange(e.target.value as T);
        }}
        className={`${FIELD_CLASS} ${error ? 'border-red-600' : 'border-slate-300 dark:border-slate-700'}`}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && (
        <p id={helpId} className="text-xs text-slate-600 dark:text-slate-400">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
