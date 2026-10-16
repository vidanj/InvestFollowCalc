import { expect, test, type Page } from '@playwright/test';
import { trackCspViolations } from './csp';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function createAccount(page: Page) {
  await page.getByRole('link', { name: 'Nueva cuenta' }).click();
  await page.getByLabel('Nombre').fill('Ahorro');
  await page.getByLabel('Saldo actual').fill('10,000');
  await page.getByLabel('Fecha de ese saldo').fill(daysAgo(11));
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('link', { name: 'Registrar movimiento' }).click();
  await page.getByLabel('Saldo de la cuenta').fill('10,001');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();
}

test('ships an installable manifest with real icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/InvestFollowCalc/manifest.webmanifest');

  const manifest = (await (await request.get(href ?? '')).json()) as {
    name: string;
    display: string;
    start_url: string;
    scope: string;
    lang: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({
    name: 'InvestFollowCalc',
    display: 'standalone',
    start_url: '/InvestFollowCalc/',
    scope: '/InvestFollowCalc/',
    lang: 'es-MX',
  });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of [...manifest.icons, { src: 'icons/apple-touch-icon-180.png' }]) {
    const response = await request.get(`/InvestFollowCalc/${icon.src}`);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('never talks to another origin and never violates the CSP', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });
  const cspViolations = await trackCspViolations(page);

  await page.goto('./');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /default-src 'self'.*connect-src 'self'/,
  );
  await createAccount(page);
  await page.getByText('Saldo y capital aportado').first().waitFor();
  for (const path of ['./', './#/backup', './#/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.getByRole('radio', { name: 'Oscuro' }).check({ force: true });

  expect(external).toEqual([]);
  expect(cspViolations).toEqual([]);
});

test('works offline once loaded, data included', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first visit installs the service worker; it controls the page from the next load on.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await createAccount(page);
  const accountUrl = page.url();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ahorro' })).toBeVisible();
    // Lazily loaded chunks (charts) come from the precache too.
    await expect(page.getByText('Saldo y capital aportado').first()).toBeVisible();

    await page.goto('./');
    await expect(page.getByRole('link', { name: /Ahorro/ })).toContainText('+$1.00');
    await page.goto(accountUrl);
    await expect(page.getByText('Ganancia acumulada')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
