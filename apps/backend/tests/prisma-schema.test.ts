import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../prisma/migrations/20260722230000_init_identity/migration.sql',
  import.meta.url
);

describe('identity persistence foundation', () => {
  test('defines unique Firebase identities and one profile per user', async () => {
    const schema = await readFile(schemaPath, 'utf8');

    assert.match(schema, /firebaseUid\s+String\s+@unique/);
    assert.match(schema, /email\s+String\s+@unique/);
    assert.match(schema, /userId\s+String\s+@unique/);
    assert.match(schema, /preferredCurrency\s+String\s+@default\("BRL"\)/);
  });

  test('ships an executable PostgreSQL migration for users and profiles', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    assert.match(migration, /CREATE TABLE "users"/);
    assert.match(migration, /CREATE TABLE "profiles"/);
    assert.match(migration, /CREATE UNIQUE INDEX "users_firebase_uid_key"/);
    assert.match(migration, /CREATE UNIQUE INDEX "profiles_user_id_key"/);
    assert.match(migration, /FOREIGN KEY \("user_id"\)/);
  });
});
