import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/web',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure'
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
