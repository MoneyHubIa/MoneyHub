import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';
import { resolveSessionRoute } from '@/services/sessionRouting';

export default function IndexRoute() {
  const { loading, user } = useAuth();
  const route = resolveSessionRoute(loading, user);
  return route ? <Redirect href={route} /> : <LoadingScreen />;
}
