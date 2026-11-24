import type { TS } from '../../lib/types';

export interface Book {
  id: string;
  accessionNo: string;
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  publisher?: string;
  edition?: string;
  year?: number | string;
  rack?: string;
  copies: number;
  available: number;
  price?: number;
  createdAt?: TS;
  updatedAt?: TS;
}

export type MemberType = 'student' | 'faculty' | 'staff';

export interface Member {
  id: string;
  memberId: string; // student ID number / employee ID
  name: string;
  email?: string;
  type: MemberType;
  department?: string;
  year?: string;
  phone?: string;
  active: boolean;
  issuedCount: number;
  createdAt?: TS;
}

export interface Loan {
  id: string;
  bookId: string;
  accessionNo: string;
  title: string;
  memberDocId: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  issuedAt: TS;
  dueAt: TS;
  returnedAt?: TS;
  status: 'issued' | 'returned';
  renewals: number;
  fine: number;
  finePaid: boolean;
  issuedBy: string;
  returnedBy?: string;
}

export interface Reservation {
  id: string;
  bookId: string;
  title: string;
  accessionNo: string;
  memberDocId: string;
  memberId: string;
  memberName: string;
  memberEmail?: string;
  reservedAt: TS;
  status: 'active' | 'fulfilled' | 'cancelled';
}

export interface LibrarySettings {
  loanDaysStudent: number;
  loanDaysFaculty: number;
  loanDaysStaff: number;
  maxBooksStudent: number;
  maxBooksFaculty: number;
  maxBooksStaff: number;
  finePerDay: number;
  maxRenewals: number;
}

export const DEFAULT_SETTINGS: LibrarySettings = {
  loanDaysStudent: 14,
  loanDaysFaculty: 30,
  loanDaysStaff: 30,
  maxBooksStudent: 3,
  maxBooksFaculty: 10,
  maxBooksStaff: 5,
  finePerDay: 1,
  maxRenewals: 2,
};

export const loanDays = (s: LibrarySettings, t: MemberType) =>
  t === 'student' ? s.loanDaysStudent : t === 'faculty' ? s.loanDaysFaculty : s.loanDaysStaff;

export const maxBooks = (s: LibrarySettings, t: MemberType) =>
  t === 'student' ? s.maxBooksStudent : t === 'faculty' ? s.maxBooksFaculty : s.maxBooksStaff;

export const CATEGORIES = [
  'Computer Science', 'Electronics', 'Electrical', 'Mechanical', 'Civil', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'English', 'Telugu', 'Management', 'General', 'Competitive Exams', 'Reference', 'Journals', 'Fiction',
];

export const COL = {
  books: 'library_books',
  members: 'library_members',
  loans: 'library_loans',
  reservations: 'library_reservations',
  settings: 'library_settings',
} as const;
