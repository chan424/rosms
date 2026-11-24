/**
 * Firebase web configuration.
 *
 * Fill these in ONE of two ways:
 *  1. Recommended: set VITE_FIREBASE_* repository variables in GitHub
 *     (Settings > Secrets and variables > Actions > Variables) and in a local
 *     `.env.local` file for development. See `.env.example`.
 *  2. Or paste the values from Firebase console > Project settings > Your apps
 *     directly into the fallback strings below.
 *
 * These values are NOT secrets. Access control is enforced by firestore.rules.
 */
// Public web config of the ROSMS Firebase project (rosms-3ac80). VITE_FIREBASE_* variables, when set, take priority.
const ROSMS_PROJECT = {
  apiKey: 'AIzaSyCM4wv6lbkFrhFYV_6FdIGDDagawwTK2ZE',
  authDomain: 'rosms-3ac80.firebaseapp.com',
  projectId: 'rosms-3ac80',
  storageBucket: 'rosms-3ac80.firebasestorage.app',
  messagingSenderId: '268261849018',
  appId: '1:268261849018:web:66504a747861cad531cf83',
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || ROSMS_PROJECT.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ROSMS_PROJECT.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || ROSMS_PROJECT.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ROSMS_PROJECT.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ROSMS_PROJECT.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ROSMS_PROJECT.appId,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
