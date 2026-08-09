import { ForgotPasswordScreen } from '@/components/PasswordRecoveryScreens';
import { passwordRecoveryClient } from '@/services/firebasePasswordRecoveryClient';

export default function ForgotPasswordRoute() {
  return <ForgotPasswordScreen client={passwordRecoveryClient} />;
}
