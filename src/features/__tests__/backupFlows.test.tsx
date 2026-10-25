import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, MIN_PASSWORD_LENGTH } from '../../backup/backup';
import { saveBackupFile } from '../../backup/fileSave';
import type { Repository } from '../../db/repository';
import { strings } from '../../i18n/es-MX';
import { createTestRepository, daysAgo, renderRoute } from '../../test/renderApp';

// The file hand-off is browser-only (picker / share sheet / download): capture it instead.
const { saved } = vi.hoisted(() => ({ saved: [] as { fileName: string; text: string }[] }));
vi.mock('../../backup/fileSave', () => ({
  saveBackupFile: vi.fn((fileName: string, text: string) => {
    saved.push({ fileName, text });
    return Promise.resolve('downloaded');
  }),
}));

const PASSWORD = 'una contraseña larga';
// Exports run the real 600,000-iteration key derivation.
const SLOW = 20_000;
const t = strings.backup;

beforeEach(() => {
  saved.length = 0;
  vi.mocked(saveBackupFile).mockClear();
});

async function seed(repository: Repository, name = 'Ahorro') {
  const account = await repository.createAccount({
    name,
    currency: 'MXN',
    color: '#2a78d6',
    initialBalance: 1_000_000,
    initialDate: daysAgo(30),
  });
  await repository.addEvent(account.id, { type: 'balance', date: daysAgo(10), balance: 1_000_100 });
  return account;
}

async function backupTextOf(repository: Repository): Promise<string> {
  const { text } = await createBackup(await repository.exportData(), PASSWORD, {
    now: new Date().toISOString(),
    appVersion: 'test',
    iterations: 1_000,
  });
  return text;
}

