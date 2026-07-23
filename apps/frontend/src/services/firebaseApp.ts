import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp
} from 'firebase/app';
import { readFirebaseConfig } from './firebaseConfig';

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp() {
  firebaseApp ??=
    getApps().length > 0
      ? getApp()
      : initializeApp(readFirebaseConfig(process.env));
  return firebaseApp;
}

export { readFirebaseConfig } from './firebaseConfig';
