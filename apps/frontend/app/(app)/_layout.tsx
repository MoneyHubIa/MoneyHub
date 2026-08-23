import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { type Href, Redirect, Stack, usePathname, useRouter } from 'expo-router';
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
  const isEmailVerified = Boolean(user?.emailVerified);
  const { data, loading: apolloLoading } = useQuery<{ me: { id: string; needsProfileBootstrap: boolean } }>(
    ME_QUERY,
    { skip: !user || !isEmailVerified }
  );
  const pathname = usePathname();

  const isInitialLoading = isEmailVerified && apolloLoading && !data;
  const needsBootstrap = data?.me?.needsProfileBootstrap;
  const isOnboarding = pathname.includes('onboarding');
  const isVerifyEmail = pathname.includes('verify-email');

  useEffect(() => {
    if (authLoading || !user) return;

    if (!isEmailVerified) {
      if (!isVerifyEmail) {
        router.replace('/verify-email' as Href);
      }
      return;
    }

    if (apolloLoading) return;

    if (needsBootstrap && !isOnboarding) {
      router.replace('/onboarding' as Href);
    } else if (needsBootstrap === false && (isOnboarding || isVerifyEmail)) {
      router.replace('/(app)');
    }
  }, [authLoading, apolloLoading, user, isEmailVerified, needsBootstrap, isOnboarding, isVerifyEmail, router]);

  if (authLoading || (user && isInitialLoading)) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
