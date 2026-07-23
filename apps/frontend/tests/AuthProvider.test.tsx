import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  AuthProvider,
  useAuth
} from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

function SessionProbe() {
  const { loading, user } = useAuth();
  return <Text>{loading ? 'loading' : (user?.email ?? 'anonymous')}</Text>;
}

describe('AuthProvider', () => {
  test('restores the current Firebase session', async () => {
    const service: AuthService = {
      register: jest.fn(),
      login: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({ uid: 'firebase-uid', email: 'person@example.com' });
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
});
