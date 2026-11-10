import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { disconnectDatabase, getPrismaClient, getIdentityRepository } from '../../../src/core/database/database.js';

test('rejects identity synchronization when DATABASE_URL is missing', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const repository = getIdentityRepository();

    await assert.rejects(
      repository.synchronizeExistingIdentity({
        uid: 'firebase-user-1',
        email: 'user@example.com',
        emailVerified: true
      }),
      /Database is unavailable/
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('reuses the instance client and disposes the external pool on explicit shutdown', async t => {
  const previousUrl = process.env.DATABASE_URL;
  const end = t.mock.method(pg.Pool.prototype, 'end');
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test?sslmode=disable';
  try {
    const client = getPrismaClient();
    getIdentityRepository();
    assert.equal(getPrismaClient(), client);
    // Connecting the adapter starts Prisma without acquiring a database socket.
    await client.$connect();
    assert.equal(end.mock.callCount(), 0);
    await disconnectDatabase();
    assert.equal(end.mock.callCount(), 1);
    assert.notEqual(getPrismaClient(), client);
    await getPrismaClient().$connect();
    await disconnectDatabase();
    assert.equal(end.mock.callCount(), 2);
  } finally {
    await disconnectDatabase();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
