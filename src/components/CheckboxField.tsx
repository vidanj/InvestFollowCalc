import { useId } from 'react';

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}

export function CheckboxField({ label, checked, onChange, help }: CheckboxFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={help ? helpId : undefined}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700"
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {help && (
          <p id={helpId} className="text-xs text-slate-600 dark:text-slate-400">
            {help}
          </p>
        )}
      </div>
    </div>
  );
}
