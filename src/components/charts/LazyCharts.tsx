import { lazy, Suspense, type ComponentProps } from 'react';

// Recharts is most of the bundle: charts load in their own chunk so stats and lists render first.
const BalanceChartImpl = lazy(() =>
  import('./BalanceChart').then((m) => ({ default: m.BalanceChart })),
);
const GainChartImpl = lazy(() => import('./GainChart').then((m) => ({ default: m.GainChart })));
const PeriodChartImpl = lazy(() =>
  import('./PeriodChart').then((m) => ({ default: m.PeriodChart })),
);
const CashflowChartImpl = lazy(() =>
  import('./CashflowChart').then((m) => ({ default: m.CashflowChart })),
);
const LeftoverChartImpl = lazy(() =>
  import('./LeftoverChart').then((m) => ({ default: m.LeftoverChart })),
);
const CategoryChartImpl = lazy(() =>
  import('./CategoryChart').then((m) => ({ default: m.CategoryChart })),
);
const ProjectionChartImpl = lazy(() =>
  import('./ProjectionChart').then((m) => ({ default: m.ProjectionChart })),
);
const CreditBalanceChartImpl = lazy(() =>
  import('./CreditBalanceChart').then((m) => ({ default: m.CreditBalanceChart })),
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

export function CashflowChart(props: ComponentProps<typeof CashflowChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <CashflowChartImpl {...props} />
    </Suspense>
  );
}

export function LeftoverChart(props: ComponentProps<typeof LeftoverChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <LeftoverChartImpl {...props} />
    </Suspense>
  );
}

export function CategoryChart(props: ComponentProps<typeof CategoryChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <CategoryChartImpl {...props} />
    </Suspense>
  );
}

export function CreditBalanceChart(props: ComponentProps<typeof CreditBalanceChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <CreditBalanceChartImpl {...props} />
    </Suspense>
  );
}

export function ProjectionChart(props: ComponentProps<typeof ProjectionChartImpl>) {
  return (
    <Suspense fallback={<ChartPlaceholder />}>
      <ProjectionChartImpl {...props} />
    </Suspense>
  );
}
