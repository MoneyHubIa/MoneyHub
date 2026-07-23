import { createAuthorizationHeaders } from '../src/services/apollo';

describe('Apollo authorization', () => {
  test('requests a fresh Firebase token for every operation', async () => {
    const getIdToken = jest
      .fn()
      .mockResolvedValueOnce('token-one')
      .mockResolvedValueOnce('token-two');

    const first = await createAuthorizationHeaders(getIdToken, {
      'x-request-source': 'expo'
    });
    const second = await createAuthorizationHeaders(getIdToken, {});

    expect(first).toEqual({
      'x-request-source': 'expo',
      authorization: 'Bearer token-one'
    });
    expect(second.authorization).toBe('Bearer token-two');
    expect(getIdToken).toHaveBeenCalledTimes(2);
  });

  test('keeps public operations anonymous when there is no session', async () => {
    await expect(
      createAuthorizationHeaders(async () => null, { accept: 'application/json' })
    ).resolves.toEqual({ accept: 'application/json' });
  });
});
