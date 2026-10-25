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
import type { CategoryTotal } from '../../domain/budget';
import { formatMoney } from '../../domain/money';
import type { Cents, Currency } from '../../domain/types';
import { formatWholePercent, strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { ChartCard } from './ChartCard';
import { AXIS_TICK, moneyTickFormatter, niceTicks } from './chartFormat';
import { TooltipBox } from './ChartTooltip';

const EXPENSE = 'var(--series-expense)';
const ROW_HEIGHT = 36;
const AXIS_HEIGHT = 28;
const t = strings.budget;

interface Row extends CategoryTotal {
  label: string;
  share: number;
}

function CategoryTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: Currency }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={row.label}
      rows={[
        {
          label: formatWholePercent(row.share),
          value: formatMoney(row.amount, currency),
          color: EXPENSE,
          kind: 'block',
        },
      ]}
    />
  );
}

function CategoryTable({ rows, currency }: { rows: Row[]; currency: Currency }) {
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="text-slate-600 dark:text-slate-400">
        <tr>
          <th className="py-1 font-medium">{t.category}</th>
          <th className="py-1 text-right font-medium">{t.amount}</th>
          <th className="py-1 text-right font-medium">{t.categoryShare}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.category} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1">{row.label}</td>
            <td className="py-1 text-right">{formatMoney(row.amount, currency)}</td>
            <td className="py-1 text-right">{formatWholePercent(row.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface CategoryChartProps {
  categories: CategoryTotal[];
  total: Cents;
  currency: Currency;
}

/** The month's spending by category, largest first: one series, one color, horizontal bars. */
export function CategoryChart({ categories, total, currency }: CategoryChartProps) {
  const rows: Row[] = categories.map((c) => ({
    ...c,
    label: t.categoryShort[c.category],
    share: total > 0 ? c.amount / total : 0,
  }));
  const ticks =
    rows.length === 0
      ? []
      : niceTicks(
          rows.map((r) => r.amount),
          { includeZero: true, minStep: 1 },
        );
  const format = moneyTickFormatter(ticks);
  const labelWidth = Math.max(...rows.map((r) => r.label.length), 4) * 7 + 12;

  return (
    <ChartCard
      title={t.categoryTitle}
      subtitle={t.categorySubtitle}
      table={<CategoryTable rows={rows} currency={currency} />}
      plotHeight={Math.max(rows.length, 2) * ROW_HEIGHT + AXIS_HEIGHT}
    >
      {rows.length === 0 ? (
        <NotEnoughData />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
            <XAxis
              type="number"
              ticks={ticks}
              domain={[ticks[0] ?? 0, ticks.at(-1) ?? 0]}
              tickFormatter={format}
              tick={AXIS_TICK}
              stroke="var(--chart-axis)"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={labelWidth}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-hover)' }}
              content={(props) => <CategoryTooltip {...props} currency={currency} />}
            />
            <Bar
              dataKey="amount"
              name={t.amount}
              fill={EXPENSE}
              maxBarSize={24}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
