import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { MonthTotals } from '../../domain/budget';
import { formatMoney, formatSignedMoney } from '../../domain/money';
import type { YearMonth } from '../../domain/months';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { ChartCard } from './ChartCard';
import { AXIS_TICK, CHART_MARGIN, moneyTickFormatter, niceTicks, yAxisScale } from './chartFormat';
import { TooltipBox } from './ChartTooltip';
import { monthTitle, toMonthRows, type MonthRow as Row } from './monthRows';

const INCOME = 'var(--series-income)';
const EXPENSE = 'var(--series-expense)';
const t = strings.budget;

function CashflowTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={monthTitle(row)}
      rows={[
        { label: t.income, value: formatMoney(row.income, currency), color: INCOME, kind: 'block' },
        {
          label: t.expenses,
          value: formatMoney(row.expenses, currency),
          color: EXPENSE,
          kind: 'block',
        },
        { label: t.left, value: formatSignedMoney(row.left, currency), color: 'transparent' },
      ]}
    />
  );
}

/** Table twin of both monthly charts. */
export function MonthTotalsTable({ rows, currency }: { rows: Row[]; currency: Currency }) {
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="text-slate-600 dark:text-slate-400">
        <tr>
          <th className="py-1 font-medium">{t.month}</th>
          <th className="py-1 text-right font-medium">{t.income}</th>
          <th className="py-1 text-right font-medium">{t.expenses}</th>
          <th className="py-1 text-right font-medium">{t.left}</th>
        </tr>
      </thead>
      <tbody>
        {[...rows].reverse().map((row) => (
          <tr key={row.month} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1">{monthTitle(row)}</td>
            <td className="py-1 text-right">{formatMoney(row.income, currency)}</td>
            <td className="py-1 text-right">{formatMoney(row.expenses, currency)}</td>
            <td className="py-1 text-right">{formatSignedMoney(row.left, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface CashflowChartProps {
  totals: MonthTotals[];
  currency: Currency;
  currentMonth: YearMonth;
}

/** Income next to expenses, month by month (grouped columns, one money axis). */
export function CashflowChart({ totals, currency, currentMonth }: CashflowChartProps) {
  const rows = toMonthRows(totals, currentMonth);
  const values = rows.flatMap((r) => [r.income, r.expenses]);
  const hasData = values.some((v) => v > 0);
  const ticks = hasData ? niceTicks(values, { includeZero: true, minStep: 1 }) : [];

  return (
    <ChartCard
      title={t.cashflowTitle}
      subtitle={t.cashflowSubtitle}
      legend={[
        { label: t.income, color: INCOME, kind: 'block' },
        { label: t.expenses, color: EXPENSE, kind: 'block' },
      ]}
      table={<MonthTotalsTable rows={rows} currency={currency} />}
    >
      {!hasData ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={CHART_MARGIN} barGap={2} barCategoryGap="20%">
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
            <Tooltip
              cursor={{ fill: 'var(--chart-hover)' }}
              content={(props) => <CashflowTooltip {...props} currency={currency} />}
            />
            <Bar
              dataKey="income"
              name={t.income}
              fill={INCOME}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenses"
              name={t.expenses}
              fill={EXPENSE}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
