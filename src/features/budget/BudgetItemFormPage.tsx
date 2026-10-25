import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { CheckboxField } from '../../components/CheckboxField';
import { ConfirmButton } from '../../components/ConfirmButton';
import { MonthField } from '../../components/MonthField';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useBudgetItem } from '../../db/hooks';
import { requestPersistentStorage } from '../../db/persistence';
import { useRepository } from '../../db/repositoryContext';
import type { BudgetItemRecord } from '../../db/schema';
import { canSplitAt, EXPENSE_CATEGORIES } from '../../domain/budget';
import { toIsoDate } from '../../domain/dates';
import { toYearMonth, type YearMonth } from '../../domain/months';
import { CURRENCIES } from '../../domain/types';
import { formatMonth, strings } from '../../i18n/es-MX';
import { errorMessages } from '../errors';
import { budgetPath, monthParam } from './budgetHelpers';
import {
  emptyBudgetItemValues,
  parseBudgetItemForm,
  valuesFromItem,
  type BudgetItemFormValues,
  type BudgetKind,
} from './budgetItemForm';

const t = strings.budgetItem;

const kindOptions = (['income', 'expense'] as const).map((value) => ({
  value,
  label: t.kinds[value],
}));
const currencyOptions = CURRENCIES.map((value) => ({ value, label: strings.currencyNames[value] }));
const categoryOptions = EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: strings.budget.categories[value],
}));

type Scope = 'from' | 'all';

interface BudgetItemFormProps {
  /** The month the user was looking at: new items start there; edits can apply from there on. */
  viewMonth: YearMonth;
  kind: BudgetKind;
  editing?: BudgetItemRecord;
}

