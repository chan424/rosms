import { collection, doc, endAt, getDoc, getDocs, limit, orderBy, query, startAt } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import type { Student } from './types';

/** Finds students by email, or by ID-number / name prefix, without loading the whole collection. */
export async function searchStudents(term: string): Promise<Student[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  if (t.includes('@')) {
    const s = await getDoc(doc(db, 'students', t.toLowerCase()));
    return s.exists() ? [{ id: s.id, ...(s.data() as Omit<Student, 'id'>) }] : [];
  }
  const up = t.toUpperCase();
  const byId = await getDocs(query(collection(db, 'students'), orderBy('idNo'), startAt(up), endAt(up + '\uf8ff'), limit(20)));
  const exact = await getDoc(doc(db, 'students', `${t.toLowerCase()}@${INSTITUTE_DOMAIN}`));
  const map = new Map<string, Student>();
  if (exact.exists()) map.set(exact.id, { id: exact.id, ...(exact.data() as Omit<Student, 'id'>) });
  byId.docs.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as Omit<Student, 'id'>) }));
  if (map.size < 5) {
    const cap = t.replace(/\b\w/g, (c) => c.toUpperCase());
    const byName = await getDocs(query(collection(db, 'students'), orderBy('name'), startAt(cap), endAt(cap + '\uf8ff'), limit(20)));
    byName.docs.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as Omit<Student, 'id'>) }));
  }
  return [...map.values()];
}
