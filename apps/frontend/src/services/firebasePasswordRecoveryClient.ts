import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  confirmPasswordReset,
  verifyPasswordResetCode
} from 'firebase/auth';
import { getFirebaseAuth } from './firebaseAuthRuntime';
import {
  createPasswordRecoveryClient,
  resolvePasswordRecoveryEndpoint
} from './passwordRecoveryClient';

export const passwordRecoveryClient = createPasswordRecoveryClient({
  endpoint: resolvePasswordRecoveryEndpoint(
    process.env.EXPO_PUBLIC_APP_URL ?? Constants.expoConfig?.extra?.appUrl,
    Platform.OS
  ),
  fetchRequest: (input, init) => fetch(input, init),
  verifyPasswordResetCode: (oobCode) =>
    verifyPasswordResetCode(getFirebaseAuth(), oobCode),
  confirmPasswordReset: (oobCode, newPassword) =>
    confirmPasswordReset(getFirebaseAuth(), oobCode, newPassword)
});
