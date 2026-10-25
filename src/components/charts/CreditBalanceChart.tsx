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
import type { CreditPayment } from '../../domain/credit';
import { formatMoney } from '../../domain/money';
import type { Currency, IsoDate } from '../../domain/types';
import { formatDate, strings } from '../../i18n/es-MX';
import { NotEnoughData } from './BalanceChart';
import { ChartCard } from './ChartCard';
import {
  ACTIVE_DOT,
  AXIS_TICK,
  CHART_MARGIN,
  CROSSHAIR,
  formatAxisMonth,
  moneyTickFormatter,
  niceTicks,
  toTimestamp,
  yAxisScale,
} from './chartFormat';
import { TooltipBox } from './ChartTooltip';

const BALANCE = 'var(--series-balance)';
const t = strings.credit;

interface Row {
  t: number;
  payment: CreditPayment;
  balance: number;
}

function BalanceTooltip({
  active,
  payload,
  currency,
  totalPayments,
}: TooltipContentProps & { currency: Currency; totalPayments: number }) {
  const row = payload[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox
      title={`${formatDate(row.payment.date)} · ${t.paymentOf(row.payment.number, totalPayments)}`}
      rows={[
        { label: t.columns.balance, value: formatMoney(row.balance, currency), color: BALANCE },
        {
          label: t.columns.total,
          value: formatMoney(row.payment.total, currency),
          color: 'transparent',
        },
      ]}
    />
  );
}

interface CreditBalanceChartProps {
  payments: CreditPayment[];
  currency: Currency;
  today: IsoDate;
}

/** What is still owed after each payment, with today marked. Its table is the payment table. */
export function CreditBalanceChart({ payments, currency, today }: CreditBalanceChartProps) {
  const data: Row[] = payments.map((payment) => ({
    t: toTimestamp(payment.date),
    payment,
    balance: payment.closingBalance,
  }));
  const ticks =
    data.length < 2
      ? []
      : niceTicks(
          data.map((d) => d.balance),
          { includeZero: true, minStep: 1 },
        );
  const now = toTimestamp(today);
  const start = data[0]?.t ?? 0;
  const end = data.at(-1)?.t ?? 0;
  const showToday = data.length >= 2 && now >= start && now <= end;
  // The label sits on the roomier side of the line, so it never runs into an axis.
  const todayLabelSide = now - start < (end - start) / 2 ? 'insideTopLeft' : 'insideTopRight';

  return (
    <ChartCard title={t.balanceChartTitle} subtitle={t.balanceChartSubtitle}>
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
              tickFormatter={formatAxisMonth}
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
            {showToday && (
              <ReferenceLine
                x={now}
                stroke="var(--chart-ink-muted)"
                label={{
                  value: t.today,
                  position: todayLabelSide,
                  fill: 'var(--chart-ink-muted)',
                  fontSize: 12,
                }}
              />
            )}
            <Tooltip
              cursor={CROSSHAIR}
              content={(props) => (
                <BalanceTooltip {...props} currency={currency} totalPayments={payments.length} />
              )}
            />
            <Area
              type="linear"
              dataKey="balance"
              name={t.columns.balance}
              stroke={BALANCE}
              strokeWidth={2}
              fill={BALANCE}
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
