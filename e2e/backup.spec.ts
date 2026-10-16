import { expect, test } from '@playwright/test';
import { trackCspViolations } from './csp';

const PASSWORD = 'mi contraseña segura';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

test.beforeEach(async ({ page }) => {
  // Native save dialogs and share sheets cannot be driven headless: force the download path.
  await page.addInitScript({
    content: `
      delete window.showSaveFilePicker;
      Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
    `,
  });
});

test('moves data to a "new device" through an encrypted backup', async ({ page }, testInfo) => {
  const cspViolations = await trackCspViolations(page);
  await page.goto('./');
  await page.getByRole('link', { name: 'Nueva cuenta' }).click();
  await page.getByLabel('Nombre').fill('Ahorro');
  await page.getByLabel('Saldo actual').fill('10,000');
  await page.getByLabel('Fecha de ese saldo').fill(daysAgo(11));
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('link', { name: 'Registrar movimiento' }).click();
  await page.getByLabel('Saldo de la cuenta').fill('10,001');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();

  // Export.
  await page.goto('./#/backup');
  await page.getByLabel('Contraseña para este respaldo').fill(PASSWORD);
  await page.getByLabel('Repite la contraseña').fill(PASSWORD);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Crear y guardar respaldo' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^investfollowcalc-respaldo-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backupPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(backupPath);
  await expect(page.getByText(/Respaldo descargado/)).toBeVisible();

  // Wipe this device, as if it were a new phone.
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Borrar todos los datos' }).click();
  await page.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
  await page.getByRole('button', { name: 'Borrar definitivamente' }).click();
  await expect(page.getByText('Se borraron todos los datos de este dispositivo.')).toBeVisible();
  await page.goto('./');
  await expect(page.getByText('Aún no tienes cuentas')).toBeVisible();

  // Import.
  await page.goto('./#/backup');
  await page.getByLabel('Archivo de respaldo (.json)').setInputFiles(backupPath);
  await page.getByLabel('Contraseña del respaldo a importar').fill(PASSWORD);
  await page.getByRole('button', { name: 'Leer respaldo' }).click();
  await expect(page.getByText(/1 cuenta y 2 movimientos/)).toBeVisible();
  await page.getByRole('button', { name: 'Reemplazar mis datos con este respaldo' }).click();
  await page.getByRole('button', { name: 'Reemplazar mis datos con este respaldo' }).click();
  await expect(page.getByText('Listo: se importaron 1 cuenta.')).toBeVisible();

  await page.goto('./');
  const card = page.getByRole('link', { name: /Ahorro/ });
  await expect(card).toContainText('$10,001.00');
  await expect(card).toContainText('+$1.00');

  // Encrypting, decrypting and validating ran under the strict CSP without violations.
  expect(cspViolations).toEqual([]);
});
