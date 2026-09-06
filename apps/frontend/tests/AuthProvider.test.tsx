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

let loginResult: Promise<void> | undefined;

function LoginProbe() {
  const { loading, login, user } = useAuth();

  return (
    <>
      <Text>{loading ? 'loading' : (user?.email ?? 'anonymous')}</Text>
      <Button
        title="Login"
        onPress={() => {
          loginResult = login('person@example.com', 'password');
          void loginResult.catch(() => undefined);
        }}
      />
    </>
  );
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
  test('signs out when backend validation fails after Firebase login', async () => {
    let observer: ((user: {
      uid: string;
      email: string;
      emailVerified: boolean;
    } | null) => void) | undefined;
    const firebaseUser = {
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    };
    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn(),
      refreshEmailVerification: jest.fn(),
      login: jest.fn(async () => {
        observer?.(firebaseUser);
        return firebaseUser;
      }),
      logout: jest.fn(async () => {
        observer?.(null);
      }),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        observer = callback;
        callback(null);
        return () => undefined;
      }
    };

    await render(
      <AuthProvider
        service={service}
        validateSession={async () => {
          throw new Error('database unavailable');
        }}
      >
        <LoginProbe />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Login' }));

    await expect(loginResult).rejects.toMatchObject({
      code: 'auth/backend-unavailable'
    });
    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeOnTheScreen();
    });
    expect(service.logout).toHaveBeenCalledTimes(1);
  });

  test('signs out when a restored Firebase session cannot reach the backend', async () => {
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
          emailVerified: true
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider
        service={service}
        validateSession={async () => {
          throw new Error('database unavailable');
        }}
      >
        <SessionProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeOnTheScreen();
    });
    expect(service.logout).toHaveBeenCalledTimes(1);
  });

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
      <AuthProvider service={service} validateSession={async () => undefined}>
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

