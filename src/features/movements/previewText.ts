import { formatMoney, formatPercent, formatSignedMoney } from '../../domain/money';
import type { EventPreview } from '../../domain/preview';
import type { AccountEvent, Currency, Period } from '../../domain/types';
import { formatDuration, strings } from '../../i18n/es-MX';

type SuccessfulPreview = Extract<EventPreview, { ok: true }>;

function gainSentence(period: Period, currency: Currency): string {
  const duration = formatDuration(period.days);
  if (period.gain > 0)
    return strings.preview.generated(formatMoney(period.gain, currency), duration);
  if (period.gain < 0) return strings.preview.lost(formatMoney(-period.gain, currency), duration);
  return strings.preview.unchanged(duration);
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('es-MX') + text.slice(1);
}

/** Plain-language lines describing what saving `candidate` does, e.g. "Generaste $1.00 en 11 días". */
export function describePreview(
  preview: SuccessfulPreview,
  candidate: AccountEvent,
  currency: Currency,
): string[] {
  const lines: string[] = [];
  const { closedPeriod, summary } = preview;

  if (closedPeriod) {
    const sentence = gainSentence(closedPeriod, currency);
    lines.push(
      candidate.type === 'balance'
        ? sentence
        : strings.preview.beforeMovement(lowercaseFirst(sentence)),
    );
    if (closedPeriod.gain !== 0 && closedPeriod.returnRate !== null) {
      lines.push(strings.preview.periodReturn(formatPercent(closedPeriod.returnRate)));
    }
    if (closedPeriod.netFlow > 0) {
      lines.push(strings.preview.depositsExcluded(formatMoney(closedPeriod.netFlow, currency)));
    } else if (closedPeriod.netFlow < 0) {
      lines.push(strings.preview.withdrawalsExcluded(formatMoney(-closedPeriod.netFlow, currency)));
    }
  } else if (candidate.type !== 'balance' && candidate.balanceAfter === undefined) {
    lines.push(strings.preview.pending);
  }

  if (candidate.type !== 'balance') {
    lines.push(strings.preview.netContributed(formatMoney(summary.netContributed, currency)));
  }
  lines.push(strings.preview.totalGain(formatSignedMoney(summary.totalGain, currency)));
  return lines;
}
