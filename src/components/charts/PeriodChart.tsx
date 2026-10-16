import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
} from 'recharts';
import { formatPercent, formatSignedMoney } from '../../domain/money';
import type { Currency, Period } from '../../domain/types';
import { formatDuration, formatShortDate, strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { ChartCard } from './ChartCard';
import {
  AXIS_TICK,
  CHART_MARGIN,
  moneyTickFormatter,
  niceTicks,
  percentTickFormatter,
  yAxisScale,
} from './chartFormat';
import { TooltipBox } from './ChartTooltip';

type Mode = 'amount' | 'rate';

interface Row {
  key: string;
  label: string;
  period: Period;
  value: number | null;
}

const GAIN = 'var(--series-gain)';
const LOSS = 'var(--series-loss)';
const RADIUS = 4;

/** Bar with a 4px rounded data-end and a square baseline end, colored by sign (diverging). */
function RoundedBar({ x, y, width, height, value, isActive }: BarShapeProps) {
  const amount = Array.isArray(value) ? value[1] - value[0] : value;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  if (h === 0 || width <= 0) return null;

  const r = Math.min(RADIUS, h, width / 2);
  const right = x + width;
  const bottom = top + h;
  const d =
    amount >= 0
      ? `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${right - r} Q${right},${top} ${right},${top + r} V${bottom} Z`
      : `M${x},${top} H${right} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${x + r} Q${x},${bottom} ${x},${bottom - r} Z`;

  return <path d={d} fill={amount >= 0 ? GAIN : LOSS} fillOpacity={isActive ? 0.8 : 1} />;
}

function PeriodTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  const { period } = row;
  const color = period.gain >= 0 ? GAIN : LOSS;
  return (
    <TooltipBox
      title={strings.charts.periodLabel(
        formatShortDate(period.startDate),
        formatShortDate(period.endDate),
        formatDuration(period.days),
      )}
      rows={[
        {
          label: strings.charts.gain,
          value: formatSignedMoney(period.gain, currency),
          color,
          kind: 'block',
        },
        {
          label: strings.charts.periodRate,
          value: formatPercent(period.returnRate),
          color: 'transparent',
        },
      ]}
    />
  );
}

interface PeriodChartProps {
  periods: Period[];
  currency: Currency;
  mode: Mode;
}

/** Gain (or return) of each period as columns above/below zero. Its table twin is the breakdown list. */
export function PeriodChart({ periods, currency, mode }: PeriodChartProps) {
  const data: Row[] = periods.map((period) => ({
    key: period.endEventId,
    label: formatShortDate(period.endDate),
    period,
    value: mode === 'amount' ? period.gain : period.returnRate,
  }));
  const values = data.flatMap((row) => (row.value === null ? [] : [row.value]));
  const ticks =
    values.length === 0
      ? []
      : niceTicks(values, { includeZero: true, minStep: mode === 'amount' ? 1 : 0 });
  const format = mode === 'amount' ? moneyTickFormatter(ticks) : percentTickFormatter(ticks);

  return (
    <ChartCard
      title={mode === 'amount' ? strings.charts.periodGainTitle : strings.charts.periodRateTitle}
      subtitle={strings.charts.periodsTableNote}
    >
      {values.length === 0 ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              stroke="var(--chart-axis)"
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              {...yAxisScale(ticks, format)}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Tooltip
              cursor={{ fill: 'var(--chart-hover)' }}
              content={(props) => <PeriodTooltip {...props} currency={currency} />}
            />
            <Bar
              dataKey="value"
              maxBarSize={24}
              shape={RoundedBar}
              activeBar={RoundedBar}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
