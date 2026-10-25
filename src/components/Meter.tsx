interface MeterProps {
  /** Accessible name of the meter. */
  label: string;
  /** From 0 to 1; values above 1 fill the track. */
  ratio: number;
  /** Visible text with the value, so nothing depends on the bar alone. */
  valueText: string;
}

/** A single ratio against a limit: accent fill on a lighter step of the same ramp. */
export function Meter({ label, ratio, valueText }: MeterProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={valueText}
        className="h-2.5 w-full overflow-hidden rounded-full bg-(--meter-track)"
      >
        <div
          className="h-full rounded-full bg-(--meter-fill)"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">{valueText}</p>
    </div>
  );
}
