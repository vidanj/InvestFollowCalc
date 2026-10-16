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
import { formatMoney, formatSignedMoney } from '../../domain/money';
import type { SeriesPoint } from '../../domain/series';
import type { Currency } from '../../domain/types';
import { formatDate, strings } from '../../i18n/es-MX';
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

const BALANCE = 'var(--series-balance)';
const CAPITAL = 'var(--series-capital)';

function BalanceTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={`${formatDate(row.date)}${row.estimated ? ` ${strings.charts.estimated}` : ''}`}
      rows={[
        {
          label: strings.charts.balance,
          value: formatMoney(row.balance, currency),
          color: BALANCE,
        },
        {
          label: strings.charts.capital,
          value: formatMoney(row.contributed, currency),
          color: CAPITAL,
        },
        {
          label: strings.charts.gain,
          value: formatSignedMoney(row.gain, currency),
          color: 'transparent',
        },
      ]}
    />
  );
}

export function SeriesTable({ points, currency }: { points: SeriesPoint[]; currency: Currency }) {
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="text-slate-600 dark:text-slate-400">
        <tr>
          <th className="py-1 font-medium">{strings.charts.date}</th>
          <th className="py-1 text-right font-medium">{strings.charts.balance}</th>
          <th className="py-1 text-right font-medium">{strings.charts.capital}</th>
          <th className="py-1 text-right font-medium">{strings.charts.gain}</th>
        </tr>
      </thead>
      <tbody>
        {[...points].reverse().map((p) => (
          <tr key={p.date} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1">
              {formatDate(p.date)}
              {p.estimated && ` ${strings.charts.estimated}`}
            </td>
            <td className="py-1 text-right">{formatMoney(p.balance, currency)}</td>
            <td className="py-1 text-right">{formatMoney(p.contributed, currency)}</td>
            <td className="py-1 text-right">{formatSignedMoney(p.gain, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Balance (accent line + wash) against contributed capital (gray step line), one money axis. */
export function BalanceChart({ points, currency }: { points: SeriesPoint[]; currency: Currency }) {
  const data: Row[] = points.map((p) => ({ ...p, t: toTimestamp(p.date) }));
  const ticks =
    data.length < 2
      ? []
      : niceTicks(
          data.flatMap((p) => [p.balance, p.contributed]),
          { minStep: 1 },
        );

  return (
    <ChartCard
      title={strings.charts.balanceTitle}
      subtitle={strings.charts.balanceSubtitle}
      legend={[
        { label: strings.charts.balance, color: BALANCE, kind: 'line' },
        { label: strings.charts.capital, color: CAPITAL, kind: 'line' },
      ]}
      table={<SeriesTable points={points} currency={currency} />}
    >
      {data.length < 2 ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={CHART_MARGIN}>
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
            <Tooltip
              cursor={CROSSHAIR}
              content={(props) => <BalanceTooltip {...props} currency={currency} />}
            />
            <Area
              type="linear"
              dataKey="balance"
              name={strings.charts.balance}
              stroke={BALANCE}
              strokeWidth={2}
              fill={BALANCE}
              fillOpacity={0.1}
              activeDot={ACTIVE_DOT}
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="contributed"
              name={strings.charts.capital}
              stroke={CAPITAL}
              strokeWidth={2}
              dot={false}
              activeDot={ACTIVE_DOT}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function NotEnoughData() {
  return (
    <p className="flex h-full items-center justify-center text-center text-sm text-slate-600 dark:text-slate-400">
      {strings.charts.notEnoughData}
    </p>
  );
}
