import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Button, Text } from 'react-native';
import {
  AuthProvider,
  useAuth
} from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

function SessionProbe() {
  const { loading, user } = useAuth();
  return <Text>{loading ? 'loading' : (user?.email ?? 'anonymous')}</Text>;
}

let refreshResult: Promise<boolean> | undefined;

function EmailVerificationProbe() {
  const {
    resendEmailVerification,
    refreshEmailVerification,
    user
  } = useAuth();

  return (
    <>
      <Text>{user?.emailVerified ? 'verified' : 'unverified'}</Text>
      <Button
        title="Resend verification"
        onPress={() => {
          void resendEmailVerification();
        }}
      />
      <Button
        title="Refresh verification"
        onPress={() => {
          refreshResult = refreshEmailVerification();
        }}
      />
    </>
  );
}

describe('AuthProvider', () => {
  test('restores the current Firebase session', async () => {
    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn(),
      refreshEmailVerification: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'firebase-uid',
          email: 'person@example.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <SessionProbe />
      </AuthProvider>
    );

    expect(screen.getByText('person@example.com')).toBeOnTheScreen();
  });

  test('synchronizes the refreshed email verification state', async () => {
    const resendEmailVerification = jest.fn().mockResolvedValue(undefined);
    const refreshEmailVerification = jest.fn().mockResolvedValue({
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    });
    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification,
      refreshEmailVerification,
      login: jest.fn(),
      logout: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'firebase-uid',
          email: 'person@example.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <EmailVerificationProbe />
      </AuthProvider>
    );

    expect(screen.getByText('unverified')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Resend verification' }));

    expect(resendEmailVerification).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Refresh verification' }));

    await waitFor(() => {
      expect(screen.getByText('verified')).toBeOnTheScreen();
    });
    await expect(refreshResult).resolves.toBe(true);
  });
});

