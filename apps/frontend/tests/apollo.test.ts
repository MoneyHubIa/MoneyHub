import {
  createAuthorizationHeaders,
  createMoneyHubApolloClient,
  resolveGraphqlEndpoint
} from '../src/services/apollo';
import { Platform } from 'react-native';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: null }
}));

describe('Apollo authorization', () => {
  test('uses a relative GraphQL path in production Web builds', () => {
    expect(resolveGraphqlEndpoint('http://example.test:3000', 'web', false))
      .toBe('/graphql');
  });

  test('uses APP_URL for GraphQL while Web runs on the Metro development origin', () => {
    expect(resolveGraphqlEndpoint('http://example.test:3000', 'web', true))
      .toBe('http://example.test:3000/graphql');
  });

  test('creates the Web client without requiring APP_URL in Expo configuration', () => {
    const originalPlatform = Platform.OS;
    const originalAppUrl = process.env.EXPO_PUBLIC_APP_URL;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    process.env.EXPO_PUBLIC_APP_URL = 'http://example.test:3000';

    try {
      expect(() => createMoneyHubApolloClient(async () => null)).not.toThrow();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform
      });
      if (originalAppUrl === undefined) delete process.env.EXPO_PUBLIC_APP_URL;
      else process.env.EXPO_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  test('resolves GraphQL against the single app URL on native platforms', () => {
    expect(resolveGraphqlEndpoint('http://example.test:3000', 'ios'))
      .toBe('http://example.test:3000/graphql');
    expect(resolveGraphqlEndpoint('http://localhost:3000', 'android'))
      .toBe('http://10.0.2.2:3000/graphql');
  });

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
