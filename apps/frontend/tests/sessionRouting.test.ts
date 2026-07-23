import { resolveSessionRoute } from '../src/services/sessionRouting';

describe('session routing', () => {
  test('waits while Firebase restores the session', () => {
    expect(resolveSessionRoute(true, null)).toBeNull();
  });

  test('routes anonymous and authenticated users to separate groups', () => {
    expect(resolveSessionRoute(false, null)).toBe('/(auth)/login');
    expect(resolveSessionRoute(false, { uid: 'uid', email: null })).toBe('/(app)');
  });
});
