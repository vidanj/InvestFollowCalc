import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { ProjectionPoint } from '../../domain/investPlan';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { ChartCard } from './ChartCard';
import {
  ACTIVE_DOT,
  AXIS_TICK,
  CHART_MARGIN,
  CROSSHAIR,
  moneyTickFormatter,
  niceTicks,
  yAxisScale,
} from './chartFormat';
import { TooltipBox } from './ChartTooltip';

const VALUE = 'var(--series-balance)';
const CONTRIBUTED = 'var(--series-capital)';
const t = strings.invest;

function ProjectionTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const point = payload[0]?.payload as ProjectionPoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipBox
      title={t.chartMonth(point.month)}
      rows={[
        { label: t.chartValue, value: formatMoney(point.value, currency), color: VALUE },
        {
          label: t.chartContributed,
          value: formatMoney(point.contributed, currency),
          color: CONTRIBUTED,
        },
        {
          label: t.generated,
          value: formatSignedMoney(point.generated, currency),
          color: 'transparent',
        },
      ]}
    />
  );
}

function YearsTable({ points, currency }: { points: ProjectionPoint[]; currency: Currency }) {
  const yearly = points.filter((p) => p.month > 0 && p.month % 12 === 0);
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="text-slate-600 dark:text-slate-400">
        <tr>
          <th className="py-1 font-medium">{t.horizon}</th>
          <th className="py-1 text-right font-medium">{t.contributed}</th>
          <th className="py-1 text-right font-medium">{t.value}</th>
          <th className="py-1 text-right font-medium">{t.generated}</th>
        </tr>
      </thead>
      <tbody>
        {yearly.map((p) => (
          <tr key={p.month} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1">{t.years(p.month / 12)}</td>
            <td className="py-1 text-right">{formatMoney(p.contributed, currency)}</td>
            <td className="py-1 text-right">{formatMoney(p.value, currency)}</td>
            <td className="py-1 text-right">{formatSignedMoney(p.generated, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Estimated value (accent line + wash) against what would be contributed (gray), one axis. */
export function ProjectionChart({
  points,
  currency,
}: {
  points: ProjectionPoint[];
  currency: Currency;
}) {
  const months = points.at(-1)?.month ?? 0;
  const ticks = niceTicks(
    points.flatMap((p) => [p.value, p.contributed]),
    { includeZero: true, minStep: 1 },
  );
  const yearStep = months > 60 ? 24 : 12;
  const xTicks = Array.from({ length: Math.floor(months / yearStep) + 1 }, (_, i) => i * yearStep);

  return (
    <ChartCard
      title={t.chartTitle}
      subtitle={t.chartSubtitle}
      legend={[
        { label: t.chartValue, color: VALUE, kind: 'line' },
        { label: t.chartContributed, color: CONTRIBUTED, kind: 'line' },
      ]}
      table={<YearsTable points={points} currency={currency} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="month"
            type="number"
            domain={[0, months]}
            ticks={xTicks}
            tickFormatter={t.axisYear}
            tick={AXIS_TICK}
            stroke="var(--chart-axis)"
            tickLine={false}
          />
          <YAxis
            {...yAxisScale(ticks, moneyTickFormatter(ticks))}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={CROSSHAIR}
            content={(props) => <ProjectionTooltip {...props} currency={currency} />}
          />
          <Area
            type="linear"
            dataKey="value"
            name={t.chartValue}
            stroke={VALUE}
            strokeWidth={2}
            fill={VALUE}
            fillOpacity={0.1}
            activeDot={ACTIVE_DOT}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="contributed"
            name={t.chartContributed}
            stroke={CONTRIBUTED}
            strokeWidth={2}
            dot={false}
            activeDot={ACTIVE_DOT}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
