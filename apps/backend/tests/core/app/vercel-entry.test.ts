import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import request from 'supertest';

const previous = {
  APP_URL: process.env.APP_URL,
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST
};

process.env.APP_URL = 'https://moneyhub.example';
process.env.FIREBASE_WEB_API_KEY = 'test-web-key';
process.env.FIREBASE_PROJECT_ID = 'demo-moneyhub';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('Vercel entry exports an API-only Express application', async () => {
  const { default: app } = await import('../../../app.js');
  try {
    const health = await request(app).get('/health');
    const root = await request(app).get('/').set('accept', 'text/html');

    assert.equal(health.status, 200);
    assert.equal(root.status, 404);
  } finally {
    await app.locals.stop?.();
  }
});
