import { Timestamp, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import type { UserProfile } from '../../lib/types';
import { emailToUsername, ROLE_LABELS } from '../../config/roles';
import type { OutpassType, Student } from './types';

export async function issueOutpass(student: Student, p: { type: OutpassType; reason: string; destination: string; expectedReturn: Date }, issuer: UserProfile) {
  if (p.expectedReturn.getTime() <= Date.now()) throw new Error('Expected return must be in the future.');
  const opRef = doc(collection(db, 'outpasses'));
  const sRef = doc(db, 'students', student.id);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(sRef);
    if (!s.exists()) throw new Error('Student is not registered.');
    if (s.data().status === 'out') throw new Error(`${student.name} is already out of campus on an outpass.`);
    tx.set(opRef, {
      studentEmail: student.id, studentId: student.idNo, studentName: student.name, hostel: student.hostel ?? '',
      type: p.type, reason: p.reason, destination: p.destination,
      issuedBy: auth.currentUser?.email ?? '', issuedByName: issuer.assignedTo || issuer.displayName || emailToUsername(issuer.email),
      issuedByRole: ROLE_LABELS[issuer.role], issuedAt: serverTimestamp(), expectedReturn: Timestamp.fromDate(p.expectedReturn),
      status: 'out', late: false,
    });
    tx.update(sRef, { status: 'out', currentOutpassId: opRef.id, updatedAt: serverTimestamp() });
  });
  logAudit('outpass', 'issue', 'outpass', opRef.id, `${student.idNo} ${student.name}: ${p.reason}`);
  return opRef.id;
}

export async function markReturned(outpassId: string) {
  let summary = '';
  await runTransaction(db, async (tx) => {
    const oRef = doc(db, 'outpasses', outpassId);
    const o = await tx.get(oRef);
    if (!o.exists() || o.data().status !== 'out') throw new Error('This outpass is already closed.');
    const d = o.data();
    const sRef = doc(db, 'students', d.studentEmail);
    const s = await tx.get(sRef);
    const late = (d.expectedReturn as Timestamp).toMillis() < Date.now();
    tx.update(oRef, { status: 'returned', actualReturn: serverTimestamp(), late, returnedMarkedBy: auth.currentUser?.email ?? '' });
    if (s.exists() && s.data().currentOutpassId === outpassId) tx.update(sRef, { status: 'in', currentOutpassId: '', updatedAt: serverTimestamp() });
    summary = `${d.studentId} ${d.studentName}${late ? ' (LATE)' : ''}`;
  });
  logAudit('outpass', 'return', 'outpass', outpassId, summary);
}

export async function cancelOutpass(outpassId: string) {
  await runTransaction(db, async (tx) => {
    const oRef = doc(db, 'outpasses', outpassId);
    const o = await tx.get(oRef);
    if (!o.exists() || o.data().status !== 'out') throw new Error('Only open outpasses can be cancelled.');
    const sRef = doc(db, 'students', o.data().studentEmail);
    const s = await tx.get(sRef);
    tx.update(oRef, { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: auth.currentUser?.email ?? '' });
    if (s.exists() && s.data().currentOutpassId === outpassId) tx.update(sRef, { status: 'in', currentOutpassId: '', updatedAt: serverTimestamp() });
  });
  logAudit('outpass', 'cancel', 'outpass', outpassId);
}
