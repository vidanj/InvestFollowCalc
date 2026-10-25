import { MAX_RATE_BPS } from './credit';
import { computeAccount } from './engine';
import { computePortfolio, type PortfolioInput } from './portfolio';
import { CURRENCIES, type Cents, type Currency } from './types';

/** Default share of the month's income suggested for investing (the "20" of 50/30/20). */
export const DEFAULT_INVEST_PERCENT = 20;
/** Horizons shown for the projection, in years. */
export const PROJECTION_YEARS = [1, 3, 5, 10] as const;

/** Which annual return estimates what the money would generate. */
export type RateSource =
  | { kind: 'portfolio' }
  | { kind: 'account'; accountId: string }
  | { kind: 'manual'; rateBps: number };

/** The user's choices, stored with their data (and in backups). */
export interface InvestPlan {
  /** Share of the month's income to invest, 0–100. */
  percent: number;
  /** Return used for each currency; missing means "my portfolio". */
  sources: Partial<Record<Currency, RateSource>>;
}

export const DEFAULT_INVEST_PLAN: InvestPlan = { percent: DEFAULT_INVEST_PERCENT, sources: {} };

// --- Suggestion ---

export interface InvestSuggestion {
  /** `income × percent`, before looking at expenses. */
  target: Cents;
  /** What can actually be invested: the target, but never more than what is left (nor < 0). */
  amount: Cents;
  /** Expenses leave less than the target. */
  capped: boolean;
}

export function suggestInvestment(income: Cents, left: Cents, percent: number): InvestSuggestion {
  // Integer arithmetic, halves rounded up: exact for any amount.
  const target = income <= 0 ? 0 : Number((BigInt(income) * BigInt(percent) * 2n + 100n) / 200n);
  const amount = Math.max(0, Math.min(target, left));
  return { target, amount, capped: amount < target };
}

// --- Returns from the investments ---

export interface AnnualReturn {
  /** Annualized time-weighted return (TWR), as in the portfolio; `null` without history. */
  rate: number | null;
  /** Fewer than 30 days measured: the annualized figure is only a rough estimate. */
  isShortPeriod: boolean;
}

export interface AccountReturn extends AnnualReturn {
  accountId: string;
  name: string;
}

export interface CurrencyReturns {
  currency: Currency;
  /** All active accounts of the currency together; `null` when there are none. */
  portfolio: AnnualReturn | null;
  accounts: AccountReturn[];
}

/**
 * The real annualized returns of the user's investments in `currency`, computed exactly as the
 * Portafolio and account pages do. Archived accounts are left out, as in the portfolio totals.
 */
export function investmentReturns(
  inputs: readonly PortfolioInput[],
  currency: Currency,
): CurrencyReturns {
  const active = inputs.filter((i) => !i.account.archived && i.account.currency === currency);
  const accounts: AccountReturn[] = [];
  for (const { account, events } of active) {
    try {
      const summary = computeAccount(events).summary;
      if (summary) {
        accounts.push({
          accountId: account.id,
          name: account.name,
          rate: summary.annualizedTwr,
          isShortPeriod: summary.isShortPeriod,
        });
      }
    } catch {
      // A broken account is reported on its own page; it just offers no return here.
    }
  }

  let portfolio: AnnualReturn | null = null;
  try {
    const summary = computePortfolio(active).find((p) => p.currency === currency)?.computation
      .summary;
    if (summary) {
      portfolio = { rate: summary.annualizedTwr, isShortPeriod: summary.isShortPeriod };
    }
  } catch {
    portfolio = null;
  }
  return { currency, portfolio, accounts };
}

export interface ResolvedRate extends AnnualReturn {
  source: RateSource;
}

/**
 * The return to project with. Without a stored choice it is the portfolio of the currency; a
 * chosen account that no longer exists falls back to the portfolio too.
 */
export function resolveRate(
  returns: CurrencyReturns,
  source: RateSource | undefined,
): ResolvedRate {
  if (source?.kind === 'manual') {
    return { source, rate: source.rateBps / 10_000, isShortPeriod: false };
  }
  if (source?.kind === 'account') {
    const account = returns.accounts.find((a) => a.accountId === source.accountId);
    if (account) return { source, rate: account.rate, isShortPeriod: account.isShortPeriod };
  }
  return {
    source: { kind: 'portfolio' },
    rate: returns.portfolio?.rate ?? null,
    isShortPeriod: returns.portfolio?.isShortPeriod ?? false,
  };
}

// --- Projection ---

export interface ProjectionPoint {
  /** Months from now. */
  month: number;
  /** Sum of the monthly amounts invested so far. */
  contributed: Cents;
  /** Estimated value of the investment. */
  value: Cents;
  /** `value − contributed`: what the money generated (as "ganancia" in the portfolio). */
  generated: Cents;
}

/**
 * Investing `monthly` at the end of every month, growing at `annualRate` compounded monthly
 * (`(1 + annual)^(1/12) − 1`, the same compounding the annualized TWR assumes). Balances are
 * rounded to the cent every month. Point 0 is today.
 */
export function projectContributions(
  monthly: Cents,
  annualRate: number,
  months: number,
): ProjectionPoint[] {
  if (!Number.isFinite(annualRate) || annualRate <= -1) {
    throw new RangeError(`Invalid annual rate: ${annualRate}`);
  }
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  const points: ProjectionPoint[] = [{ month: 0, contributed: 0, value: 0, generated: 0 }];
  let value = 0;
  for (let month = 1; month <= months; month++) {
    value = Math.round(value * (1 + monthlyRate)) + monthly;
    const contributed = monthly * month;
    points.push({ month, contributed, value, generated: value - contributed });
  }
  return points;
}

// --- Stored settings ---

function isRateSource(value: unknown): value is RateSource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  if (source.kind === 'portfolio') return true;
  if (source.kind === 'account') return typeof source.accountId === 'string';
  return (
    source.kind === 'manual' &&
    typeof source.rateBps === 'number' &&
    Number.isInteger(source.rateBps) &&
    source.rateBps >= 0 &&
    source.rateBps <= MAX_RATE_BPS
  );
}

export function isValidPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** Reads a stored plan; anything invalid falls back to the defaults, field by field. */
export function parseInvestPlan(value: unknown): InvestPlan {
  if (typeof value !== 'object' || value === null) return DEFAULT_INVEST_PLAN;
  const raw = value as { percent?: unknown; sources?: unknown };
  const sources: InvestPlan['sources'] = {};
  if (typeof raw.sources === 'object' && raw.sources !== null) {
    for (const currency of CURRENCIES) {
      const source = (raw.sources as Record<string, unknown>)[currency];
      if (isRateSource(source)) sources[currency] = source;
    }
  }
  return {
    percent: isValidPercent(raw.percent) ? raw.percent : DEFAULT_INVEST_PERCENT,
    sources,
  };
}
