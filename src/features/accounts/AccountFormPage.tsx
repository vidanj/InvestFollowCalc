import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextField } from '../../components/TextField';
import { useAccount, useAccountsWithEvents } from '../../db/hooks';
import { requestPersistentStorage } from '../../db/persistence';
import { ACCOUNT_NAME_MAX_LENGTH } from '../../db/repository';
import { useRepository } from '../../db/repositoryContext';
import type { AccountRecord } from '../../db/schema';
import { compareIsoDates, isIsoDate, toIsoDate } from '../../domain/dates';
import { parseAmountToCents } from '../../domain/money';
import { CURRENCIES, type Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { errorMessages } from '../errors';
import { ACCOUNT_COLORS, suggestColor } from './accountHelpers';

interface FieldErrors {
  name?: string;
  initialBalance?: string;
  initialDate?: string;
}

const currencyOptions = CURRENCIES.map((value) => ({ value, label: strings.currencyNames[value] }));

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{strings.accountForm.color}</legend>
      <div className="flex flex-wrap gap-2">
        {ACCOUNT_COLORS.map((color, index) => (
          <label
            key={color}
            className="relative h-9 w-9 cursor-pointer rounded-full has-checked:ring-2 has-checked:ring-slate-900 has-checked:ring-offset-2 has-focus-visible:outline-2 has-focus-visible:outline-teal-600 dark:has-checked:ring-slate-100 dark:ring-offset-slate-950"
            style={{ backgroundColor: color }}
          >
            <input
              type="radio"
              name="color"
              value={color}
              checked={value === color}
              onChange={() => {
                onChange(color);
              }}
              aria-label={strings.accountForm.colorOption(index + 1)}
              className="sr-only"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function validateName(name: string): string | undefined {
  const length = name.trim().length;
  return length === 0 || length > ACCOUNT_NAME_MAX_LENGTH
    ? strings.errors.nameLength(ACCOUNT_NAME_MAX_LENGTH)
    : undefined;
}

function NewAccountForm({ usedColors }: { usedColors: string[] }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const today = toIsoDate();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('MXN');
  const [color, setColor] = useState(() => suggestColor(usedColors));
  const [initialBalance, setInitialBalance] = useState('');
  const [initialDate, setInitialDate] = useState(today);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const balance = parseAmountToCents(initialBalance);
    const next: FieldErrors = {};
    const nameError = validateName(name);
    if (nameError) next.name = nameError;
    if (initialBalance.trim() === '') next.initialBalance = strings.errors.required;
    else if (balance === null) next.initialBalance = strings.errors.invalidAmount;
    if (!isIsoDate(initialDate)) next.initialDate = strings.errors.invalidDate;
    else if (compareIsoDates(initialDate, today) > 0) next.initialDate = strings.errors.futureDate;
    setErrors(next);
    if (Object.keys(next).length > 0 || balance === null) return;

    try {
      const account = await repository.createAccount({
        name,
        currency,
        color,
        initialBalance: balance,
        initialDate,
      });
      void requestPersistentStorage();
      void navigate(`/accounts/${account.id}`);
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
      <TextField
        label={strings.accountForm.name}
        placeholder={strings.accountForm.namePlaceholder}
        help={strings.accountForm.nameHelp}
        value={name}
        maxLength={ACCOUNT_NAME_MAX_LENGTH}
        onChange={(e) => {
          setName(e.target.value);
        }}
        error={errors.name}
      />
      <SegmentedControl
        legend={strings.accountForm.currency}
        name="currency"
        options={currencyOptions}
        value={currency}
        onChange={setCurrency}
      />
      <ColorPicker value={color} onChange={setColor} />
      <TextField
        label={strings.accountForm.initialBalance}
        help={strings.accountForm.initialBalanceHelp}
        inputMode="decimal"
        autoComplete="off"
        value={initialBalance}
        onChange={(e) => {
          setInitialBalance(e.target.value);
        }}
        error={errors.initialBalance}
      />
      <TextField
        label={strings.accountForm.initialDate}
        type="date"
        max={today}
        value={initialDate}
        onChange={(e) => {
          setInitialDate(e.target.value);
        }}
        error={errors.initialDate}
      />
      {saveErrors.length > 0 && <Notice tone="error">{saveErrors.join(' ')}</Notice>}
      <Button type="submit">{strings.accountForm.create}</Button>
    </form>
  );
}

function EditAccountForm({ account }: { account: AccountRecord }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState<Currency>(account.currency);
  const [color, setColor] = useState(account.color);
  const [nameError, setNameError] = useState<string | undefined>();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const run = async (action: () => Promise<unknown>, then: string) => {
    try {
      await action();
      void navigate(then);
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
          event.preventDefault();
          const error = validateName(name);
          setNameError(error);
          if (error) return;
          void run(
            () => repository.updateAccount(account.id, { name, currency, color }),
            `/accounts/${account.id}`,
          );
        }}
      >
        <TextField
          label={strings.accountForm.name}
          value={name}
          maxLength={ACCOUNT_NAME_MAX_LENGTH}
          onChange={(e) => {
            setName(e.target.value);
          }}
          error={nameError}
        />
        <SegmentedControl
          legend={strings.accountForm.currency}
          name="currency"
          options={currencyOptions}
          value={currency}
          onChange={setCurrency}
        />
        <ColorPicker value={color} onChange={setColor} />
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {strings.accountForm.initialEditHint}
        </p>
        {saveErrors.length > 0 && <Notice tone="error">{saveErrors.join(' ')}</Notice>}
        <Button type="submit">{strings.common.save}</Button>
      </form>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {strings.accountForm.archiveHelp}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void run(
              () => repository.updateAccount(account.id, { archived: !account.archived }),
              account.archived ? `/accounts/${account.id}` : '/',
            );
          }}
        >
          {account.archived ? strings.accountForm.unarchive : strings.accountForm.archive}
        </Button>
        <ConfirmButton
          label={strings.accountForm.deleteAccount}
          warning={strings.accountForm.deleteWarning}
          onConfirm={() => {
            void run(() => repository.deleteAccount(account.id), '/');
          }}
        />
      </section>
    </div>
  );
}

export function NewAccountPage() {
  const items = useAccountsWithEvents();
  if (!items) return <p>{strings.common.loading}</p>;
  return (
    <>
      <PageHeader title={strings.accountForm.newTitle} backTo="/" />
      <NewAccountForm usedColors={items.map((item) => item.account.color)} />
    </>
  );
}

export function EditAccountPage() {
  const { accountId = '' } = useParams();
  const account = useAccount(accountId);
  if (account === undefined) return <p>{strings.common.loading}</p>;
  if (account === null) return <Notice tone="error">{strings.account.notFound}</Notice>;
  return (
    <>
      <PageHeader title={strings.accountForm.editTitle} backTo={`/accounts/${account.id}`} />
      <EditAccountForm account={account} />
    </>
  );
}
