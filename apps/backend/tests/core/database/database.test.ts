import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIdentityRepository } from '../../../src/core/database/database.js';

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
