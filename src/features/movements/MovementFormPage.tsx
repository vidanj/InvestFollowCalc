import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Notice } from '../../components/Notice';
import { PageHeader } from '../../components/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { TextField } from '../../components/TextField';
import { useAccount, useAccountEvents } from '../../db/hooks';
import { useRepository } from '../../db/repositoryContext';
import type { AccountRecord, EventRecord } from '../../db/schema';
import { toIsoDate } from '../../domain/dates';
import { previewEvent } from '../../domain/preview';
import { strings } from '../../i18n/es-MX';
import type { FlashState } from '../accounts/accountHelpers';
import { errorMessages, issueMessages } from '../errors';
import {
  emptyMovementValues,
  parseMovementForm,
  toCandidate,
  valuesFromEvent,
  type MovementFormValues,
  type MovementType,
} from './movementForm';
import { describePreview } from './previewText';

const typeOptions: { value: MovementType; label: string }[] = [
  { value: 'balance', label: strings.movement.types.balance },
  { value: 'deposit', label: strings.movement.types.deposit },
  { value: 'withdrawal', label: strings.movement.types.withdrawal },
];

interface MovementFormProps {
  account: AccountRecord;
  events: EventRecord[];
  editing?: EventRecord;
}

function MovementForm({ account, events, editing }: MovementFormProps) {
  const repository = useRepository();
  const navigate = useNavigate();
  const today = toIsoDate();
  const isInitial = editing !== undefined && events[0]?.id === editing.id;
  const [values, setValues] = useState<MovementFormValues>(() =>
    editing ? valuesFromEvent(editing) : emptyMovementValues(today),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const set = (patch: Partial<MovementFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const parsed = parseMovementForm(values, today);
  const candidate = parsed.ok ? toCandidate(events, parsed.draft, editing) : null;
  const preview = candidate ? previewEvent(events, candidate) : null;
  const previewLines =
    preview?.ok && candidate ? describePreview(preview, candidate, account.currency) : [];
  const fieldErrors = showErrors && !parsed.ok ? parsed.errors : {};
  const accountPath = `/accounts/${account.id}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (!parsed.ok || !preview?.ok) return;
    try {
      if (editing) await repository.updateEvent(editing.id, parsed.draft);
      else await repository.addEvent(account.id, parsed.draft);
      const state: FlashState = { flash: previewLines };
      void navigate(accountPath, { state });
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  const remove = async () => {
    if (!editing) return;
    try {
      await repository.deleteEvent(editing.id);
      void navigate(accountPath);
    } catch (error) {
      setSaveErrors(errorMessages(error));
    }
  };

  const isFlow = values.type !== 'balance';

  return (
    <div className="flex flex-col gap-8">
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {!isInitial && (
          <SegmentedControl
            legend={strings.movement.typeLabel}
            name="type"
            options={typeOptions}
            value={values.type}
            onChange={(type) => {
              set({ type });
            }}
          />
        )}
        <TextField
          label={strings.movement.date}
          type="date"
          max={today}
          min={isInitial ? undefined : events[0]?.date}
          value={values.date}
          onChange={(e) => {
            set({ date: e.target.value });
          }}
          error={fieldErrors.date}
        />
        <TextField
          label={isFlow ? strings.movement.amount : strings.movement.balance}
          help={isFlow ? undefined : strings.movement.balanceHelp}
          inputMode="decimal"
          autoComplete="off"
          value={values.amount}
          onChange={(e) => {
            set({ amount: e.target.value });
          }}
          error={fieldErrors.amount}
        />
        {isFlow && (
          <TextField
            label={strings.movement.balanceAfter}
            help={strings.movement.balanceAfterHelp}
            optional
            inputMode="decimal"
            autoComplete="off"
            value={values.balanceAfter}
            onChange={(e) => {
              set({ balanceAfter: e.target.value });
            }}
            error={fieldErrors.balanceAfter}
          />
        )}

        {preview && !preview.ok && (
          <Notice tone="error">
            {issueMessages(preview.issues).map((message) => (
              <p key={message}>{message}</p>
            ))}
          </Notice>
        )}
        {previewLines.length > 0 && (
          <section aria-labelledby="preview-title">
            <Notice>
              <p id="preview-title" className="mb-1 font-medium">
                {strings.movement.previewTitle}
              </p>
              {previewLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Notice>
          </section>
        )}
        {saveErrors.length > 0 && <Notice tone="error">{saveErrors.join(' ')}</Notice>}

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {strings.common.save}
          </Button>
          <ButtonLink variant="ghost" to={accountPath}>
            {strings.common.cancel}
          </ButtonLink>
        </div>
      </form>

      {editing && !isInitial && (
        <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <ConfirmButton
            label={strings.movement.deleteMovement}
            warning={strings.movement.deleteWarning}
            onConfirm={() => {
              void remove();
            }}
          />
        </section>
      )}
    </div>
  );
}

export function MovementFormPage() {
  const { accountId = '', eventId } = useParams();
  const account = useAccount(accountId);
  const events = useAccountEvents(accountId);

  if (account === undefined || events === undefined) return <p>{strings.common.loading}</p>;
  if (account === null) return <Notice tone="error">{strings.account.notFound}</Notice>;

  const editing = eventId ? events.find((e) => e.id === eventId) : undefined;
  if (eventId && !editing) {
    return <Notice tone="error">{strings.errors.repository('EVENT_NOT_FOUND')}</Notice>;
  }
  const title = !editing
    ? strings.movement.newTitle
    : events[0]?.id === editing.id
      ? strings.movement.editInitialTitle
      : strings.movement.editTitle;

  return (
    <>
      <PageHeader title={title} backTo={`/accounts/${account.id}`}>
        <p className="text-sm text-slate-600 dark:text-slate-400">{account.name}</p>
      </PageHeader>
      <MovementForm
        key={editing?.id ?? 'new'}
        account={account}
        events={events}
        {...(editing ? { editing } : {})}
      />
    </>
  );
}
