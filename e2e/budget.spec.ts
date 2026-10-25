import { expect, test, type Page } from '@playwright/test';
import { trackCspViolations } from './csp';

const stat = (page: Page, label: string) =>
  page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('..');

function firstOfThisMonth(): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

async function addItem(
  page: Page,
  kind: 'Agregar ingreso' | 'Agregar gasto',
  name: string,
  amount: string,
  category?: string,
) {
  await page.getByRole('link', { name: kind }).click();
  await page.getByLabel('Concepto').fill(name);
  await page.getByLabel('Monto').fill(amount);
  if (category) await page.getByLabel('Categoría').selectOption({ label: category });
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto', exact: true })).toBeVisible();
}

async function expectMonthTotals(page: Page) {
  await expect(stat(page, 'Ingresos')).toContainText('$30,000.00');
  // 8,000 rent + 85.50 coffee + 1,000 of the interest-free credit.
  await expect(stat(page, 'Gastos')).toContainText('$9,085.50');
  await expect(stat(page, 'Te queda')).toContainText('+$20,914.50');
  await expect(stat(page, 'Pagos a créditos')).toContainText('$1,000.00');
}

test('tracks a month of income, expenses and a credit, and keeps it after reloading', async ({
  page,
}) => {
  const violations = await trackCspViolations(page);
  await page.goto('./');
  await page.getByRole('link', { name: 'Presupuesto' }).first().click();
  await expect(page.getByText('Nada registrado en este mes')).toBeVisible();

  await addItem(page, 'Agregar ingreso', 'Sueldo', '30,000');
  await addItem(page, 'Agregar gasto', 'Renta', '8,000', 'Vivienda');
  await addItem(page, 'Agregar gasto', 'Café', '85.50', 'Gastos hormiga');

  // 12,000 interest-free in 12 monthly payments, the first one this month.
  await page.getByRole('link', { name: 'Nuevo crédito' }).click();
  await page.getByLabel('Nombre').fill('Televisión');
  await page.getByLabel('Monto del crédito').fill('12,000');
  await page.getByLabel('Tasa de interés anual (%)').fill('0');
  await page.getByText('Me cobran IVA sobre los intereses (16%)').click();
  await page.getByLabel('Fecha del primer pago').fill(firstOfThisMonth());
  await page.getByLabel('Número de pagos').fill('12');
  await expect(page.getByText('Pago fijo: $1,000.00 al mes.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('heading', { name: 'Televisión' })).toBeVisible();
  await expect(stat(page, 'Total a pagar')).toContainText('$12,000.00');
  await expect(page.getByRole('heading', { name: 'Tabla de pagos' })).toBeVisible();

  await page.getByRole('link', { name: 'Volver' }).click();
  await expectMonthTotals(page);
  await expect(page.getByText('Pago 1 de 12')).toBeVisible();
  await expect(
    page.getByRole('figure').filter({ hasText: '¿En qué se va tu dinero?' }),
  ).toBeVisible();

  await page.reload();
  await expectMonthTotals(page);
  expect(violations).toEqual([]);
});
