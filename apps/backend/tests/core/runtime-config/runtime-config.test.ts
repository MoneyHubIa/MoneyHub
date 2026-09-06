import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  loadRootEnvironment,
  loadRuntimeConfig
} from '../../../src/core/runtime-config/runtime-config.js';

describe('runtime configuration', () => {
  test('normalizes the single public application URL', () => {
    const config = loadRuntimeConfig({
      APP_URL: 'https://moneyhub.example/',
      FIREBASE_WEB_API_KEY: 'firebase-web-key'
    });

    assert.equal(config.appUrl.toString(), 'https://moneyhub.example/');
    assert.equal(config.firebaseWebApiKey, 'firebase-web-key');
    assert.equal('resendApiKey' in config, false);
    assert.equal('resendFromEmail' in config, false);
  });

  test('requires the single public application URL', () => {
    assert.throws(() => loadRuntimeConfig({}), /APP_URL is required/);
  });

  test('requires Firebase Web API key at startup', () => {
    assert.throws(
      () => loadRuntimeConfig({
        APP_URL: 'https://moneyhub.example'
      }),
      /FIREBASE_WEB_API_KEY is required/
    );
    assert.throws(
      () => loadRuntimeConfig({
        APP_URL: 'https://moneyhub.example',
        FIREBASE_WEB_API_KEY: '   '
      }),
      /FIREBASE_WEB_API_KEY is required/
    );
  });

  test('prefers the repository root environment over the backend environment', () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'moneyhub-runtime-'));
    const backendDirectory = join(repositoryRoot, 'apps', 'backend');
    mkdirSync(backendDirectory, { recursive: true });
    writeFileSync(join(repositoryRoot, '.env'), 'APP_URL=http://root.test:3000\n');
    writeFileSync(join(backendDirectory, '.env'), 'APP_URL=http://backend.test:3000\n');
    const previousAppUrl = process.env.APP_URL;

    try {
      loadRootEnvironment(backendDirectory);
      assert.equal(process.env.APP_URL, 'http://root.test:3000');
    } finally {
      if (previousAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previousAppUrl;
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});
