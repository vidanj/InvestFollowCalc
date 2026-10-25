import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { MonthTotals } from '../../domain/budget';
import { formatSignedMoney } from '../../domain/money';
import type { YearMonth } from '../../domain/months';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { MonthTotalsTable } from './CashflowChart';
import { ChartCard } from './ChartCard';
import { AXIS_TICK, CHART_MARGIN, moneyTickFormatter, niceTicks, yAxisScale } from './chartFormat';
import { TooltipBox } from './ChartTooltip';
import { monthTitle, toMonthRows, type MonthRow } from './monthRows';
import { RoundedBar } from './RoundedBar';

const t = strings.budget;

function LeftoverTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as MonthRow | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={monthTitle(row)}
      rows={[
        {
          label: t.left,
          value: formatSignedMoney(row.left, currency),
          color: row.left >= 0 ? 'var(--series-gain)' : 'var(--series-loss)',
          kind: 'block',
        },
      ]}
    />
  );
}

interface LeftoverChartProps {
  totals: MonthTotals[];
  currency: Currency;
  currentMonth: YearMonth;
}

/** What was left each month, above or below zero (diverging columns, single series). */
export function LeftoverChart({ totals, currency, currentMonth }: LeftoverChartProps) {
  const rows = toMonthRows(totals, currentMonth);
  const hasData = rows.some((r) => r.income > 0 || r.expenses > 0);
  const ticks = hasData
    ? niceTicks(
        rows.map((r) => r.left),
        { includeZero: true, minStep: 1 },
      )
    : [];

  return (
    <ChartCard
      title={t.leftTitle}
      subtitle={t.leftSubtitle}
      table={<MonthTotalsTable rows={rows} currency={currency} />}
    >
      {!hasData ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={CHART_MARGIN} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              stroke="var(--chart-axis)"
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              {...yAxisScale(ticks, moneyTickFormatter(ticks))}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Tooltip
              cursor={{ fill: 'var(--chart-hover)' }}
              content={(props) => <LeftoverTooltip {...props} currency={currency} />}
            />
            <Bar
              dataKey="left"
              name={t.left}
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
