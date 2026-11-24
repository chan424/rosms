import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  INSTITUTE_DOMAIN,
  SUPER_ADMINS,
  isInstituteEmail,
  isStaffEmail,
  looksLikeStudent,
  usernameToEmail,
} from '../config/roles';
import type { ModuleDoc, UserProfile } from './types';
import type { AccessContext } from './permissions';
import { errMsg } from './format';

interface AuthState extends AccessContext {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signInStaff: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [moduleDocs, setModuleDocs] = useState<Record<string, ModuleDoc>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubModules: (() => void) | undefined;

    const unsub = onAuthStateChanged(auth, async (u) => {
      unsubProfile?.();
      unsubModules?.();
      setProfile(null);
      setModuleDocs({});
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const email = (u.email ?? '').toLowerCase();
      const provider = u.providerData[0]?.providerId;

      // Domain gate (also enforced in firestore.rules).
      const okInstitute = isInstituteEmail(email) && provider === 'google.com';
      const okStaff = isStaffEmail(email) && provider === 'password';
      if (!okInstitute && !okStaff) {
        setError(`Only @${INSTITUTE_DOMAIN} Google accounts or ROSMS staff usernames can sign in.`);
        await fbSignOut(auth);
        return;
      }

      try {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          if (okStaff) {
            setError('This username has not been activated by an administrator.');
            await fbSignOut(auth);
            return;
          }
          // First Google sign-in: self-register with no module rights.
          await setDoc(ref, {
            email,
            displayName: u.displayName ?? '',
            role: SUPER_ADMINS.includes(email) ? 'superadmin' : looksLikeStudent(email) ? 'student' : 'faculty',
            modules: [],
            disabled: false,
            mustChangePassword: false,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          });
        } else {
          const d = snap.data();
          if (d.disabled) {
            setError('Your account has been disabled. Contact the ROSMS administrator.');
            await fbSignOut(auth);
            return;
          }
          updateDoc(ref, { lastLoginAt: serverTimestamp() }).catch(() => undefined);
        }

        setUser(u);
        // Wait for server-confirmed profile changes (e.g. after a password change) so that
        // screens never subscribe to data before the security rules see the new state.
        unsubProfile = onSnapshot(ref, { includeMetadataChanges: true }, (s) => {
          if (!s.exists() || s.metadata.hasPendingWrites) return;
          const p = { id: s.id, ...(s.data() as Omit<UserProfile, 'id'>) } as UserProfile;
          p.modules = p.modules ?? [];
          if (p.disabled) {
            setError('Your account has been disabled.');
            fbSignOut(auth);
            return;
          }
          setProfile(p);
          setLoading(false);
        });
        unsubModules = onSnapshot(
          collection(db, 'modules'),
          (s) => {
            const map: Record<string, ModuleDoc> = {};
            s.docs.forEach((d) => {
              const data = d.data();
              map[d.id] = { id: d.id, ...data, owners: (data.owners ?? []).map((x: string) => x.toLowerCase()) } as ModuleDoc;
            });
            setModuleDocs(map);
          },
          () => undefined,
        );
      } catch (e) {
        setError(errMsg(e));
        setLoading(false);
      }
    });
    return () => {
      unsub();
      unsubProfile?.();
      unsubModules?.();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      moduleDocs,
      loading,
      error,
      clearError: () => setError(null),
      signInGoogle: async () => {
        setError(null);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ hd: INSTITUTE_DOMAIN, prompt: 'select_account' });
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          setError(errMsg(e));
        }
      },
      signInStaff: async (username, password) => {
        setError(null);
        try {
          await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
        } catch (e) {
          setError(errMsg(e));
        }
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    }),
    [user, profile, moduleDocs, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
