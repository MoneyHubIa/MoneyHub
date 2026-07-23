import { useRouter } from 'expo-router';
import { AuthScreen } from '@/components/AuthScreen';
import { useAuth } from '@/providers/AuthProvider';
import { analytics } from '@/services/analyticsRuntime';

export default function RegisterRoute() {
  const { register } = useAuth();
  const router = useRouter();

  return (
    <AuthScreen
      mode="register"
      onSubmit={async (email, password) => {
        await register(email, password);
        await analytics.logEvent('signup', { method: 'email' });
        router.replace('/');
      }}
    />
  );
}
