export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Accessible name when the visible label is abbreviated (e.g. "1M" → "1 mes"). */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Keep the legend for assistive tech only, when a visible heading already names the group. */
  hideLegend?: boolean;
}

/** A radio group shown as connected segments. */
export function SegmentedControl<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hideLegend = false,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={hideLegend ? 'sr-only' : 'mb-1 text-sm font-medium'}>{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col rounded-lg border border-slate-300 p-1 dark:border-slate-700">
        {options.map((option) => (
          <label
            key={option.value}
            className={
              'cursor-pointer rounded-md px-2 py-2 text-center text-sm font-medium ' +
              'has-focus-visible:outline-2 has-focus-visible:outline-teal-600 ' +
              (option.value === value
                ? 'bg-teal-700 text-white'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              aria-label={option.ariaLabel}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
