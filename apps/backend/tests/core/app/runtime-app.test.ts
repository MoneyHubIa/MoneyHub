import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createRuntimeApp } from '../../../src/core/app/runtime-app.js';

const applications: Array<{ locals: { stop?: () => Promise<void> } }> = [];
const environment = {
  APP_URL: 'https://moneyhub.example',
  FIREBASE_WEB_API_KEY: 'test-web-key'
};

after(async () => {
  for (const app of applications) await app.locals.stop?.();
});

describe('runtime application', () => {
  test('serves API routes without starting a port or serving web assets', async () => {
    const app = await createRuntimeApp({ environment });
    applications.push(app);

    const health = await request(app).get('/health');
    const graphql = await request(app)
      .post('/graphql')
      .send({ query: '{ health { status } }' });
    const root = await request(app).get('/').set('accept', 'text/html');

    assert.equal(health.status, 200);
    assert.equal(graphql.status, 200);
    assert.equal(graphql.body.data.health.status, 'ok');
    assert.equal(root.status, 404);
  });

  test('can serve the exported web build for the local server', async () => {
    const frontendDistDir = fileURLToPath(
      new URL('../../integration/foundation/fixtures/web-dist', import.meta.url)
    );
    const app = await createRuntimeApp({ environment, frontendDistDir });
    applications.push(app);

    const response = await request(app).get('/');

    assert.equal(response.status, 200);
    assert.match(response.text, /MoneyHub/);
  });
});
