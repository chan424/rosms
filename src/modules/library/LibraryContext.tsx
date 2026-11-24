import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/useCollection';
import { COL, DEFAULT_SETTINGS, type Book, type LibrarySettings, type Loan, type Member, type Reservation } from './types';

interface LibraryData {
  books: Book[];
  members: Member[];
  activeLoans: Loan[];
  history: Loan[];
  reservations: Reservation[];
  settings: LibrarySettings;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<LibraryData | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const books = useCollection<Book>(query(collection(db, COL.books), orderBy('accessionNo')), 'books');
  const members = useCollection<Member>(query(collection(db, COL.members), orderBy('name')), 'members');
  const activeLoans = useCollection<Loan>(query(collection(db, COL.loans), where('status', '==', 'issued')), 'active');
  const history = useCollection<Loan>(query(collection(db, COL.loans), orderBy('issuedAt', 'desc'), limit(1000)), 'history');
  const reservations = useCollection<Reservation>(query(collection(db, COL.reservations), where('status', '==', 'active')), 'resv');
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);

  useEffect(
    () =>
      onSnapshot(doc(db, COL.settings, 'config'), (s) => {
        if (s.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(s.data() as Partial<LibrarySettings>) });
      }, () => undefined),
    [],
  );

  const value: LibraryData = {
    books: books.data,
    members: members.data,
    activeLoans: activeLoans.data,
    history: history.data,
    reservations: reservations.data,
    settings,
    loading: books.loading || members.loading || activeLoans.loading,
    error: books.error || members.error || activeLoans.error || history.error,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLibrary outside provider');
  return c;
}
