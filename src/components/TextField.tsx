import { useId, type InputHTMLAttributes } from 'react';
import { strings } from '../i18n/es-MX';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: string;
  error?: string | undefined;
  optional?: boolean;
};

export function TextField({ label, help, error, optional = false, ...input }: TextFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && (
          <span className="ml-1 font-normal text-slate-500">({strings.common.optional})</span>
        )}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          'rounded-lg border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 ' +
          'focus:ring-teal-600 dark:bg-slate-900 ' +
          (error ? 'border-red-600' : 'border-slate-300 dark:border-slate-700')
        }
        {...input}
      />
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
