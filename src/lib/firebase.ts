import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

export const app: FirebaseApp | undefined = isFirebaseConfigured ? initializeApp(firebaseConfig) : undefined;

export const auth = (app ? getAuth(app) : undefined) as Auth;

// Offline cache keeps reads low on the free Spark plan and lets the app work on flaky Wi-Fi.
export const db = (app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : undefined) as Firestore;

// Local development against the Firebase emulators: set VITE_USE_EMULATORS=true in .env.local
if (app && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
}