describe('exporting a backup', () => {
  it(
    'encrypts all data, hands over the file and records the backup',
    async () => {
      const repository = createTestRepository();
      await seed(repository);
      const { user } = renderRoute('/backup', repository);

      expect(await screen.findByText(t.neverBackedUp)).toBeVisible();
      await user.type(screen.getByLabelText(t.password), PASSWORD);
      await user.type(screen.getByLabelText(t.confirmPassword), PASSWORD);
      await user.click(screen.getByRole('button', { name: t.createButton }));

      await waitFor(
        () => {
          expect(saved).toHaveLength(1);
        },
        { timeout: SLOW },
      );
      expect(await screen.findByText(t.downloaded(saved[0]?.fileName ?? ''))).toBeVisible();
      expect(saved[0]?.fileName).toMatch(/^investfollowcalc-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
      expect(saved[0]?.text).not.toContain('Ahorro');
      expect(await repository.getMeta('lastBackupAt')).toBeDefined();
      expect(await screen.findByText(/Último respaldo en este dispositivo/)).toBeVisible();
    },
    SLOW,
  );

  it('validates the password before encrypting', async () => {
    const { user } = renderRoute('/backup');

    await user.type(await screen.findByLabelText(t.password), 'corta');
    await user.click(screen.getByRole('button', { name: t.createButton }));
    expect(screen.getByText(t.passwordTooShort(MIN_PASSWORD_LENGTH))).toBeVisible();

    await user.clear(screen.getByLabelText(t.password));
    await user.type(screen.getByLabelText(t.password), PASSWORD);
    await user.type(screen.getByLabelText(t.confirmPassword), 'otra contraseña');
    await user.click(screen.getByRole('button', { name: t.createButton }));
    expect(screen.getByText(t.passwordMismatch)).toBeVisible();
    expect(saveBackupFile).not.toHaveBeenCalled();
  });

  it(
    'does not count a cancelled save as a backup',
    async () => {
      vi.mocked(saveBackupFile).mockResolvedValueOnce('cancelled');
      const repository = createTestRepository();
      await seed(repository);
      const { user } = renderRoute('/backup', repository);

      await user.type(await screen.findByLabelText(t.password), PASSWORD);
      await user.type(screen.getByLabelText(t.confirmPassword), PASSWORD);
      await user.click(screen.getByRole('button', { name: t.createButton }));

      expect(await screen.findByText(t.cancelled, {}, { timeout: SLOW })).toBeVisible();
      expect(await repository.getMeta('lastBackupAt')).toBeUndefined();
    },
    SLOW,
  );
});

describe('importing a backup', () => {
  it('previews the backup and replaces this device data only after confirming', async () => {
    const source = createTestRepository();
    await seed(source, 'Desde el otro teléfono');
    const text = await backupTextOf(source);

    const target = createTestRepository();
    await seed(target, 'Dato viejo');
    const { user } = renderRoute('/backup', target);

    await user.upload(
      await screen.findByLabelText(t.file),
      new File([text], 'respaldo.json', { type: 'application/json' }),
    );
    await user.type(screen.getByLabelText(t.importPassword), PASSWORD);
    await user.click(screen.getByRole('button', { name: t.readButton }));

    const preview = (await screen.findByRole('heading', { name: t.previewTitle }))
      .parentElement as HTMLElement;
    expect(within(preview).getByText(/1 cuenta y 2 movimientos/)).toBeVisible();
    expect(within(preview).getByText(/Desde el otro teléfono/)).toBeVisible();
    expect(within(preview).getByText(t.replaceWarning(true))).toBeVisible();
    expect((await target.listAccounts()).map((a) => a.name)).toEqual(['Dato viejo']);

    await user.click(within(preview).getByRole('button', { name: t.replaceButton }));
    await user.click(within(preview).getByRole('button', { name: t.replaceButton }));

    expect(await screen.findByText(t.imported(1))).toBeVisible();
    expect((await target.listAccounts()).map((a) => a.name)).toEqual(['Desde el otro teléfono']);
  });

  it('explains a wrong password and changes nothing', async () => {
    const source = createTestRepository();
    await seed(source);
    const text = await backupTextOf(source);
    const target = createTestRepository();
    await seed(target, 'Intacta');
    const { user } = renderRoute('/backup', target);

    await user.upload(await screen.findByLabelText(t.file), new File([text], 'r.json'));
    await user.type(screen.getByLabelText(t.importPassword), 'no es la contraseña');
    await user.click(screen.getByRole('button', { name: t.readButton }));

    expect(await screen.findByText(t.error('WRONG_PASSWORD_OR_CORRUPT'))).toBeVisible();
    expect(screen.queryByRole('heading', { name: t.previewTitle })).toBeNull();
    expect((await target.listAccounts()).map((a) => a.name)).toEqual(['Intacta']);
  });

  it('rejects files that are not backups, and asks for a file first', async () => {
    const { user } = renderRoute('/backup');

    await user.click(await screen.findByRole('button', { name: t.readButton }));
    expect(screen.getByText(t.fileRequired)).toBeVisible();

    await user.upload(screen.getByLabelText(t.file), new File(['{"hola":1}'], 'otro.json'));
    await user.click(screen.getByRole('button', { name: t.readButton }));
    expect(await screen.findByText(t.error('NOT_A_BACKUP'))).toBeVisible();
  });
});

describe('backup reminder', () => {
  it('asks for a first backup and goes away once there is one', async () => {
    const repository = createTestRepository();
    await seed(repository);
    renderRoute('/', repository);

    expect(await screen.findByText(t.reminderNever)).toBeVisible();
    await repository.markBackedUp();
    await waitFor(() => {
      expect(screen.queryByText(t.reminderNever)).toBeNull();
    });
  });

  it('stays quiet without data', async () => {
    renderRoute('/');
    await screen.findByText(strings.accounts.emptyTitle);
    expect(screen.queryByText(t.reminderNever)).toBeNull();
  });
});

describe('deleting all data', () => {
  it('requires typing the confirmation word', async () => {
    const repository = createTestRepository();
    await seed(repository);
    const { user } = renderRoute('/settings', repository);
    const s = strings.settings;

    await user.click(await screen.findByRole('button', { name: s.deleteAll }));
    const confirm = screen.getByRole('button', { name: s.confirmDeleteAll });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('link', { name: t.reminderAction })).toHaveAttribute('href', '/backup');

    await user.type(screen.getByLabelText(s.confirmPrompt), 'borrar');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByText(s.deleted)).toBeVisible();
    expect(await repository.exportData()).toEqual({
      accounts: [],
      events: [],
      budgetItems: [],
      credits: [],
      settings: {},
    });
  });
});
