import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { AuthService, SessionUser } from '../services/authService';

type AuthContextValue = Readonly<{
  loading: boolean;
  user: SessionUser | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  service: AuthService;
}>;

export function AuthProvider({ children, service }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(
    () =>
      service.observeSession((sessionUser) => {
        setUser(sessionUser);
        setLoading(false);
      }),
    [service]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      login: service.login,
      register: service.register,
      logout: service.logout
    }),
    [loading, service, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

