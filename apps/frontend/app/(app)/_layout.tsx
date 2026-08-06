import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
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
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const { data, loading: apolloLoading } = useQuery<{ me: { id: string; needsProfileBootstrap: boolean } }>(ME_QUERY, { skip: !user });
  const pathname = usePathname();

  const isInitialLoading = apolloLoading && !data;
  const needsBootstrap = data?.me?.needsProfileBootstrap;
  const isOnboarding = pathname.includes('onboarding');

  useEffect(() => {
    if (authLoading || apolloLoading || !user) return;

    if (needsBootstrap && !isOnboarding) {
      router.replace('/(app)/onboarding');
    } else if (needsBootstrap === false && isOnboarding) {
      router.replace('/(app)');
    }
  }, [authLoading, apolloLoading, user, needsBootstrap, isOnboarding, router]);

  if (authLoading || (user && isInitialLoading)) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
