/* eslint-disable @typescript-eslint/no-require-imports */
describe('Firebase auth service runtime adapter', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('delegates account lifecycle operations to Firebase SDK', async () => {
    const user = {
      uid: 'firebase-user',
      email: 'user@example.com',
      emailVerified: false,
      reload: jest.fn(async () => undefined),
      getIdToken: jest.fn(async () => 'id-token')
    };
    const auth = { currentUser: user };
    const createUserWithEmailAndPassword = jest.fn(async () => ({ user }));
    const sendEmailVerification = jest.fn(async () => undefined);
    const signInWithEmailAndPassword = jest.fn(async () => ({ user }));
    const signOut = jest.fn(async () => undefined);
    const onAuthStateChanged = jest.fn((_auth, callback: (value: typeof user) => void) => {
      callback(user);
      return () => undefined;
    });
    jest.doMock('firebase/auth', () => ({
      createUserWithEmailAndPassword,
      sendEmailVerification,
      signInWithEmailAndPassword,
      signOut,
      onAuthStateChanged
    }));
    jest.doMock('../src/services/firebaseAuthRuntime', () => ({
      getFirebaseAuth: jest.fn(() => auth)
    }));

    const { firebaseAuthService } = require('../src/services/firebaseAuthService') as typeof import('../src/services/firebaseAuthService');

    await firebaseAuthService.register(' User@Example.com ', 'password');
    await expect(firebaseAuthService.login(' User@Example.com ', 'password'))
      .resolves.toMatchObject({ uid: 'firebase-user' });
    await firebaseAuthService.resendEmailVerification();
    await firebaseAuthService.refreshEmailVerification();
    await firebaseAuthService.logout();
    await expect(firebaseAuthService.getIdToken()).resolves.toBe('id-token');
    const observer = jest.fn();
    firebaseAuthService.observeSession(observer);

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'user@example.com',
      'password'
    );
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      'user@example.com',
      'password'
    );
    expect(sendEmailVerification).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith(auth);
    expect(onAuthStateChanged).toHaveBeenCalledWith(auth, expect.any(Function));
    expect(observer).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'firebase-user'
    }));
  });
});
