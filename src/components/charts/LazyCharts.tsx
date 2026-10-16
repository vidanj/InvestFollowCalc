import { lazy, Suspense, type ComponentProps } from 'react';

// Recharts is most of the bundle: charts load in their own chunk so stats and lists render first.
const BalanceChartImpl = lazy(() =>
  import('./BalanceChart').then((m) => ({ default: m.BalanceChart })),
);
const GainChartImpl = lazy(() => import('./GainChart').then((m) => ({ default: m.GainChart })));
const PeriodChartImpl = lazy(() =>
  import('./PeriodChart').then((m) => ({ default: m.PeriodChart })),
);

/** Same footprint as a chart card, so nothing jumps when the chart arrives. */
function ChartPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="h-[22rem] rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    />
  );
}

export function BalanceChart(props: ComponentProps<typeof BalanceChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <BalanceChartImpl {...props} />
    </Suspense>
  );
}

export function GainChart(props: ComponentProps<typeof GainChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <GainChartImpl {...props} />
    </Suspense>
  );
}

export function PeriodChart(props: ComponentProps<typeof PeriodChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <PeriodChartImpl {...props} />
    </Suspense>
  );
}
