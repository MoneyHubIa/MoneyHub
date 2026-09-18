import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? '')
  )).toEqual([]);
});
