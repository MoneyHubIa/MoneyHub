import { expect, test } from '@playwright/test';

const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

for (const route of publicRoutes) {
  test(`@smoke renders ${route}`, async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });
}

test('@smoke renders exported login controls after a deep-link refresh', async ({ page }) => {
  const assetResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (response) => {
    if (/\.(?:js|css)(?:\?|$)/.test(response.url())) {
      assetResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto('/login');
  await page.reload();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  expect(assetResponses.length).toBeGreaterThan(0);
  expect(assetResponses.every((asset) => asset.status >= 200 && asset.status < 400)).toBe(true);
});

test('@smoke verifies backend health and GraphQL', async ({ request }) => {
  await expect((await request.get('http://127.0.0.1:3000/health')).json()).resolves.toMatchObject({
    success: true,
    data: { status: 'ok' }
  });
  const response = await request.post('http://127.0.0.1:3000/graphql', {
    data: { query: '{ health { status } }' }
  });
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ data: { health: { status: 'ok' } } });
});
