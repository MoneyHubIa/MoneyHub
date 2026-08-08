import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveRuntimeUrl } from './runtimeUrl';

type GetIdToken = () => Promise<string | null>;
type RequestHeaders = Readonly<Record<string, string>>;

export async function createAuthorizationHeaders(
  getIdToken: GetIdToken,
  headers: RequestHeaders
): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token
    ? { ...headers, authorization: `Bearer ${token}` }
    : { ...headers };
}

export function resolveGraphqlEndpoint(
  appUrl: unknown,
  platform: string,
  isDevelopment = __DEV__
): string {
  if (platform === 'web' && !isDevelopment) {
    return '/graphql';
  }

  if (typeof appUrl !== 'string' || !appUrl) {
    throw new Error('APP_URL is required in the Expo configuration.');
  }

  return resolveRuntimeUrl(new URL('/graphql', appUrl).toString(), platform);
}

export function createMoneyHubApolloClient(getIdToken: GetIdToken) {
  const endpoint = resolveGraphqlEndpoint(
    process.env.EXPO_PUBLIC_APP_URL ?? Constants.expoConfig?.extra?.appUrl,
    Platform.OS
  );
  const authorizationLink = new SetContextLink(async (previousContext) => ({
    headers: await createAuthorizationHeaders(
      getIdToken,
      (previousContext.headers as RequestHeaders | undefined) ?? {}
    )
  }));

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authorizationLink.concat(new HttpLink({ uri: endpoint }))
  });
}
