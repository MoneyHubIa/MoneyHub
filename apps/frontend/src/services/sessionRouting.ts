import type { SessionUser } from './authService';

export type SessionRoute = '/(auth)/login' | '/(app)';

export function resolveSessionRoute(
  loading: boolean,
  user: SessionUser | null
): SessionRoute | null {
  if (loading) return null;
  return user ? '/(app)' : '/(auth)/login';
}
