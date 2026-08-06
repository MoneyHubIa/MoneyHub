import { AuthScreen } from '@/components/AuthScreen';
import { useAuth } from '@/providers/AuthProvider';
import { analytics } from '@/services/analyticsRuntime';

export default function LoginRoute() {
  const { login } = useAuth();

  return (
    <AuthScreen
      mode="login"
      onSubmit={async (email, password) => {
        await login(email, password);
        await analytics.logEvent('login', { method: 'email' });
      }}
    />
  );
}

