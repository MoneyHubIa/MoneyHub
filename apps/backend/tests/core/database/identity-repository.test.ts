import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createTestDatabase } from '../../helpers/pglite-prisma.js';
import { createIdentityRepository } from '../../../src/core/database/database.js';

test('identity synchronization uses one joined lookup and writes only changed metadata', async t => {
  let queries: string[] = [];
  const database = await createTestDatabase(query => queries.push(query));
  const db = database.prisma;
  const repository = createIdentityRepository(db);
  try {
    const verifiedAt = new Date('2026-01-01T12:00:00Z');
    const first = await db.user.create({ data: { firebaseUid: randomUUID(), email: 'first@example.test', emailVerifiedAt: verifiedAt, profile: { create: { fullName: 'First' } } }, include: { profile: true } });
    const second = await db.user.create({ data: { firebaseUid: randomUUID(), email: 'second@example.test' } });
    const identity = { uid: first.firebaseUid, email: first.email, emailVerified: true };

    await t.test('unchanged verified identities preserve timestamps with exactly one SELECT', async () => {
      queries = [];
      assert.deepEqual(await repository.synchronizeExistingIdentity(identity), { userId: first.id, profileId: first.profile!.id });
      assert.equal(queries.length, 1);
      assert.match(queries[0]!, /LEFT JOIN profiles/);
      const unchanged = await db.user.findUniqueOrThrow({ where: { id: first.id } });
      assert.equal(unchanged.emailVerifiedAt!.getTime(), verifiedAt.getTime());
      assert.equal(unchanged.updatedAt.getTime(), first.updatedAt.getTime());
    });

    await t.test('unknown identities remain absent and users without profiles return null profileId', async () => {
      queries = [];
      assert.equal(await repository.synchronizeExistingIdentity({ uid: 'missing', email: 'missing@example.test', emailVerified: true }), null);
      assert.equal(queries.length, 1);
      queries = [];
      assert.deepEqual(await repository.synchronizeExistingIdentity({ uid: second.firebaseUid, email: second.email, emailVerified: false }), { userId: second.id, profileId: null });
      assert.equal(queries.length, 1);
    });

    await t.test('email fallback updates only the matching identity and subsequent reads do not write', async () => {
      const uid = randomUUID();
      queries = [];
      assert.deepEqual(await repository.synchronizeExistingIdentity({ ...identity, uid }), { userId: first.id, profileId: first.profile!.id });
      assert.equal(queries.length, 2);
      assert.match(queries[1]!, /^UPDATE/);
      identity.uid = uid;
      queries = [];
      await repository.synchronizeExistingIdentity(identity);
      assert.equal(queries.length, 1);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: first.id } })).emailVerifiedAt!.getTime(), verifiedAt.getTime());
    });

    await t.test('email and verification changes retain timestamp semantics', async () => {
      identity.email = 'changed@example.test';
      queries = [];
      await repository.synchronizeExistingIdentity(identity);
      assert.equal(queries.length, 2);
      const changed = await db.user.findUniqueOrThrow({ where: { id: first.id } });
      assert.ok(changed.emailVerifiedAt!.getTime() > verifiedAt.getTime());
      identity.emailVerified = false;
      queries = [];
      await repository.synchronizeExistingIdentity(identity);
      assert.equal(queries.length, 2);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: first.id } })).emailVerifiedAt, null);
      queries = [];
      await repository.synchronizeExistingIdentity(identity);
      assert.equal(queries.length, 1);
      identity.emailVerified = true;
      await repository.synchronizeExistingIdentity(identity);
      assert.ok((await db.user.findUniqueOrThrow({ where: { id: first.id } })).emailVerifiedAt);
    });

    await t.test('UID match takes priority over another user email and uniqueness failures cannot switch users', async () => {
      await assert.rejects(repository.synchronizeExistingIdentity({ ...identity, email: second.email }));
      const unchanged = await db.user.findUniqueOrThrow({ where: { id: second.id } });
      assert.equal(unchanged.firebaseUid, second.firebaseUid);
      assert.equal(unchanged.emailVerifiedAt, null);
      queries = [];
      assert.deepEqual(await repository.synchronizeExistingIdentity(identity), { userId: first.id, profileId: first.profile!.id });
      assert.equal(queries.length, 1);
    });
  } finally { await database.close(); }
});
