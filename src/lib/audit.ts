import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Append-only audit trail. Rules forbid update/delete of audit entries. */
export async function logAudit(
  module: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
) {
  const u = auth.currentUser;
  if (!u) return;
  try {
    await addDoc(collection(db, 'audit'), {
      at: serverTimestamp(),
      uid: u.uid,
      email: u.email ?? '',
      module,
      action,
      entity,
      entityId: entityId ?? '',
      details: (details ?? '').slice(0, 500),
    });
  } catch (e) {
    console.warn('audit log failed', e);
  }
}