function BudgetItemForm({ viewMonth, kind, editing }: BudgetItemFormProps) {
  const repository = useRepository();
  const navigate = useNavigate();
  const currentYear = Number(toYearMonth(toIsoDate()).slice(0, 4));
  const [values, setValues] = useState<BudgetItemFormValues>(() =>
    editing ? valuesFromItem(editing) : emptyBudgetItemValues(kind, viewMonth),
  );
  const splittable = editing !== undefined && canSplitAt(editing, viewMonth);
  const [scope, setScope] = useState<Scope>(splittable ? 'from' : 'all');
  const [showErrors, setShowErrors] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const backTo = budgetPath(viewMonth);
  const viewMonthName = formatMonth(viewMonth);

  const set = (patch: Partial<BudgetItemFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  // "From this month on": the changed version starts in the month being viewed.
  const effective = splittable && scope === 'from' ? { ...values, month: viewMonth } : values;
  const parsed = parseBudgetItemForm(effective);
  const errors = showErrors && !parsed.ok ? parsed.errors : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!parsed.ok) return;
    try {
      if (editing) {
        await repository.updateBudgetItem(
          editing.id,
          parsed.draft,
          splittable && scope === 'from' ? viewMonth : undefined,
        );
      } else {
        await repository.addBudgetItem(parsed.draft);
        void requestPersistentStorage();
      }
      void navigate(backTo);
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  const remove = async (fromMonth?: YearMonth) => {
    if (!editing) return;
    try {
      await repository.deleteBudgetItem(editing.id, fromMonth);
      void navigate(backTo);
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
        <SegmentedControl
          legend={t.kindLabel}
          name="kind"
          options={kindOptions}
          value={values.kind}
          onChange={(value) => {
            set({ kind: value });
          }}
        />
        <TextField
          label={t.name}
          placeholder={values.kind === 'income' ? t.incomePlaceholder : t.expensePlaceholder}
          autoComplete="off"
          maxLength={80}
          value={values.name}
          onChange={(e) => {
            set({ name: e.target.value });
          }}
          error={errors.name}
        />
        <TextField
          label={t.amount}
          inputMode="decimal"
          autoComplete="off"
          value={values.amount}
          onChange={(e) => {
            set({ amount: e.target.value });
          }}
          error={errors.amount}
        />
        <SelectField
          label={t.currency}
          value={values.currency}
          options={currencyOptions}
          onChange={(currency) => {
            set({ currency });
          }}
        />
        {values.kind === 'expense' && (
          <SelectField
            label={t.category}
            value={values.category}
            options={categoryOptions}
            onChange={(category) => {
              set({ category });
            }}
          />
        )}
        {values.kind === 'expense' && values.category === 'credit' && (
          <Notice>
            <p>{t.creditHint}</p>
            <Link
              to="/credits/new"
              className="font-medium text-teal-700 underline dark:text-teal-400"
            >
              {strings.credit.new}
            </Link>
          </Notice>
        )}

        <CheckboxField
          label={t.recurring}
          help={t.recurringHelp}
          checked={values.recurring}
          onChange={(recurring) => {
            set({ recurring });
          }}
        />
        {splittable && (
          <div className="flex flex-col gap-1">
            <SegmentedControl
              legend={t.scopeLabel}
              name="scope"
              options={[
                { value: 'from', label: t.scopeFrom(viewMonthName) },
                { value: 'all', label: t.scopeAll },
              ]}
              value={scope}
              onChange={setScope}
            />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t.scopeHelp(viewMonthName)}
            </p>
          </div>
        )}
        {!(splittable && scope === 'from') && (
          <MonthField
            legend={values.recurring ? t.startMonth : t.month}
            value={values.month}
            currentYear={currentYear}
            onChange={(month) => {
              set({ month });
            }}
          />
        )}
        {values.recurring && (
          <>
            <CheckboxField
              label={t.hasEnd}
              checked={values.hasEnd}
              onChange={(hasEnd) => {
                set({ hasEnd });
              }}
            />
            {values.hasEnd && (
              <MonthField
                legend={t.endMonth}
                value={values.endMonth}
                currentYear={currentYear}
                onChange={(endMonth) => {
                  set({ endMonth });
                }}
                error={errors.endMonth}
              />
            )}
          </>
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
        <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
          {splittable ? (
            <>
              <ConfirmButton
                label={t.stopFrom(viewMonthName)}
                warning={t.stopWarning(viewMonthName)}
                confirmLabel={t.confirmStop}
                onConfirm={() => {
                  void remove(viewMonth);
                }}
              />
              <ConfirmButton
                label={t.deleteEverywhere}
                warning={t.deleteWarning}
                onConfirm={() => {
                  void remove();
                }}
              />
            </>
          ) : (
            <ConfirmButton
              label={t.delete}
              warning={editing.recurring ? t.deleteWarning : t.deleteOneWarning}
              onConfirm={() => {
                void remove();
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}

export function BudgetItemFormPage() {
  const { itemId } = useParams();
  const [params] = useSearchParams();
  const viewMonth = monthParam(params.get('month'), toYearMonth(toIsoDate()));
  const kind: BudgetKind = params.get('kind') === 'income' ? 'income' : 'expense';

  if (itemId === undefined) {
    return (
      <>
        <PageHeader
          title={kind === 'income' ? t.newIncomeTitle : t.newExpenseTitle}
          backTo={budgetPath(viewMonth)}
        />
        <BudgetItemForm key={kind} viewMonth={viewMonth} kind={kind} />
      </>
    );
  }
  return <EditBudgetItem itemId={itemId} viewMonth={viewMonth} />;
}

function EditBudgetItem({ itemId, viewMonth }: { itemId: string; viewMonth: YearMonth }) {
  const item = useBudgetItem(itemId);
  if (item === undefined) return <p>{strings.common.loading}</p>;
  if (item === null) return <PageHeader title={t.notFound} backTo={budgetPath(viewMonth)} />;
  return (
    <>
      <PageHeader
        title={item.kind === 'income' ? t.editIncomeTitle : t.editExpenseTitle}
        backTo={budgetPath(viewMonth)}
      />
      <BudgetItemForm key={item.id} viewMonth={viewMonth} kind={item.kind} editing={item} />
    </>
  );
}
