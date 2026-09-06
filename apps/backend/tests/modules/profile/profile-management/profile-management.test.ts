import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GraphQLError } from 'graphql';
import {
  getMyProfile,
  updateMyProfile,
  type ProfileRepository
} from '../../../../src/modules/profile/profile-management/profile-management.js';
import { typeDefs } from '../../../../src/core/graphql/graphql.js';

const profile = {
  id: 'profile-1',
  fullName: 'Ana Souza',
  preferredCurrency: 'BRL',
  theme: 'SYSTEM'
} as const;

function verifiedContext() {
  return {
    requestId: 'request-1',
    auth: {
      uid: 'firebase-user-1',
      email: 'ana@example.com',
      emailVerified: true,
      userId: 'user-1',
      profileId: 'profile-1'
    }
  };
}

function createRepository(overrides: Partial<ProfileRepository> = {}): ProfileRepository {
  return {
    findUnique: async () => profile,
    update: async ({ data }) => ({ id: 'profile-1', ...data }),
    ...overrides
  };
}

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof GraphQLError);
  assert.equal(error.extensions.code, code);
}

describe('profile management', () => {
  test('exposes the profile query and update mutation in GraphQL', () => {
    assert.match(typeDefs, /myProfile: Profile!/);
    assert.match(typeDefs, /updateMyProfile\(input: UpdateMyProfileInput!\): Profile!/);
  });

  test('returns the persisted profile for the authenticated user', async () => {
    const result = await getMyProfile(verifiedContext(), createRepository());

    assert.deepEqual(result, profile);
  });

  test('allows an unverified user to read their own profile', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    const result = await getMyProfile(context, createRepository());

    assert.deepEqual(result, profile);
  });

  test('updates only the authenticated profile with normalized values', async () => {
    let updatedProfileId = '';
    const repository = createRepository({
      update: async ({ where, data }) => {
        updatedProfileId = where.id;
        return { id: where.id, ...data };
      }
    });

    const result = await updateMyProfile(
      verifiedContext(),
      { fullName: '  Ana Silva  ', preferredCurrency: 'USD', theme: 'DARK' },
      repository
    );

    assert.equal(updatedProfileId, 'profile-1');
    assert.deepEqual(result, {
      id: 'profile-1',
      fullName: 'Ana Silva',
      preferredCurrency: 'USD',
      theme: 'DARK'
    });
  });

  test('rejects anonymous profile access', async () => {
    await assert.rejects(
      getMyProfile({ requestId: 'request-1', auth: null }, createRepository()),
      (error) => {
        expectCode(error, 'UNAUTHENTICATED');
        return true;
      }
    );
  });

  test('rejects updates for unverified email', async () => {
    const context = verifiedContext();
    context.auth.emailVerified = false;

    await assert.rejects(
      updateMyProfile(context, { fullName: 'Ana', preferredCurrency: 'BRL', theme: 'SYSTEM' }, createRepository()),
      (error) => {
        expectCode(error, 'EMAIL_NOT_VERIFIED');
        return true;
      }
    );
  });

  test('rejects a missing local profile', async () => {
    const context = {
      ...verifiedContext(),
      auth: { ...verifiedContext().auth, profileId: null }
    };

    await assert.rejects(
      getMyProfile(context, createRepository()),
      (error) => {
        expectCode(error, 'PROFILE_NOT_FOUND');
        return true;
      }
    );
  });

  test('rejects invalid profile input', async () => {
    await assert.rejects(
      updateMyProfile(
        verifiedContext(),
        { fullName: ' ', preferredCurrency: 'GBP', theme: 'SYSTEM' },
        createRepository()
      ),
      (error) => {
        expectCode(error, 'BAD_USER_INPUT');
        return true;
      }
    );
  });
});
