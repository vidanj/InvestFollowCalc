import { expect, test } from '@playwright/test';

test('app shell renders from the production build', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { level: 1, name: 'InvestFollowCalc' })).toBeVisible();
});
