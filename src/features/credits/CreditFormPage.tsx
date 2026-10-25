import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { CheckboxField } from '../../components/CheckboxField';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useCredit } from '../../db/hooks';
import { requestPersistentStorage } from '../../db/persistence';
import { useRepository } from '../../db/repositoryContext';
import type { CreditRecord } from '../../db/schema';
import { minimumPayment, parseRateToBps, PAYMENT_FREQUENCIES } from '../../domain/credit';
import { toIsoDate } from '../../domain/dates';
import { formatMoney, parseAmountToCents } from '../../domain/money';
import { CURRENCIES } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { errorMessages } from '../errors';
import { creditPreview } from './creditHelpers';
import {
  emptyCreditValues,
  parseCreditForm,
  valuesFromCredit,
  type CreditFormValues,
  type PaymentMode,
} from './creditForm';

const t = strings.credit;
const currencyOptions = CURRENCIES.map((value) => ({ value, label: strings.currencyNames[value] }));
const frequencyOptions = PAYMENT_FREQUENCIES.map((value) => ({
  value,
  label: t.frequencies[value],
}));
const modeOptions: { value: PaymentMode; label: string }[] = [
  { value: 'term', label: t.modes.term },
  { value: 'payment', label: t.modes.payment },
];

function CreditForm({ editing }: { editing?: CreditRecord }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const today = toIsoDate();
  const [values, setValues] = useState<CreditFormValues>(() =>
    editing ? valuesFromCredit(editing) : emptyCreditValues(today),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const set = (patch: Partial<CreditFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const parsed = parseCreditForm(values, editing?.plans.slice(1));
  const errors = showErrors && !parsed.ok ? parsed.errors : {};
  const preview = parsed.ok ? creditPreview(parsed.draft, today) : [];
  // The smallest payment that lowers the debt, once balance and rate are known.
  const balance = parseAmountToCents(values.balance);
  const rate = parseRateToBps(values.rate);
  const minimum =
    balance !== null && balance > 0 && rate !== null
      ? minimumPayment(balance, rate, values.frequency)
      : null;
  const backTo = editing ? `/credits/${editing.id}` : '/budget';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!parsed.ok) return;
    try {
      const saved = editing
        ? await repository.updateCredit(editing.id, parsed.draft)
        : await repository.addCredit(parsed.draft);
      if (!editing) void requestPersistentStorage();
      void navigate(`/credits/${saved.id}`);
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await repository.deleteCredit(editing.id);
      void navigate('/budget');
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <TextField
          label={t.name}
          placeholder={t.namePlaceholder}
          autoComplete="off"
          maxLength={80}
          value={values.name}
          onChange={(e) => {
            set({ name: e.target.value });
          }}
          error={errors.name}
        />
        <SelectField
          label={t.currency}
          value={values.currency}
          options={currencyOptions}
          onChange={(currency) => {
            set({ currency });
          }}
        />
        <TextField
          label={t.balance}
          help={t.balanceHelp}
          inputMode="decimal"
          autoComplete="off"
          value={values.balance}
          onChange={(e) => {
            set({ balance: e.target.value });
          }}
          error={errors.balance}
        />
        <TextField
          label={t.rate}
          help={t.rateHelp}
          inputMode="decimal"
          autoComplete="off"
          value={values.rate}
          onChange={(e) => {
            set({ rate: e.target.value });
          }}
          error={errors.rate}
        />
        <CheckboxField
          label={t.iva}
          help={t.ivaHelp}
          checked={values.ivaOnInterest}
          onChange={(ivaOnInterest) => {
            set({ ivaOnInterest });
          }}
        />
        <SelectField
          label={t.frequency}
          value={values.frequency}
          options={frequencyOptions}
          onChange={(frequency) => {
            set({ frequency });
          }}
        />
        <TextField
          label={t.firstPaymentDate}
          help={values.frequency === 'semimonthly' ? t.firstPaymentHelp : undefined}
          type="date"
          value={values.firstPaymentDate}
          onChange={(e) => {
            set({ firstPaymentDate: e.target.value });
          }}
          error={errors.firstPaymentDate}
        />
        <SegmentedControl
          legend={t.modeLabel}
          name="mode"
          options={modeOptions}
          value={values.mode}
          onChange={(mode) => {
            set({ mode });
          }}
        />
        {values.mode === 'term' ? (
          <TextField
            label={t.count}
            help={t.countHelp}
            inputMode="numeric"
            autoComplete="off"
            value={values.count}
            onChange={(e) => {
              set({ count: e.target.value });
            }}
            error={errors.count}
          />
        ) : (
          <TextField
            label={t.payment(values.ivaOnInterest)}
            help={t.paymentHelp}
            inputMode="decimal"
            autoComplete="off"
            value={values.payment}
            onChange={(e) => {
              set({ payment: e.target.value });
            }}
            error={
              errors.payment && minimum !== null
                ? `${errors.payment} ${t.previewMinimum(formatMoney(minimum, values.currency))}`
                : errors.payment
            }
          />
        )}
        <TextField
          label={t.fees}
          help={t.feesHelp}
          optional
          inputMode="decimal"
          autoComplete="off"
          value={values.fees}
          onChange={(e) => {
            set({ fees: e.target.value });
          }}
          error={errors.fees}
        />

        {preview.length > 0 && (
          <section aria-labelledby="credit-preview-title">
            <Notice>
              <p id="credit-preview-title" className="mb-1 font-medium">
                {t.previewTitle}
              </p>
              {preview.map((line) => (
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
          <ButtonLink variant="ghost" to={backTo}>
            {strings.common.cancel}
          </ButtonLink>
        </div>
      </form>

      {editing && (
        <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <ConfirmButton
            label={t.deleteCredit}
            warning={t.deleteWarning}
            onConfirm={() => {
              void remove();
            }}
          />
        </section>
      )}
    </div>
  );
}

export function NewCreditPage() {
  return (
    <>
      <PageHeader title={t.newTitle} backTo="/budget" />
      <CreditForm />
    </>
  );
}

export function EditCreditPage() {
  const { creditId = '' } = useParams();
  const credit = useCredit(creditId);
  if (credit === undefined) return <p>{strings.common.loading}</p>;
  if (credit === null) return <PageHeader title={t.notFound} backTo="/budget" />;
  return (
    <>
      <PageHeader title={t.editTitle} backTo={`/credits/${credit.id}`} />
      <CreditForm key={credit.id} editing={credit} />
    </>
  );
}
