import dayjs from 'dayjs';
import type { Timestamp } from 'firebase/firestore';

type Dateish = Timestamp | Date | string | number | null | undefined;

export const toDate = (v: Dateish): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  return null;
};

export const fmtDate = (v: Dateish) => {
  const d = toDate(v);
  return d ? dayjs(d).format('DD MMM YYYY') : '—';
};

export const fmtDateTime = (v: Dateish) => {
  const d = toDate(v);
  return d ? dayjs(d).format('DD MMM YYYY, hh:mm A') : '—';
};

export const daysBetween = (a: Date, b: Date) =>
  Math.floor((dayjs(b).startOf('day').valueOf() - dayjs(a).startOf('day').valueOf()) / 86400000);

export const inr = (n: number | undefined | null) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const errMsg = (e: unknown) => {
  const m = (e as { code?: string; message?: string })?.code || (e as Error)?.message || String(e);
  if (m.includes('permission-denied')) return 'You do not have permission to do that.';
  if (m.includes('invalid-credential') || m.includes('wrong-password')) return 'Incorrect username or password.';
  if (m.includes('user-not-found')) return 'No such account.';
  if (m.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('popup-closed')) return 'Sign-in window was closed.';
  if (m.includes('weak-password')) return 'Password is too weak (minimum 8 characters).';
  if (m.includes('requires-recent-login')) return 'Please sign out and sign in again, then retry.';
  return m.replace('Firebase: ', '');
};
