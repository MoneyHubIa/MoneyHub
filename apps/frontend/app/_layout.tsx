import { gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/providers/AuthProvider';
import { createMoneyHubApolloClient } from '@/services/apollo';
import { firebaseAuthService } from '@/services/firebaseAuthService';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

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

function RootContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider
        service={firebaseAuthService}
        validateSession={validateBackendSession}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </ApolloProvider>
  );
}
