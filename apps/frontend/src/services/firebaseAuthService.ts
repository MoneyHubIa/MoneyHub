import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';
import { createFirebaseAuthService } from './authService';
import { getFirebaseAuth } from './firebaseAuthRuntime';

export const firebaseAuthService = createFirebaseAuthService({
  createUser: (email, password) =>
    createUserWithEmailAndPassword(getFirebaseAuth(), email, password),
  sendVerification: (user) => sendEmailVerification(user as User),
  signIn: (email, password) =>
    signInWithEmailAndPassword(getFirebaseAuth(), email, password),
  signOut: () => signOut(getFirebaseAuth()),
  observe: (callback) => onAuthStateChanged(getFirebaseAuth(), callback),
  getCurrentUser: () => getFirebaseAuth().currentUser
});
