import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
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
