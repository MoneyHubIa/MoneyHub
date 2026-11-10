import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../../src/core/app/app.js';
import { appLogger } from '../../../src/core/http-logger/http-logger.js';
import { createFirebaseVerifier } from '../../../src/modules/auth/authentication/auth.js';
import { Prisma } from '../../../src/generated/prisma/client.js';

test('database saturation returns 503, retains valid credentials and logs only safe metadata', async t => {
  const privateDetail = 'postgresql://user:private-db-password@db/private SELECT private_column';
  const failure = new Prisma.PrismaClientKnownRequestError(privateDetail, {
    code: 'P2039', clientVersion: '7.9.0',
    meta: { modelName: 'User', driverAdapterError: new Error('driver error', { cause: {
      kind: 'postgres', code: 'XX000', message: `(EMAXCONNSESSION) max clients reached in session mode ${privateDetail}`
    } }) }
  });
  let unavailable = true;
  let synchronized = 0;
  const verifier = createFirebaseVerifier({
    verifyToken: async token => {
      assert.equal(token, 'private-valid-token');
      return { uid: 'firebase-user' };
    },
    getUser: async () => ({ uid: 'firebase-user', email: 'private@example.test', emailVerified: true }),
    identityRepository: { synchronizeExistingIdentity: async () => {
      synchronized += 1;
      if (unavailable) throw failure;
      return { userId: 'local-user', profileId: null };
    } }
  });
  const logged = t.mock.method(appLogger, 'error', () => {});
  const app = await createApp({ verifyIdToken: verifier });
  try {
    const response = await request(app).post('/graphql')
      .set('authorization', 'Bearer private-valid-token')
      .set('x-request-id', 'database-unavailable-request')
      .send({ query: '{ me { id email } }' });
    assert.equal(response.status, 503);
    assert.equal(response.body.errors[0].extensions.code, 'SERVICE_UNAVAILABLE');
    assert.equal(response.body.data, undefined);
    assert.equal(response.body.errors[0].extensions.stacktrace, undefined);
    assert.equal(synchronized, 1);
    const event = logged.mock.calls.map(call => call.arguments[0] as Record<string, unknown> | undefined).find(value => value?.event === 'authentication_failed');
    assert.deepEqual(event, {
      event: 'authentication_failed', requestId: 'database-unavailable-request',
      stage: 'identity_persistence', code: 'CONNECTION_LIMIT'
    });
    const exposed = JSON.stringify([response.body, logged.mock.calls.map(call => call.arguments)]);
    for (const secret of ['private-db-password', 'private_column', 'private-valid-token', 'private@example.test', 'Firebase ID token verification failed']) {
      assert.equal(exposed.includes(secret), false);
    }
    unavailable = false;
    const recovered = await request(app).post('/graphql')
      .set('authorization', 'Bearer private-valid-token').send({ query: '{ me { id } }' });
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.data.me.id, 'firebase-user');
    assert.equal(synchronized, 2);
  } finally { await app.locals.stop?.(); }
});

test('unexpected persistence failures return 500 while invalid tokens remain 401', async t => {
  t.mock.method(appLogger, 'error', () => {});
  t.mock.method(appLogger, 'warn', () => {});
  let synchronized = 0;
  const app = await createApp({ verifyIdToken: createFirebaseVerifier({
    verifyToken: async token => {
      if (token !== 'valid') throw new Error('private invalid token details');
      return { uid: 'user' };
    },
    getUser: async () => ({ uid: 'user', email: 'private@example.test', emailVerified: true }),
    identityRepository: { synchronizeExistingIdentity: async () => {
      synchronized += 1;
      throw new Error('private unexpected database failure');
    } }
  }) });
  try {
    const query = { query: '{ me { id } }' };
    const unexpected = await request(app).post('/graphql').set('authorization', 'Bearer valid').send(query);
    assert.equal(unexpected.status, 500);
    assert.equal(unexpected.body.errors[0].extensions.code, 'INTERNAL_SERVER_ERROR');
    const invalid = await request(app).post('/graphql').set('authorization', 'Bearer invalid').send(query);
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.errors[0].extensions.code, 'UNAUTHENTICATED');
    assert.equal(synchronized, 1);
    assert.equal(JSON.stringify([unexpected.body, invalid.body]).includes('private'), false);
  } finally { await app.locals.stop?.(); }
});
