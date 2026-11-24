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
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
