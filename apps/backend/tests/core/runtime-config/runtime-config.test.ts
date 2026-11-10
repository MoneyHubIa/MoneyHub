import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  loadRootEnvironment,
  loadRuntimeConfig,
  loadDatabasePoolMax,
  loadTrustProxyHops
} from '../../../src/core/runtime-config/runtime-config.js';

describe('runtime configuration', () => {
  test('uses small instance pools and trusts only the Vercel proxy by default', () => {
    assert.equal(loadDatabasePoolMax({}), 2);
    assert.equal(loadDatabasePoolMax({ DATABASE_POOL_MAX: '4' }), 4);
    assert.equal(loadTrustProxyHops({}), 0);
    assert.equal(loadTrustProxyHops({ NODE_ENV: 'production' }), 0);
    assert.equal(loadTrustProxyHops({ VERCEL: '1' }), 1);
    assert.equal(loadTrustProxyHops({ VERCEL: '1', TRUST_PROXY_HOPS: '0' }), 0);
    assert.equal(loadTrustProxyHops({ TRUST_PROXY_HOPS: '2' }), 2);
  });

  test('rejects unsafe or invalid pool and proxy configuration without echoing values', () => {
    for (const raw of ['', ' ', '-1', '1.5', 'true', 'Infinity', '1e2', '9007199254740992', 'secret-value']) {
      assert.throws(() => loadDatabasePoolMax({ DATABASE_POOL_MAX: raw }), { message: 'DATABASE_POOL_MAX must be an integer greater than or equal to 1.' });
      assert.throws(() => loadTrustProxyHops({ TRUST_PROXY_HOPS: raw }), { message: 'TRUST_PROXY_HOPS must be an integer greater than or equal to 0.' });
    }
    assert.throws(() => loadDatabasePoolMax({ DATABASE_POOL_MAX: '0' }));
    assert.throws(() => loadRuntimeConfig({ APP_URL: 'https://example.test', FIREBASE_WEB_API_KEY: 'test', DATABASE_POOL_MAX: '0' }));
  });

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
