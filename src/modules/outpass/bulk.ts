import { collection, doc, documentId, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import type { BulkColumn } from '../../lib/bulk';
import { batchedWrite, nonBlank } from '../../lib/bulkWrite';
import type { BulkImportConfig } from '../../components/BulkImportDialog';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import { HOSTELS } from './types';

const COLS: BulkColumn[] = [
  { key: 'idNo', label: 'ID No', aliases: ['ID', 'Student ID', 'ID Number', 'Roll No', 'Regd No'], help: `e.g. O234747. Either ID No or Email is needed; the email is ID@${INSTITUTE_DOMAIN}.` },
  { key: 'email', label: 'Email', type: 'email', aliases: ['Mail', 'Institute Email', 'Mail ID'], help: `Optional if ID No is given. Must end with @${INSTITUTE_DOMAIN}` },
  { key: 'name', label: 'Name', required: true, aliases: ['Student Name', 'Full Name'] },
  { key: 'gender', label: 'Gender', type: 'enum', options: ['Male', 'Female', 'Other'], aliases: ['Sex'] },
  { key: 'year', label: 'Year', aliases: ['Class', 'Batch'], help: 'PUC1, PUC2, E1, E2, E3, E4' },
  { key: 'branch', label: 'Branch', aliases: ['Department', 'Dept'] },
  { key: 'hostel', label: 'Hostel', suggestions: HOSTELS, aliases: ['Hostel Name', 'Block'] },
  { key: 'room', label: 'Room', aliases: ['Room No'] },
  { key: 'phone', label: 'Phone', aliases: ['Mobile', 'Student Phone', 'Student Mobile'] },
  { key: 'parentPhone', label: 'Parent Phone', aliases: ['Parent Mobile', 'Father Phone', 'Guardian Phone'] },
];

const emailOf = (v: Record<string, string>) => (v.email || (v.idNo ? `${v.idNo.toLowerCase()}@${INSTITUTE_DOMAIN}` : '')).toLowerCase();

export function studentImport(): BulkImportConfig {
  return {
    title: 'Students',
    fileName: 'rosms-students',
    columns: COLS,
    samples: [
      { idNo: 'O234747', name: 'K. Ravi Kumar', gender: 'Male', year: 'E2', branch: 'CSE', hostel: 'Boys Hostel 1', room: '214', phone: '9876543210', parentPhone: '9123456780' },
      { idNo: 'O221093', name: 'P. Sravani', gender: 'Female', year: 'PUC2', branch: 'PUC', hostel: 'Girls Hostel 2', room: 'G-08', parentPhone: '9988776655' },
    ],
    notes: ['Rows are matched on the institute email (from ID No). When updating, blank cells keep the current value.', 'New students start as “In campus”. Uploading never changes a student’s in/out status.'],
    keyOf: (v) => emailOf(v) || null,
    existing: async (ids) => {
      const found = new Set<string>();
      const valid = ids.filter((id) => id.endsWith('@' + INSTITUTE_DOMAIN));
      for (let i = 0; i < valid.length; i += 30) {
        const snap = await getDocs(query(collection(db, 'students'), where(documentId(), 'in', valid.slice(i, i + 30))));
        snap.docs.forEach((d) => found.add(d.id));
      }
      return found;
    },
    checker: () => (v) => {
      const e = emailOf(v);
      if (!e) return 'ID No or Email is required';
      if (!e.endsWith('@' + INSTITUTE_DOMAIN)) return `Email must end with @${INSTITUTE_DOMAIN}`;
      if (!/^[a-z0-9._-]+@/.test(e)) return 'ID No has invalid characters';
      return null;
    },
    commit: async (rows, { source }, r) => {
      await batchedWrite(rows, (row) => {
        const v = row.values;
        const email = row.id!;
        const data = { email, idNo: email.split('@')[0].toUpperCase(), name: v.name, gender: v.gender, year: v.year, branch: v.branch, hostel: v.hostel, room: v.room, phone: v.phone, parentPhone: v.parentPhone };
        if (row.exists) return [{ ref: doc(db, 'students', email), data: { ...nonBlank(data), updatedAt: serverTimestamp() }, options: { merge: true } }];
        return [{ ref: doc(db, 'students', email), data: { ...data, status: 'in', currentOutpassId: '', updatedAt: serverTimestamp() } }];
      }, r, 400);
      logAudit('outpass', 'bulk_upload', 'student', '', `${rows.length} row(s) from ${source}`);
    },
  };
}
