import { ApolloProvider } from '@apollo/client/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/providers/AuthProvider';
import { createMoneyHubApolloClient } from '@/services/apollo';
import { firebaseAuthService } from '@/services/firebaseAuthService';

const apolloClient = createMoneyHubApolloClient(() =>
  firebaseAuthService.getIdToken()
);

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <StatusBar style="dark" />
      <AuthProvider service={firebaseAuthService}>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ApolloProvider>
  );
}
