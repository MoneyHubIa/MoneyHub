import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import PublicPage from '@/components/public/PublicPage';
import { useAuth } from '@/providers/AuthProvider';

export default function WebIndexRoute() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect href="/(app)" />;
  return <PublicPage page="apresentacao" />;
}
