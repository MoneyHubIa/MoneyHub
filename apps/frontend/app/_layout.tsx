import { gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/providers/AuthProvider';
import { createMoneyHubApolloClient } from '@/services/apollo';
import { firebaseAuthService } from '@/services/firebaseAuthService';

const apolloClient = createMoneyHubApolloClient(() =>
  firebaseAuthService.getIdToken()
);

const VALIDATE_SESSION_QUERY = gql`
  query ValidateSession {
    me {
      id
    }
  }
`;

async function validateBackendSession() {
  const { data } = await apolloClient.query<{ me: { id: string } | null }>({
    query: VALIDATE_SESSION_QUERY,
    fetchPolicy: 'no-cache'
  });
  if (!data?.me) throw new Error('Backend did not return an authenticated user.');
}

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <StatusBar style="dark" />
      <AuthProvider
        service={firebaseAuthService}
        validateSession={validateBackendSession}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ApolloProvider>
  );
}
