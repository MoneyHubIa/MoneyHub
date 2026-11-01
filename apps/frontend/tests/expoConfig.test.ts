/// <reference types="node" />
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function loadExpoConfig(overrides: Record<string, string>) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_'))
  );

  return spawnSync(process.execPath, ['-e', `
    const { getConfig } = require('@expo/config');
    getConfig(process.cwd());
  `], {
    cwd: resolve(__dirname, '..'),
    env: {
      ...environment,
      NODE_ENV: 'production',
      EXPO_NO_DOTENV: '1',
      APP_URL: 'https://app.example.com',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-moneyhub.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-moneyhub',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'demo-app-id',
      ...overrides
    },
    encoding: 'utf8'
  });
}

describe('Expo build configuration', () => {
  test('loads real Expo configuration with public Firebase values', () => {
    const result = loadExpoConfig({});
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  test.each([
    'APP_URL',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'
  ])('stops export when Vercel redacts %s', (name) => {
    const result = loadExpoConfig({ [name]: '[SENSITIVE]' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${name} contains a Vercel redaction placeholder.`);
  });

  test('stops export when required Firebase configuration is missing', () => {
    const result = loadExpoConfig({ EXPO_PUBLIC_FIREBASE_API_KEY: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Firebase client configuration is incomplete.');
  });
});
