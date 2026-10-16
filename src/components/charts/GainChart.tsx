import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatSignedMoney } from '../../domain/money';
import type { SeriesPoint } from '../../domain/series';
import type { Currency } from '../../domain/types';
import { formatDate, strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { ChartCard } from './ChartCard';
import {
  ACTIVE_DOT,
  AXIS_TICK,
  CHART_MARGIN,
  CROSSHAIR,
  formatAxisDate,
  moneyTickFormatter,
  niceTicks,
  toTimestamp,
  yAxisScale,
} from './chartFormat';
import { TooltipBox } from './ChartTooltip';

interface Row extends SeriesPoint {
  t: number;
}

const GAIN = 'var(--series-gain)';

function GainTooltip({ active, payload, currency }: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={`${formatDate(row.date)}${row.estimated ? ` ${strings.charts.estimated}` : ''}`}
      rows={[
        { label: strings.charts.gain, value: formatSignedMoney(row.gain, currency), color: GAIN },
      ]}
    />
  );
}

/** Single series (no legend box): generated money over time against a zero baseline. */
export function GainChart({ points, currency }: { points: SeriesPoint[]; currency: Currency }) {
  const data: Row[] = points.map((p) => ({ ...p, t: toTimestamp(p.date) }));
  const ticks =
    data.length < 2
      ? []
      : niceTicks(
          data.map((p) => p.gain),
          { includeZero: true, minStep: 1 },
        );

  return (
    <ChartCard title={strings.charts.gainTitle} subtitle={strings.charts.gainSubtitle}>
      {data.length < 2 ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatAxisDate}
              tick={AXIS_TICK}
              stroke="var(--chart-axis)"
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              {...yAxisScale(ticks, moneyTickFormatter(ticks))}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Tooltip
              cursor={CROSSHAIR}
              content={(props) => <GainTooltip {...props} currency={currency} />}
            />
            <Area
              type="linear"
              dataKey="gain"
              name={strings.charts.gain}
              baseValue={0}
              stroke={GAIN}
              strokeWidth={2}
              fill={GAIN}
              fillOpacity={0.1}
              activeDot={ACTIVE_DOT}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
