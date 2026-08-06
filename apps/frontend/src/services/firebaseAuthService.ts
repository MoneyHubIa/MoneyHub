import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { createFirebaseAuthService } from './authService';
import { getFirebaseAuth } from './firebaseAuthRuntime';

export const firebaseAuthService = createFirebaseAuthService({
  createUser: (email, password) =>
    createUserWithEmailAndPassword(getFirebaseAuth(), email, password),
  signIn: (email, password) =>
    signInWithEmailAndPassword(getFirebaseAuth(), email, password),
  signOut: () => signOut(getFirebaseAuth()),
  observe: (callback) => onAuthStateChanged(getFirebaseAuth(), callback),
  getCurrentUser: () => getFirebaseAuth().currentUser
});
