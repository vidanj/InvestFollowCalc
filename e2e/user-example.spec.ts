import { expect, test, type Page } from '@playwright/test';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const stat = (page: Page, label: string) => page.locator('dt', { hasText: label }).locator('..');

async function expectExampleTotals(page: Page) {
  await expect(stat(page, 'Ganancia total')).toContainText('+$50.00');
  await expect(stat(page, 'Capital aportado')).toContainText('$10,500.00');
  await expect(stat(page, 'Saldo actual')).toContainText('$10,550.00');
  await expect(page.getByText('+$49.00')).toBeVisible();
}

test('registers the user example from the UI and keeps it after reloading', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Nueva cuenta' }).click();
  await page.getByLabel('Nombre').fill('Ahorro');
  await page.getByLabel('Saldo actual').fill('10,000');
  await page.getByLabel('Fecha de ese saldo').fill(daysAgo(32));
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();

  // 11 days later the account shows 10,001.
  await page.getByRole('link', { name: 'Registrar movimiento' }).click();
  await page.getByLabel('Saldo de la cuenta').fill('10,001');
  await page.getByLabel('Fecha').fill(daysAgo(21));
  await expect(page.getByText('Generaste $1.00 en 11 días (1.6 semanas).')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();

  // Deposit 500; right after it the account shows 10,501.
  await page.getByRole('link', { name: 'Registrar movimiento' }).click();
  await page.getByText('Aportación', { exact: true }).click();
  await page.getByLabel('Monto').fill('500');
  await page.getByLabel('Saldo después del movimiento').fill('10,501');
  await page.getByLabel('Fecha').fill(daysAgo(18));
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();

  // Today the account shows 10,550: 49 more, 50 in total.
  await page.getByRole('link', { name: 'Registrar movimiento' }).click();
  await page.getByLabel('Saldo de la cuenta').fill('10,550');
  await expect(page.getByText('Generaste $49.00 en 18 días (2.6 semanas).')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expectExampleTotals(page);

  await page.reload();
  await expectExampleTotals(page);
});
