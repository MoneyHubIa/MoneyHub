import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertDemoEnvironment } from '../../src/demo/demo-data.js';

test('demo seed rejects missing configuration and non-demo Firebase projects', () => {
  const localEnvironment = {
    FIREBASE_PROJECT_ID: 'demo-moneyhub', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    DATABASE_URL: 'postgresql://moneyhub:moneyhub@db:5432/moneyhub?sslmode=disable'
  };
  assert.doesNotThrow(() => assertDemoEnvironment(localEnvironment));
  for (const environment of [
    {},
    { ...localEnvironment, FIREBASE_PROJECT_ID: 'production-project' },
    { ...localEnvironment, FIREBASE_AUTH_EMULATOR_HOST: '' },
    { ...localEnvironment, FIREBASE_AUTH_EMULATOR_HOST: 'remote.example:9099' },
    { ...localEnvironment, DATABASE_URL: 'postgresql://moneyhub:password@production.example/moneyhub' },
    { ...localEnvironment, DATABASE_URL: 'postgresql://moneyhub:moneyhub@db/another_database' }
  ]) {
    assert.throws(() => assertDemoEnvironment(environment), /Demo seed requires/);
  }
});
