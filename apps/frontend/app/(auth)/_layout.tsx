import { Redirect, Stack } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';

export default function AnonymousLayout() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
