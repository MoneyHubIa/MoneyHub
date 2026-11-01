import { Redirect } from 'expo-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/providers/AuthProvider';
import { resolveSessionRoute } from '@/services/sessionRouting';
import type { PublicPageProps } from './content';

// Native deep links keep the existing session flow instead of loading the Web site.
export default function PublicPage(props: PublicPageProps) {
  void props;
  const { loading, user } = useAuth();
  const route = resolveSessionRoute(loading, user);
  return route ? <Redirect href={route} /> : <LoadingScreen />;
}
