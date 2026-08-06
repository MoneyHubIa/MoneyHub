import { createFirebaseAuthService } from '../src/services/authService';

describe('Firebase auth service', () => {
  test('registers with a normalized email', async () => {
    const createUser = jest.fn().mockResolvedValue({ user: { uid: 'new-user' } });
    const service = createFirebaseAuthService({
      createUser,
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => null
    });

    await service.register(' User@Example.COM ', 'correct-horse');

    expect(createUser).toHaveBeenCalledWith(
      'user@example.com',
      'correct-horse'
    );
  });

  test('logs in without exposing the password outside Firebase', async () => {
    const signIn = jest.fn().mockResolvedValue({ user: { uid: 'known-user' } });
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      signIn,
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => null
    });

    await service.login(' Person@Example.com ', 'firebase-only');

    expect(signIn).toHaveBeenCalledWith('person@example.com', 'firebase-only');
  });

  test('logs out by delegating to Firebase signOut', async () => {
    const signOutMock = jest.fn().mockResolvedValue(undefined);
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      signIn: jest.fn(),
      signOut: signOutMock,
      observe: jest.fn(),
      getCurrentUser: () => null
    });

    await service.logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('maps restored Firebase sessions to the application contract', () => {
    let observer: ((user: { uid: string; email: string | null } | null) => void) | undefined;
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: (callback) => {
        observer = callback;
        return () => undefined;
      },
      getCurrentUser: () => null
    });
    const listener = jest.fn();

    service.observeSession(listener);
    observer?.({ uid: 'firebase-uid', email: 'person@example.com' });

    expect(listener).toHaveBeenCalledWith({
      uid: 'firebase-uid',
      email: 'person@example.com'
    });
  });

  test('gets a fresh ID token from the current Firebase user', async () => {
    const getIdToken = jest.fn().mockResolvedValue('fresh-id-token');
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => ({
        uid: 'firebase-uid',
        email: 'person@example.com',
        getIdToken
      })
    });

    await expect(service.getIdToken()).resolves.toBe('fresh-id-token');
    expect(getIdToken).toHaveBeenCalledTimes(1);
  });
});

