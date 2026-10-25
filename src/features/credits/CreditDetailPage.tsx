import { Fragment, useMemo } from 'react';
import { useParams } from 'react-router';
import { ButtonLink } from '../../components/Button';
import { CostSplit } from '../../components/charts/CostSplit';
import { CreditBalanceChart } from '../../components/charts/LazyCharts';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Meter } from '../../components/Meter';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { Stat } from '../../components/Stat';
import { useCredit } from '../../db/hooks';
import { useRepository } from '../../db/repositoryContext';
import type { CreditRecord } from '../../db/schema';
import type { CreditSummary } from '../../domain/credit';
import { toIsoDate } from '../../domain/dates';
import { formatMoney, formatRate } from '../../domain/money';
import type { Currency } from '../../domain/types';
import { formatDate, formatWholePercent, strings } from '../../i18n/es-MX';
import { computeCreditSafely } from './creditHelpers';

const t = strings.credit;

function CreditStats({ credit, summary }: { credit: CreditRecord; summary: CreditSummary }) {
  const { currency } = credit;
  const money = (cents: number) => formatMoney(cents, currency);
  const { nextPayment, lastPaymentDate } = summary;
  const interestAndIva = summary.totalInterest + summary.totalIva;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat
        label={t.currentBalance}
        value={money(summary.currentBalance)}
        detail={nextPayment ? t.currentBalanceDetail(formatDate(nextPayment.date)) : undefined}
      />
      {nextPayment && (
        <Stat
          label={t.nextPayment}
          value={money(nextPayment.total)}
          detail={t.nextPaymentDetail(
            formatDate(nextPayment.date),
            nextPayment.number,
            summary.payments.length,
          )}
        />
      )}
      {lastPaymentDate && (
        <Stat
          label={summary.isPaidOff ? t.paidOff : t.payoff}
          value={formatDate(lastPaymentDate)}
          detail={summary.isPaidOff ? undefined : t.payoffDetail(summary.paymentsLeft)}
        />
      )}
      <Stat label={t.totalPaid} value={money(summary.totalPaid)} detail={t.totalPaidDetail} />
      <Stat
        label={t.interestCost}
        value={money(interestAndIva)}
        detail={
          summary.principal > 0
            ? t.interestCostDetail(formatWholePercent(interestAndIva / summary.principal))
            : undefined
        }
      />
      {credit.upfrontFees > 0 && (
        <Stat
          label={t.totalCost}
          value={money(summary.totalCost)}
          detail={t.totalCostDetail(money(summary.received))}
        />
      )}
      <Stat
        label={t.paidSoFar}
        value={money(summary.paidSoFar)}
        detail={t.paidSoFarDetail(summary.paymentsMade, summary.payments.length)}
      />
      <Stat label={t.remaining} value={money(summary.remainingToPay)} />
    </dl>
  );
}

