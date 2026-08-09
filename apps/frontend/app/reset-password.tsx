import { useLocalSearchParams } from 'expo-router';
import { ResetPasswordScreen } from '@/components/PasswordRecoveryScreens';
import { useAuth } from '@/providers/AuthProvider';
import { passwordRecoveryClient } from '@/services/firebasePasswordRecoveryClient';

export default function ResetPasswordRoute() {
  const { logout } = useAuth();
  const parameters = useLocalSearchParams<{
    mode?: string | string[];
    oobCode?: string | string[];
  }>();

  return (
    <ResetPasswordScreen
      client={passwordRecoveryClient}
      logout={logout}
      mode={typeof parameters.mode === 'string' ? parameters.mode : undefined}
      oobCode={
        typeof parameters.oobCode === 'string' ? parameters.oobCode : undefined
      }
    />
  );
}
