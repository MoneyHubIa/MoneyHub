import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';

const ME_QUERY = gql`
  query Me {
    me {
      id
      needsProfileBootstrap
    }
  }
`;

export default function AuthenticatedLayout() {
  const { loading: authLoading, user } = useAuth();
  const { data, loading: apolloLoading } = useQuery<{ me: { id: string, needsProfileBootstrap: boolean } }>(ME_QUERY, { skip: !user });
  const pathname = usePathname();

  if (authLoading || (user && apolloLoading)) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;

  const needsBootstrap = data?.me?.needsProfileBootstrap;
  if (needsBootstrap && pathname !== '/onboarding') {
    return <Redirect href="/(app)/onboarding" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