function ScheduleTable({
  summary,
  currency,
  withIva,
}: {
  summary: CreditSummary;
  currency: Currency;
  withIva: boolean;
}) {
  const money = (cents: number) => formatMoney(cents, currency);
  const columns = t.columns;
  const cell = 'px-2 py-1.5 text-right';
  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-xs whitespace-nowrap tabular-nums">
        <thead className="sticky top-0 bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">{columns.number}</th>
            <th className="px-2 py-1.5 text-left font-medium">{columns.date}</th>
            <th className={`${cell} font-medium`}>{columns.payment}</th>
            <th className={`${cell} font-medium`}>{columns.principal}</th>
            <th className={`${cell} font-medium`}>{columns.interest}</th>
            {withIva && <th className={`${cell} font-medium`}>{columns.iva}</th>}
            <th className={`${cell} font-medium`}>{columns.total}</th>
            <th className={`${cell} font-medium`}>{columns.balance}</th>
          </tr>
        </thead>
        <tbody>
          {summary.payments.map((p, index) => {
            const isPaid = index < summary.paymentsMade;
            const change =
              p.planIndex > 0 && summary.payments[index - 1]?.planIndex !== p.planIndex
                ? summary.changes.find((c) => c.planIndex === p.planIndex)
                : undefined;
            return (
              <Fragment key={p.number}>
                {change && (
                  <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                    <td colSpan={withIva ? 8 : 7} className="px-2 py-1.5 text-left">
                      {t.planUpdate}: {money(change.newBalance)}
                    </td>
                  </tr>
                )}
                <tr
                  className={`border-t border-slate-100 dark:border-slate-800 ${isPaid ? 'text-slate-500' : ''}`}
                >
                  <td className="px-2 py-1.5 text-left">
                    {p.number}
                    {isPaid && <span className="sr-only"> ({t.paid})</span>}
                  </td>
                  <td className="px-2 py-1.5 text-left">{formatDate(p.date)}</td>
                  <td className={cell}>{money(p.payment)}</td>
                  <td className={cell}>{money(p.principal)}</td>
                  <td className={cell}>{money(p.interest)}</td>
                  {withIva && <td className={cell}>{money(p.iva)}</td>}
                  <td className={`${cell} font-medium`}>{money(p.total)}</td>
                  <td className={cell}>{money(p.closingBalance)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlanList({ credit, summary }: { credit: CreditRecord; summary: CreditSummary }) {
  const repository = useRepository();
  const money = (cents: number) => formatMoney(cents, credit.currency);
  return (
    <ol className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      {credit.plans.map((plan, index) => {
        const change = summary.changes.find((c) => c.planIndex === index);
        return (
          <li key={plan.firstPaymentDate} className="flex flex-col gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {index === 0 ? t.planOriginal : t.planUpdate} · {formatDate(plan.firstPaymentDate)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t.planLine(money(plan.balance), money(plan.payment))}
              </p>
              {change && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {change.difference > 0
                    ? t.differenceLess(money(change.difference))
                    : change.difference < 0
                      ? t.differenceMore(money(-change.difference))
                      : t.differenceNone}
                </p>
              )}
            </div>
            {index > 0 && (
              <ConfirmButton
                label={t.deletePlan}
                warning={t.deletePlanWarning}
                onConfirm={() => {
                  void repository.deleteCreditPlan(credit.id, index);
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CreditDetailPage() {
  const { creditId = '' } = useParams();
  const credit = useCredit(creditId);
  const today = toIsoDate();
  const summary = useMemo(
    () => (credit ? computeCreditSafely(credit, today) : undefined),
    [credit, today],
  );

  if (credit === undefined) return <p>{strings.common.loading}</p>;
  if (credit === null) return <PageHeader title={t.notFound} backTo="/budget" />;
  const { currency } = credit;

  return (
    <>
      <PageHeader
        title={credit.name}
        backTo="/budget"
        actions={
          <ButtonLink variant="secondary" to={`/credits/${credit.id}/edit`}>
            {strings.common.edit}
          </ButtonLink>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {strings.currencyNames[currency]} ·{' '}
          {t.rateLine(formatRate(credit.annualRateBps), credit.frequency, credit.ivaOnInterest)}
        </p>
      </PageHeader>

      {!summary ? (
        <Notice tone="error">{t.corrupted}</Notice>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            {summary.isPaidOff && summary.lastPaymentDate && (
              <Notice tone="success">{t.paidOffNotice(formatDate(summary.lastPaymentDate))}</Notice>
            )}
            <CreditStats credit={credit} summary={summary} />
            <Meter
              label={t.progressLabel}
              ratio={summary.progress}
              valueText={t.progress(formatWholePercent(summary.progress))}
            />
            <ButtonLink to={`/credits/${credit.id}/balance`}>{t.updateBalance}</ButtonLink>
          </div>

          <CostSplit
            title={t.splitTitle}
            subtitle={t.splitSubtitle}
            currency={currency}
            parts={[
              {
                label: t.principal,
                amount: summary.totalPaid - summary.totalInterest - summary.totalIva,
                color: 'var(--series-principal)',
              },
              { label: t.interest, amount: summary.totalInterest, color: 'var(--series-interest)' },
              { label: t.ivaLabel, amount: summary.totalIva, color: 'var(--series-tax)' },
              { label: t.feesLabel, amount: credit.upfrontFees, color: 'var(--series-fees)' },
            ]}
          />
          <CreditBalanceChart payments={summary.payments} currency={currency} today={today} />

          {summary.payments.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="schedule-title">
              <h3 id="schedule-title" className="font-semibold">
                {t.scheduleTitle}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t.scheduleNote}</p>
              <ScheduleTable summary={summary} currency={currency} withIva={credit.ivaOnInterest} />
            </section>
          )}

          <section className="flex flex-col gap-2" aria-labelledby="plans-title">
            <h3 id="plans-title" className="font-semibold">
              {t.plansTitle}
            </h3>
            <PlanList credit={credit} summary={summary} />
          </section>
        </div>
      )}
    </>
  );
}
