import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VerifyEmailScreen } from '../src/components/VerifyEmailScreen';
import { AuthProvider } from '../src/providers/AuthProvider';
import type { AuthService } from '../src/services/authService';

describe('VerifyEmailScreen', () => {
  test('renders email and header information', async () => {
    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn(),
      refreshEmailVerification: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'user-123',
          email: 'teste@moneyhub.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <VerifyEmailScreen />
      </AuthProvider>
    );

    expect(screen.getByRole('header', { name: 'Verifique seu e-mail' })).toBeOnTheScreen();
    expect(screen.getByText('teste@moneyhub.com')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Já verifiquei meu e-mail' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sair / Entrar com outra conta' })).toBeOnTheScreen();
  });

  test('calls refreshEmailVerification and displays info message when still unverified', async () => {
    const refreshEmailVerification = jest.fn().mockResolvedValue({
      uid: 'user-123',
      email: 'teste@moneyhub.com',
      emailVerified: false
    });

    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn(),
      refreshEmailVerification,
      login: jest.fn(),
      logout: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'user-123',
          email: 'teste@moneyhub.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <VerifyEmailScreen />
      </AuthProvider>
    );

    const refreshButton = screen.getByRole('button', { name: 'Já verifiquei meu e-mail' });
    await act(async () => {
      fireEvent.press(refreshButton);
    });

    await waitFor(() => {
      expect(refreshEmailVerification).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/Seu e-mail ainda não foi confirmado/i)
      ).toBeOnTheScreen();
    });
  });

  test('calls resendEmailVerification and displays success feedback', async () => {
    const resendEmailVerification = jest.fn().mockResolvedValue(undefined);

    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification,
      refreshEmailVerification: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'user-123',
          email: 'teste@moneyhub.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <VerifyEmailScreen />
      </AuthProvider>
    );

    const resendButton = screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' });
    await act(async () => {
      fireEvent.press(resendButton);
    });

    await waitFor(() => {
      expect(resendEmailVerification).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/E-mail de confirmação reenviado com sucesso/i)
      ).toBeOnTheScreen();
    });
  });

  test('calls logout when clicking the sign out button', async () => {
    const logout = jest.fn().mockResolvedValue(undefined);

    const service: AuthService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn(),
      refreshEmailVerification: jest.fn(),
      login: jest.fn(),
      logout,
      getIdToken: jest.fn(),
      observeSession: (callback) => {
        callback({
          uid: 'user-123',
          email: 'teste@moneyhub.com',
          emailVerified: false
        });
        return () => undefined;
      }
    };

    await render(
      <AuthProvider service={service}>
        <VerifyEmailScreen />
      </AuthProvider>
    );

    const logoutButton = screen.getByRole('button', { name: 'Sair / Entrar com outra conta' });
    await act(async () => {
      fireEvent.press(logoutButton);
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
