import { doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { num, type BulkColumn } from '../../lib/bulk';
import { batchedWrite, nonBlank } from '../../lib/bulkWrite';
import type { BulkImportConfig } from '../../components/BulkImportDialog';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import { CATEGORIES, COL, DEPTS, safeId, type Book, type Member } from './types';

const BOOK_COLS: BulkColumn[] = [
  { key: 'accessionNo', label: 'Accession No', required: true, aliases: ['Acc No', 'Accession Number', 'Accession', 'AccNo'], help: 'Unique number of the book. Existing accession numbers are updated.' },
  { key: 'title', label: 'Title', required: true, aliases: ['Book Title'] },
  { key: 'author', label: 'Author', aliases: ['Authors', 'Author(s)'] },
  { key: 'isbn', label: 'ISBN' },
  { key: 'category', label: 'Category', aliases: ['Subject'], suggestions: CATEGORIES, help: 'Blank = General' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'edition', label: 'Edition' },
  { key: 'year', label: 'Year', type: 'int', min: 1800, aliases: ['Publication Year'] },
  { key: 'rack', label: 'Rack', aliases: ['Shelf', 'Location', 'Rack / Shelf'] },
  { key: 'copies', label: 'Copies', type: 'int', min: 0, aliases: ['Qty', 'Quantity', 'No of copies', 'Number of copies'], help: 'Total copies owned. Blank = 1 for new books, unchanged for existing ones.' },
  { key: 'price', label: 'Price', type: 'number', min: 0, aliases: ['Price (Rs)', 'Cost', 'Price (₹)'] },
];

export function bookImport(books: Book[]): BulkImportConfig {
  const byId = new Map(books.map((b) => [b.id, b]));
  return {
    title: 'Library books',
    fileName: 'rosms-library-books',
    columns: BOOK_COLS,
    samples: [
      { accessionNo: 'CSE-00125', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest, Stein', isbn: '9780262046305', category: 'Computer Science', publisher: 'MIT Press', edition: '4th', year: 2022, rack: 'R3-S2', copies: 3, price: 1250 },
      { accessionNo: 'GEN-00410', title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', category: 'General', rack: 'R1-S4', copies: 1 },
    ],
    notes: ['Rows are matched on Accession No. When updating, blank cells keep the current value.', 'Copies cannot go below the number of copies currently issued.'],
    keyOf: (v) => (v.accessionNo ? safeId(v.accessionNo) : null),
    existing: (ids) => new Set(ids.filter((id) => byId.has(id))),
    checker: () => (v, { id, exists }) => {
      if (!exists || !v.copies) return null;
      const b = byId.get(id!)!;
      const issued = (b.copies ?? 0) - (b.available ?? 0);
      return num(v.copies) < issued ? `${issued} copies are issued; Copies cannot be less than that` : null;
    },
    commit: async (rows, { source }, r) => {
      await batchedWrite(rows, (row) => {
        const v = row.values;
        const base = { accessionNo: v.accessionNo, title: v.title, author: v.author, isbn: v.isbn, category: v.category, publisher: v.publisher, edition: v.edition, year: v.year ? num(v.year) : '', rack: v.rack, price: v.price ? num(v.price) : '' };
        if (row.exists) {
          const b = byId.get(row.id!)!;
          const issued = (b.copies ?? 0) - (b.available ?? 0);
          const copies = v.copies ? num(v.copies) : b.copies ?? 0;
          return [{ ref: doc(db, COL.books, row.id!), data: { ...nonBlank(base), copies, available: copies - issued, updatedAt: serverTimestamp() }, options: { merge: true } }];
        }
        const copies = v.copies ? num(v.copies) : 1;
        return [{ ref: doc(db, COL.books, row.id!), data: { ...base, category: v.category || 'General', price: num(v.price), copies, available: copies, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } }];
      }, r);
      logAudit('library', 'bulk_upload', 'book', '', `${rows.length} row(s) from ${source}`);
    },
  };
}

const MEMBER_COLS: BulkColumn[] = [
  { key: 'memberId', label: 'Member ID', required: true, aliases: ['ID', 'ID No', 'ID Number', 'Roll No', 'Emp ID', 'Employee ID', 'Student ID'], help: 'Student ID (e.g. O234747) or employee ID. Existing IDs are updated.' },
  { key: 'name', label: 'Name', required: true, aliases: ['Full Name', 'Student Name'] },
  { key: 'type', label: 'Type', type: 'enum', options: ['student', 'faculty', 'staff'], aliases: ['Member Type'], help: 'Blank = student for new members' },
  { key: 'email', label: 'Email', type: 'email', aliases: ['Mail', 'Institute Email'], help: `Must end with @${INSTITUTE_DOMAIN}` },
  { key: 'department', label: 'Department', suggestions: DEPTS, aliases: ['Dept', 'Branch'] },
  { key: 'year', label: 'Year', aliases: ['Class', 'Year / Class'] },
  { key: 'phone', label: 'Phone', aliases: ['Mobile', 'Phone No'] },
  { key: 'active', label: 'Active', type: 'yesno', aliases: ['Status'], help: 'Blank = Yes for new members' },
];

export function memberImport(members: Member[]): BulkImportConfig {
  const byId = new Map(members.map((m) => [m.id, m]));
  return {
    title: 'Library members',
    fileName: 'rosms-library-members',
    columns: MEMBER_COLS,
    samples: [
      { memberId: 'O234747', name: 'K. Ravi Kumar', type: 'student', email: `o234747@${INSTITUTE_DOMAIN}`, department: 'CSE', year: 'E2', phone: '9876543210', active: 'Yes' },
      { memberId: 'EMP1043', name: 'Dr. S. Lakshmi', type: 'faculty', email: `slakshmi@${INSTITUTE_DOMAIN}`, department: 'ECE', active: 'Yes' },
    ],
    notes: ['Rows are matched on Member ID. When updating, blank cells keep the current value.'],
    keyOf: (v) => (v.memberId ? safeId(v.memberId.toUpperCase()) : null),
    existing: (ids) => new Set(ids.filter((id) => byId.has(id))),
    checker: () => (v) => (v.email && !v.email.endsWith('@' + INSTITUTE_DOMAIN) ? `Email must end with @${INSTITUTE_DOMAIN}` : null),
    commit: async (rows, { source }, r) => {
      await batchedWrite(rows, (row) => {
        const v = row.values;
        const base = { memberId: v.memberId.toUpperCase(), name: v.name, type: v.type, email: v.email, department: v.department, year: v.year, phone: v.phone };
        const active = v.active ? v.active === 'Yes' : undefined;
        if (row.exists) {
          return [{ ref: doc(db, COL.members, row.id!), data: { ...nonBlank(base), ...(active !== undefined ? { active } : {}), updatedAt: serverTimestamp() }, options: { merge: true } }];
        }
        return [{ ref: doc(db, COL.members, row.id!), data: { ...base, type: v.type || 'student', active: active ?? true, issuedCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } }];
      }, r);
      logAudit('library', 'bulk_upload', 'member', '', `${rows.length} row(s) from ${source}`);
    },
  };
}
