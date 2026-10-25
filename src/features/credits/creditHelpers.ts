import { computeCredit, type CreditDraft, type CreditSummary } from '../../domain/credit';
import { formatMoney } from '../../domain/money';
import type { Currency, IsoDate } from '../../domain/types';
import { formatDate, strings } from '../../i18n/es-MX';

const t = strings.credit;

/**
 * Stored credits are validated on every write, so this only fails if the database was corrupted
 * from outside the app. The UI shows a message instead of crashing.
 */
export function computeCreditSafely(
  credit: Parameters<typeof computeCredit>[0],
  today: IsoDate,
): CreditSummary | null {
  try {
    return computeCredit(credit, today);
  } catch {
    return null;
  }
}

/** When it ends and how much it costs in total. */
export function outcomeLines(summary: CreditSummary, currency: Currency): string[] {
  if (!summary.lastPaymentDate) return [t.nothingOwed];
  return [
    t.previewEnds(formatDate(summary.lastPaymentDate), summary.payments.length),
    t.previewTotal(
      formatMoney(summary.totalPaid, currency),
      formatMoney(summary.totalInterest + summary.totalIva, currency),
    ),
  ];
}

/** A credit being typed: its fixed payment, first payment with IVA, payoff date and totals. */
export function creditPreview(draft: CreditDraft, today: IsoDate): string[] {
  const summary = computeCreditSafely(draft, today);
  const first = summary?.payments[0];
  const plan = draft.plans[0];
  if (!summary || !first || !plan) return [];
  return [
    t.previewPayment(formatMoney(plan.payment, draft.currency), draft.frequency),
    ...(draft.ivaOnInterest ? [t.previewFirstTotal(formatMoney(first.total, draft.currency))] : []),
    ...outcomeLines(summary, draft.currency),
  ];
}
