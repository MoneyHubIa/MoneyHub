import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('backend foundation', () => {
  let app: Express;

  before(async () => {
    app = await createApp({
      verifyIdToken: async (token: string) => {
        if (token !== 'valid-token') {
          throw new Error('invalid token');
        }

        return {
          uid: 'firebase-user-1',
          email: 'user@example.com',
          emailVerified: true,
          userId: null,
          profileId: null
        };
      }
    });
  });

  after(async () => {
    await app.locals.stop?.();
  });

  test('exposes the canonical operational health route', async () => {
    const response = await request(app).get('/health');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'ok');
    assert.equal(response.body.data.service, 'moneyhub-backend');
    assert.ok(response.headers['x-request-id']);
  });

  test('serves the public GraphQL health query', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health { status service version } }' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.health, {
      status: 'ok',
      service: 'moneyhub-backend',
      version: '0.1.0'
    });
  });

  test('allows the local Expo Web origin in development', async () => {
    const developmentApp = await createApp({
      appUrl: new URL('http://example.test:3000'),
      nodeEnvironment: 'development'
    });

    const response = await request(developmentApp)
      .post('/graphql')
      .set('origin', 'http://localhost:8081')
      .send({ query: '{ health { status } }' });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers['access-control-allow-origin'],
      'http://localhost:8081'
    );
    await developmentApp.locals.stop?.();
  });

  test('serves the exported web entrypoint from the API origin', async () => {
    const frontendDistDir = fileURLToPath(
      new URL('./fixtures/web-dist', import.meta.url)
    );
    const webApp = await createApp({ frontendDistDir });

    const response = await request(webApp).get('/');

    assert.equal(response.status, 200);
    assert.match(response.text, /MoneyHub/);
    await webApp.locals.stop?.();
  });

  test('serves the web entrypoint for client-side routes', async () => {
    const frontendDistDir = fileURLToPath(
      new URL('./fixtures/web-dist', import.meta.url)
    );
    const webApp = await createApp({ frontendDistDir });

    const response = await request(webApp)
      .get('/settings')
      .set('accept', 'text/html');

    assert.equal(response.status, 200);
    assert.match(response.text, /MoneyHub/);
    await webApp.locals.stop?.();
  });

  test('keeps unknown API routes as JSON 404 responses', async () => {
    const response = await request(app)
      .get('/api/missing')
      .set('accept', 'application/json');

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  });

  test('returns null for anonymous me queries', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ me { id email emailVerified } }' });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.me, null);
  });

  test('returns Firebase identity for valid bearer tokens', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('authorization', 'Bearer valid-token')
      .send({ query: '{ me { id email emailVerified } }' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.me, {
      id: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true
    });
  });

  test('rejects invalid bearer tokens with a stable GraphQL code', async () => {
    const response = await request(app)
      .post('/graphql')
      .set('authorization', 'Bearer invalid-token')
      .send({ query: '{ me { id } }' });

    assert.equal(response.status, 401);
    assert.equal(response.body.errors[0].extensions.code, 'UNAUTHENTICATED');
  });
});
