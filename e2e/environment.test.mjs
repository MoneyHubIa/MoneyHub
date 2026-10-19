import assert from 'node:assert/strict';
import test from 'node:test';
import { createE2eEnvironment } from './environment.mjs';

test('replaces external services with local test dependencies', () => {
  const env = createE2eEnvironment({
    PATH: 'test-path',
    DATABASE_URL: 'postgresql://remote/production',
    LLM_BASE_URL: 'https://provider.example',
    LLM_API_KEY: 'sensitive',
    OPENAI_API_KEY: 'sensitive'
  });

  assert.equal(env.PATH, 'test-path');
  assert.equal(env.FIREBASE_PROJECT_ID, 'demo-moneyhub');
  assert.equal(new URL(env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(env.DATABASE_URL).searchParams.get('sslmode'), 'disable');
  assert.equal(env.LLM_PROVIDER, 'mock');
  assert.equal(env.LLM_BASE_URL, undefined);
  assert.equal(env.LLM_API_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.EXPO_NO_DOTENV, '1');
});

test('uses a bounded request budget for the shared local E2E client', () => {
  const env = createE2eEnvironment({ RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '999999' });
  assert.equal(env.RATE_LIMIT_MAX, '10000');
  assert.equal(env.RATE_LIMIT_WINDOW_MS, '900000');
});
