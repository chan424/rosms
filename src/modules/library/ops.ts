import {
  Timestamp, collection, doc, runTransaction, serverTimestamp, updateDoc, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { auth, db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { daysBetween, toDate } from '../../lib/format';
import { COL, loanDays, maxBooks, type Book, type LibrarySettings, type Loan, type Member } from './types';

const who = () => auth.currentUser?.email ?? 'unknown';

export const computeFine = (loan: Pick<Loan, 'dueAt'>, s: LibrarySettings, on = new Date()) => {
  const due = toDate(loan.dueAt);
  if (!due) return 0;
  const late = daysBetween(due, on);
  return late > 0 ? late * s.finePerDay : 0;
};

export const daysOverdue = (loan: Pick<Loan, 'dueAt'>, on = new Date()) => {
  const due = toDate(loan.dueAt);
  return due ? Math.max(0, daysBetween(due, on)) : 0;
};

export async function issueBook(bookId: string, memberDocId: string, s: LibrarySettings, dueOverride?: string) {
  const loanRef = doc(collection(db, COL.loans));
  const result = await runTransaction(db, async (tx) => {
    const bRef = doc(db, COL.books, bookId);
    const mRef = doc(db, COL.members, memberDocId);
    const [bs, ms] = [await tx.get(bRef), await tx.get(mRef)];
    if (!bs.exists()) throw new Error('Book not found.');
    if (!ms.exists()) throw new Error('Member not found.');
    const b = bs.data() as Book;
    const m = ms.data() as Member;
    if (!m.active) throw new Error(`${m.name} is not an active member.`);
    if ((b.available ?? 0) <= 0) throw new Error(`No copies of “${b.title}” are available.`);
    const limitN = maxBooks(s, m.type);
    if ((m.issuedCount ?? 0) >= limitN) throw new Error(`${m.name} already has ${m.issuedCount} book(s) (limit ${limitN}).`);
    const due = dueOverride ? dayjs(dueOverride).endOf('day') : dayjs().add(loanDays(s, m.type), 'day').endOf('day');
    tx.set(loanRef, {
      bookId, accessionNo: b.accessionNo, title: b.title,
      memberDocId, memberId: m.memberId, memberName: m.name, memberEmail: (m.email ?? '').toLowerCase(),
      issuedAt: serverTimestamp(), dueAt: Timestamp.fromDate(due.toDate()), status: 'issued', renewals: 0,
      fine: 0, finePaid: false, issuedBy: who(),
    });
    tx.update(bRef, { available: (b.available ?? 0) - 1, updatedAt: serverTimestamp() });
    tx.update(mRef, { issuedCount: (m.issuedCount ?? 0) + 1 });
    return { title: b.title, member: m.name, due: due.format('DD MMM YYYY') };
  });
  // Fulfil this member's reservation for the book, if any.
  const rs = await getDocs(query(collection(db, COL.reservations), where('bookId', '==', bookId), where('memberDocId', '==', memberDocId), where('status', '==', 'active')));
  if (!rs.empty) {
    const batch = writeBatch(db);
    rs.docs.forEach((d) => batch.update(d.ref, { status: 'fulfilled', fulfilledAt: serverTimestamp() }));
    await batch.commit();
  }
  logAudit('library', 'issue', 'loan', loanRef.id, `${result.title} → ${result.member}, due ${result.due}`);
  return result;
}

export async function returnBook(loan: Loan, s: LibrarySettings, finePaidNow: boolean) {
  const fine = computeFine(loan, s);
  await runTransaction(db, async (tx) => {
    const lRef = doc(db, COL.loans, loan.id);
    const bRef = doc(db, COL.books, loan.bookId);
    const mRef = doc(db, COL.members, loan.memberDocId);
    const [ls, bs, ms] = [await tx.get(lRef), await tx.get(bRef), await tx.get(mRef)];
    if (!ls.exists() || ls.data().status !== 'issued') throw new Error('This loan is already closed.');
    tx.update(lRef, { status: 'returned', returnedAt: serverTimestamp(), fine, finePaid: fine === 0 || finePaidNow, returnedBy: who() });
    if (bs.exists()) {
      const b = bs.data() as Book;
      tx.update(bRef, { available: Math.min((b.available ?? 0) + 1, b.copies ?? 1), updatedAt: serverTimestamp() });
    }
    if (ms.exists()) tx.update(mRef, { issuedCount: Math.max(0, ((ms.data() as Member).issuedCount ?? 1) - 1) });
  });
  logAudit('library', 'return', 'loan', loan.id, `${loan.title} ← ${loan.memberName}${fine ? `, fine ₹${fine}${finePaidNow ? ' (paid)' : ' (due)'}` : ''}`);
  return fine;
}

export async function renewLoan(loan: Loan, s: LibrarySettings, memberType: Member['type'], reservedByOthers: boolean) {
  if (reservedByOthers) throw new Error('Cannot renew: another member has reserved this book.');
  if ((loan.renewals ?? 0) >= s.maxRenewals) throw new Error(`Renewal limit (${s.maxRenewals}) reached.`);
  if (computeFine(loan, s) > 0) throw new Error('Loan is overdue. Return it and collect the fine before re-issuing.');
  const due = dayjs().add(loanDays(s, memberType), 'day').endOf('day');
  await updateDoc(doc(db, COL.loans, loan.id), { dueAt: Timestamp.fromDate(due.toDate()), renewals: (loan.renewals ?? 0) + 1 });
  logAudit('library', 'renew', 'loan', loan.id, `${loan.title} for ${loan.memberName}, new due ${due.format('DD MMM YYYY')}`);
  return due.format('DD MMM YYYY');
}

export async function markFinePaid(loan: Loan) {
  await updateDoc(doc(db, COL.loans, loan.id), { finePaid: true, finePaidAt: serverTimestamp(), fineCollectedBy: who() });
  logAudit('library', 'fine_paid', 'loan', loan.id, `₹${loan.fine} from ${loan.memberName}`);
}
