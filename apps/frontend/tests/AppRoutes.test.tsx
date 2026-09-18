import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import RootLayout from '../app/_layout';
import IndexRoute from '../app/index';
import AnonymousLayout from '../app/(auth)/_layout';
import AuthenticatedLayout from '../app/(app)/_layout';
import OnboardingScreen from '../app/(app)/onboarding';
import LoginRoute from '../app/(auth)/login';
import RegisterRoute from '../app/(auth)/register';
import ForgotPasswordRoute from '../app/(auth)/forgot-password';
import ResetPasswordRoute from '../app/reset-password';
import DashboardRoute from '../app/(app)/index';
import VerifyEmailRoute from '../app/(app)/verify-email';
import { LoadingScreen } from '../src/components/LoadingScreen';

const mockReplace = jest.fn();
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockLogout = jest.fn();
const mockLogEvent = jest.fn();
const mockBootstrap = jest.fn();
const mockApolloQuery = jest.fn();
let mockPathname = '/';
let mockSearchParams: Record<string, string | string[] | undefined> = {};
let mockAuthState: Record<string, unknown>;
let mockQueryState: Record<string, unknown>;
let mockMutationState: Record<string, unknown>;
let mockValidateSession: (() => Promise<void>) | undefined;
let mockAuthSubmit: ((email: string, password: string) => Promise<void>) | undefined;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
  Stack: () => <MockText>stack</MockText>,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
  useLocalSearchParams: () => mockSearchParams
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => <MockText>status-bar</MockText>
}));

jest.mock('@apollo/client/react', () => ({
  ApolloProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: () => mockQueryState,
  useMutation: () => [mockBootstrap, mockMutationState]
}));

jest.mock('@/services/apollo', () => ({
  createMoneyHubApolloClient: () => ({
    query: (...args: unknown[]) => mockApolloQuery(...args)
  })
}));

jest.mock('@/services/firebaseAuthService', () => ({
  firebaseAuthService: { getIdToken: jest.fn() }
}));

jest.mock('@/providers/AuthProvider', () => ({
  AuthProvider: ({
    children,
    validateSession
  }: {
    children: React.ReactNode;
    validateSession?: () => Promise<void>;
  }) => {
    mockValidateSession = validateSession;
    return children;
  },
  useAuth: () => mockAuthState
}));

jest.mock('@/services/analyticsRuntime', () => ({
  analytics: {
    logEvent: (...args: unknown[]) => mockLogEvent(...args)
  }
}));

jest.mock('@/services/backendPasswordRecoveryClient', () => ({
  passwordRecoveryClient: {}
}));

jest.mock('@/components/AuthScreen', () => ({
  AuthScreen: ({
    mode,
    onSubmit
  }: {
    mode: string;
    onSubmit: (email: string, password: string) => Promise<void>;
  }) => {
    mockAuthSubmit = onSubmit;
    return <MockText>{`auth:${mode}`}</MockText>;
  }
}));

jest.mock('@/components/PasswordRecoveryScreens', () => ({
  ForgotPasswordScreen: () => <MockText>forgot-password</MockText>,
  ResetPasswordScreen: ({ mode, oobCode }: { mode?: string; oobCode?: string }) => (
    <MockText>{`reset:${mode ?? ''}:${oobCode ?? ''}`}</MockText>
  )
}));

jest.mock('@/components/DashboardShell', () => ({
  DashboardShell: () => <MockText>dashboard-shell</MockText>
}));

jest.mock('@/components/VerifyEmailScreen', () => ({
  VerifyEmailScreen: () => <MockText>verify-email-screen</MockText>
}));

