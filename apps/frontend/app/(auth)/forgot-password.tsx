import { ForgotPasswordScreen } from '@/components/PasswordRecoveryScreens';
import { passwordRecoveryClient } from '@/services/backendPasswordRecoveryClient';

export default function ForgotPasswordRoute() {
  return <ForgotPasswordScreen client={passwordRecoveryClient} />;
}
