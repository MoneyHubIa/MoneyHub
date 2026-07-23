import { useRouter } from 'expo-router';
import { AuthScreen } from '@/components/AuthScreen';
import { useAuth } from '@/providers/AuthProvider';
import { analytics } from '@/services/analyticsRuntime';

export default function LoginRoute() {
  const { login } = useAuth();
  const router = useRouter();

  return (
    <AuthScreen
      mode="login"
      onSubmit={async (email, password) => {
        await login(email, password);
        await analytics.logEvent('login', { method: 'email' });
        router.replace('/');
      }}
    />
  );
}
