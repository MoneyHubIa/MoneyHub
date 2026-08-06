import { AuthScreen } from '@/components/AuthScreen';
import { useAuth } from '@/providers/AuthProvider';
import { analytics } from '@/services/analyticsRuntime';

export default function RegisterRoute() {
  const { register } = useAuth();

  return (
    <AuthScreen
      mode="register"
      onSubmit={async (email, password) => {
        await register(email, password);
        await analytics.logEvent('signup', { method: 'email' });
      }}
    />
  );
}

