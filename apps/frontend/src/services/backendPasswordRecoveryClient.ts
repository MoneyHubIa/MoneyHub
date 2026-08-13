import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createPasswordRecoveryClient,
  resolvePasswordRecoveryEndpoint
} from './passwordRecoveryClient';

export const passwordRecoveryClient = createPasswordRecoveryClient({
  endpoint: resolvePasswordRecoveryEndpoint(
    process.env.EXPO_PUBLIC_APP_URL ?? Constants.expoConfig?.extra?.appUrl,
    Platform.OS
  ),
  fetchRequest: (input, init) => fetch(input, init)
});