describe('Expo application routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
    mockSearchParams = {};
    mockAuthState = {
      loading: false,
      user: null,
      login: mockLogin,
      register: mockRegister,
      logout: mockLogout
    };
    mockQueryState = { data: undefined, loading: false };
    mockMutationState = { loading: false, error: undefined };
    mockBootstrap.mockResolvedValue({ data: { bootstrapProfile: { created: true } } });
    mockApolloQuery.mockResolvedValue({ data: { me: { id: 'firebase-user' } } });
    mockLogin.mockResolvedValue(undefined);
    mockRegister.mockResolvedValue(undefined);
    mockLogEvent.mockResolvedValue(undefined);
  });

  test('root layout validates an authenticated backend session', async () => {
    await render(<RootLayout />);
    expect(screen.getByText('stack')).toBeOnTheScreen();
    expect(mockValidateSession).toBeDefined();

    await expect(mockValidateSession?.()).resolves.toBeUndefined();
    expect(mockApolloQuery).toHaveBeenCalled();

    mockApolloQuery.mockResolvedValueOnce({ data: { me: null } });
    await expect(mockValidateSession?.()).rejects.toThrow(
      'Backend did not return an authenticated user.'
    );
  });

  test('index route shows loading then redirects by session', async () => {
    mockAuthState = { loading: true, user: null };
    const view = await render(<IndexRoute />);
    expect(screen.getByLabelText('Carregando sessao')).toBeOnTheScreen();

    mockAuthState = { loading: false, user: null };
    await view.rerender(<IndexRoute />);
    expect(screen.getByText('redirect:/(auth)/login')).toBeOnTheScreen();

    mockAuthState = { loading: false, user: { uid: 'user-1' } };
    await view.rerender(<IndexRoute />);
    expect(screen.getByText('redirect:/(app)')).toBeOnTheScreen();
  });

  test('anonymous layout handles loading and an existing session', async () => {
    mockAuthState = { loading: true, user: null };
    const view = await render(<AnonymousLayout />);
    expect(screen.getByLabelText('Carregando sessao')).toBeOnTheScreen();

    mockAuthState = { loading: false, user: { uid: 'user-1' } };
    await view.rerender(<AnonymousLayout />);
    expect(screen.getByText('redirect:/(app)')).toBeOnTheScreen();
  });

  test('authenticated layout redirects anonymous and unverified users', async () => {
    mockAuthState = { loading: false, user: null };
    const view = await render(<AuthenticatedLayout />);
    expect(screen.getByText('redirect:/(auth)/login')).toBeOnTheScreen();

    mockAuthState = {
      loading: false,
      user: { uid: 'user-1', emailVerified: false }
    };
    await view.rerender(<AuthenticatedLayout />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/verify-email'));
  });

  test('authenticated layout routes profile bootstrap and completed users', async () => {
    mockAuthState = {
      loading: false,
      user: { uid: 'user-1', emailVerified: true }
    };
    mockQueryState = {
      loading: false,
      data: { me: { id: 'user-1', needsProfileBootstrap: true } }
    };
    const view = await render(<AuthenticatedLayout />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'));

    mockReplace.mockClear();
    mockPathname = '/onboarding';
    mockQueryState = {
      loading: false,
      data: { me: { id: 'user-1', needsProfileBootstrap: false } }
    };
    await view.rerender(<AuthenticatedLayout />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)'));
  });

  test('login and registration routes call auth then analytics', async () => {
    const loginView = await render(<LoginRoute />);
    expect(screen.getByText('auth:login')).toBeOnTheScreen();
    await mockAuthSubmit?.('user@example.com', 'password');
    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password');
    expect(mockLogEvent).toHaveBeenCalledWith('login', { method: 'email' });

    await loginView.unmount();
    await render(<RegisterRoute />);
    expect(screen.getByText('auth:register')).toBeOnTheScreen();
    await mockAuthSubmit?.('new@example.com', 'password');
    expect(mockRegister).toHaveBeenCalledWith('new@example.com', 'password');
    expect(mockLogEvent).toHaveBeenCalledWith('signup', { method: 'email' });
  });

  test('onboarding submits normalized selections and routes to app', async () => {
    await render(<OnboardingScreen />);
    const submit = screen.getByRole('button', { name: 'Concluir Cadastro' });
    expect(submit).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText('Digite seu nome completo'), 'Ana Silva');
    await fireEvent.press(screen.getByText('USD'));
    await fireEvent.press(screen.getByText('Escuro'));
    await fireEvent.press(submit);

    await waitFor(() => expect(mockBootstrap).toHaveBeenCalledWith({
      variables: {
        input: {
          fullName: 'Ana Silva',
          preferredCurrency: 'USD',
          theme: 'DARK'
        }
      }
    }));
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  test('thin routes compose their target screens and sanitize reset params', async () => {
    mockSearchParams = { mode: ['resetPassword'], oobCode: 'code-1' };
    const resetView = await render(<ResetPasswordRoute />);
    expect(screen.getByText('reset::code-1')).toBeOnTheScreen();
    await resetView.unmount();

    const forgotView = await render(<ForgotPasswordRoute />);
    expect(screen.getByText('forgot-password')).toBeOnTheScreen();
    await forgotView.unmount();
    const dashboardView = await render(<DashboardRoute />);
    expect(screen.getByText('dashboard-shell')).toBeOnTheScreen();
    await dashboardView.unmount();
    const verifyView = await render(<VerifyEmailRoute />);
    expect(screen.getByText('verify-email-screen')).toBeOnTheScreen();
    await verifyView.unmount();
    await render(<LoadingScreen />);
    expect(screen.getByLabelText('Carregando sessao')).toBeOnTheScreen();
  });
});
