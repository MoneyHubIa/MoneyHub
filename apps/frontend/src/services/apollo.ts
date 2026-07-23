import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
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

export function createMoneyHubApolloClient(getIdToken: GetIdToken) {
  const endpoint = resolveRuntimeUrl(
    process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT ?? 'http://localhost:3000/graphql',
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
