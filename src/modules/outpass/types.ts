import type { TS } from '../../lib/types';

export interface Student {
  id: string; // = lowercase institute email
  email: string;
  idNo: string;
  name: string;
  gender?: string;
  year?: string;
  branch?: string;
  hostel?: string;
  room?: string;
  phone?: string;
  parentPhone?: string;
  status: 'in' | 'out';
  currentOutpassId?: string;
  updatedAt?: TS;
}

export type OutpassType = 'local' | 'home' | 'medical' | 'emergency' | 'official';

export interface Outpass {
  id: string;
  studentEmail: string;
  studentId: string;
  studentName: string;
  hostel?: string;
  type: OutpassType;
  reason: string;
  destination?: string;
  issuedBy: string; // email or username@rosms.local
  issuedByName: string;
  issuedByRole: string;
  issuedAt: TS;
  expectedReturn: TS;
  actualReturn?: TS;
  returnedMarkedBy?: string;
  status: 'out' | 'returned' | 'cancelled';
  late?: boolean;
}

export const OUTPASS_TYPES: { value: OutpassType; label: string }[] = [
  { value: 'local', label: 'Local outing (same day)' },
  { value: 'home', label: 'Home / Leave' },
  { value: 'medical', label: 'Medical' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'official', label: 'Official / Academic' },
];

export const HOSTELS = ['Boys Hostel 1', 'Boys Hostel 2', 'Boys Hostel 3', 'Girls Hostel 1', 'Girls Hostel 2', 'Girls Hostel 3', 'Other'];
