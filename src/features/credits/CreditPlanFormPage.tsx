import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { TextField } from '../../components/TextField';
import { useCredit } from '../../db/hooks';
import { useRepository } from '../../db/repositoryContext';
import type { CreditRecord } from '../../db/schema';
import { expectedBalanceAt, type CreditSummary } from '../../domain/credit';
import { isIsoDate, toIsoDate } from '../../domain/dates';
import { formatAmountInput, formatMoney } from '../../domain/money';
import { formatDate, strings } from '../../i18n/es-MX';
import { errorMessages } from '../errors';
import { parsePlanForm, type PlanFormValues } from './creditForm';
import { computeCreditSafely, outcomeLines } from './creditHelpers';

const t = strings.credit;

function initialValues(
  credit: CreditRecord,
  summary: CreditSummary,
  today: string,
): PlanFormValues {
  const next = summary.nextPayment;
  const plan = credit.plans[next?.planIndex ?? credit.plans.length - 1];
  return {
    owed: '',
    nextPaymentDate: next?.date ?? today,
    payment: plan ? formatAmountInput(plan.payment) : '',
  };
}

function PlanForm({ credit, summary }: { credit: CreditRecord; summary: CreditSummary }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const today = toIsoDate();
  const [values, setValues] = useState(() => initialValues(credit, summary, today));
  const [showErrors, setShowErrors] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const detailPath = `/credits/${credit.id}`;
  const money = (cents: number) => formatMoney(cents, credit.currency);

  const set = (patch: Partial<PlanFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const parsed = parsePlanForm(values, credit);
  const errors = showErrors && !parsed.ok ? parsed.errors : {};
  const expected = isIsoDate(values.nextPaymentDate)
    ? expectedBalanceAt(summary.payments, values.nextPaymentDate)
    : null;
  const lines: string[] = [];
  if (expected !== null) {
    lines.push(t.expectedOwed(money(expected), formatDate(values.nextPaymentDate)));
  }
  if (parsed.ok && expected !== null) {
    const difference = expected - parsed.plan.balance;
    lines.push(
      difference > 0
        ? t.differenceLess(money(difference))
        : difference < 0
          ? t.differenceMore(money(-difference))
          : t.differenceNone,
    );
    const updated = computeCreditSafely(parsed.draft, today);
    if (updated) lines.push(...outcomeLines(updated, credit.currency));
    if (difference > 0) lines.push(t.extraPaymentHint);
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!parsed.ok) return;
    try {
      await repository.setCreditPlan(credit.id, parsed.plan);
      void navigate(detailPath);
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <p className="text-sm text-slate-600 dark:text-slate-400">{t.updateIntro}</p>
      <TextField
        label={t.owed}
        help={t.owedHelp}
        inputMode="decimal"
        autoComplete="off"
        value={values.owed}
        onChange={(e) => {
          set({ owed: e.target.value });
        }}
        error={errors.owed}
      />
      <TextField
        label={t.nextPaymentDate}
        type="date"
        value={values.nextPaymentDate}
        onChange={(e) => {
          set({ nextPaymentDate: e.target.value });
        }}
        error={errors.nextPaymentDate}
      />
      <TextField
        label={t.payment(credit.ivaOnInterest)}
        help={t.paymentHelp}
        inputMode="decimal"
        autoComplete="off"
        value={values.payment}
        onChange={(e) => {
          set({ payment: e.target.value });
        }}
        error={errors.payment}
      />

      {lines.length > 0 && (
        <section aria-labelledby="plan-preview-title">
          <Notice>
            <p id="plan-preview-title" className="mb-1 font-medium">
              {t.previewTitle}
            </p>
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Notice>
        </section>
      )}
      {errors.other && <Notice tone="error">{errors.other.join(' ')}</Notice>}
      {saveErrors.length > 0 && <Notice tone="error">{saveErrors.join(' ')}</Notice>}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {strings.common.save}
        </Button>
        <ButtonLink variant="ghost" to={detailPath}>
          {strings.common.cancel}
        </ButtonLink>
      </div>
    </form>
  );
}

export function CreditPlanFormPage() {
  const { creditId = '' } = useParams();
  const credit = useCredit(creditId);
  if (credit === undefined) return <p>{strings.common.loading}</p>;
  if (credit === null) return <PageHeader title={t.notFound} backTo="/budget" />;
  const summary = computeCreditSafely(credit, toIsoDate());

  return (
    <>
      <PageHeader title={t.updateTitle} backTo={`/credits/${credit.id}`}>
        <p className="text-sm text-slate-600 dark:text-slate-400">{credit.name}</p>
      </PageHeader>
      {summary ? (
        <PlanForm key={credit.updatedAt} credit={credit} summary={summary} />
      ) : (
        <Notice tone="error">{t.corrupted}</Notice>
      )}
    </>
  );
}
