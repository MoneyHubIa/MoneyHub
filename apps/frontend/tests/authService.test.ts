import { createFirebaseAuthService } from '../src/services/authService';

describe('Firebase auth service', () => {
  test('sends verification after registration', async () => {
    const user = {
      uid: 'new-user',
      email: 'user@example.com',
      emailVerified: false
    };
    const createUser = jest.fn().mockResolvedValue({ user });
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const service = createFirebaseAuthService({
      createUser,
      sendVerification,
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
    expect(sendVerification).toHaveBeenCalledWith(user);
  });

  test('surfaces verification failure after registration', async () => {
    const error = new Error('Email verification is unavailable.');
    const user = {
      uid: 'new-user',
      email: 'user@example.com',
      emailVerified: false
    };
    const service = createFirebaseAuthService({
      createUser: jest.fn().mockResolvedValue({ user }),
      sendVerification: jest.fn().mockRejectedValue(error),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => user
    });

    await expect(service.register('user@example.com', 'correct-horse')).rejects.toBe(
      error
    );
  });

  test('logs in without exposing the password outside Firebase', async () => {
    const signIn = jest.fn().mockResolvedValue({
      user: {
        uid: 'known-user',
        email: 'person@example.com',
        emailVerified: false
      }
    });
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification: jest.fn(),
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
      sendVerification: jest.fn(),
      signIn: jest.fn(),
      signOut: signOutMock,
      observe: jest.fn(),
      getCurrentUser: () => null
    });

    await service.logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('maps verification into the restored session', () => {
    let observer:
      | ((user: {
          uid: string;
          email: string | null;
          emailVerified: boolean;
        } | null) => void)
      | undefined;
    const firebaseUser = {
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    };
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification: jest.fn(),
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
    observer?.(firebaseUser);

    expect(listener).toHaveBeenCalledWith({
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    });
  });

  test('gets a fresh ID token from the current Firebase user', async () => {
    const getIdToken = jest.fn().mockResolvedValue('fresh-id-token');
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => ({
        uid: 'firebase-uid',
        email: 'person@example.com',
        emailVerified: false,
        getIdToken
      })
    });

    await expect(service.getIdToken()).resolves.toBe('fresh-id-token');
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith();
  });

  test('resends verification to the current user', async () => {
    const currentUser = {
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: false
    };
    const sendVerification = jest.fn().mockResolvedValue(undefined);
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification,
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => currentUser
    });

    await service.resendEmailVerification();

    expect(sendVerification).toHaveBeenCalledTimes(1);
    expect(sendVerification).toHaveBeenCalledWith(currentUser);
  });

  test('reloads verification and force-refreshes the token', async () => {
    const user = {
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: false,
      reload: jest.fn(),
      getIdToken: jest.fn().mockResolvedValue('verified-token')
    };
    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => user
    });

    await expect(service.refreshEmailVerification()).resolves.toEqual({
      uid: 'firebase-uid',
      email: 'person@example.com',
      emailVerified: true
    });
    expect(user.reload).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  test('requires a current user for verification operations', async () => {
    const service = createFirebaseAuthService({
      createUser: jest.fn(),
      sendVerification: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      observe: jest.fn(),
      getCurrentUser: () => null
    });

    await expect(service.resendEmailVerification()).rejects.toThrow(
      'No authenticated Firebase user.'
    );
    await expect(service.refreshEmailVerification()).rejects.toThrow(
      'No authenticated Firebase user.'
    );
  });
});

