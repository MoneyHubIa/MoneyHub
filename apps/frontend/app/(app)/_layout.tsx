import { Redirect, Stack } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthenticatedLayout() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
