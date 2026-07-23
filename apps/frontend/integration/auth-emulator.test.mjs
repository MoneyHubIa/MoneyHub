import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

class SharedTestPersistence {
  static type = 'LOCAL';
  static values = new Map();
  type = 'LOCAL';

  async _isAvailable() {
    return true;
  }

  async _set(key, value) {
    SharedTestPersistence.values.set(key, value);
  }

  async _get(key) {
    return SharedTestPersistence.values.get(key) ?? null;
  }

  async _remove(key) {
    SharedTestPersistence.values.delete(key);
  }

  _addListener() {}
  _removeListener() {}
}

test('registers, logs in, and restores session state with Auth Emulator', async () => {
  const config = {
    apiKey: 'demo-api-key',
    authDomain: 'demo-moneyhub.firebaseapp.com',
    projectId: 'demo-moneyhub',
    appId: 'demo-app-id'
  };
  const appName = `auth-emulator-${Date.now()}`;
  let app = initializeApp(config, appName);
  let auth = initializeAuth(app, { persistence: SharedTestPersistence });
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });

  const email = `epic-01-${Date.now()}@example.test`;
  const password = 'firebase-emulator-only';

  try {
    const registration = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const registeredUid = registration.user.uid;
    assert.ok(await registration.user.getIdToken());

    await deleteApp(app);
    app = initializeApp(config, appName);
    auth = initializeAuth(app, { persistence: SharedTestPersistence });
    connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
    await auth.authStateReady();
    assert.equal(auth.currentUser?.uid, registeredUid);

    await signOut(auth);
    const login = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(login.user.uid, registeredUid);

    await deleteUser(login.user);
  } finally {
    await deleteApp(app);
  }
});
