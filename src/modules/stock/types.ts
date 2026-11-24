import type { TS } from '../../lib/types';

export interface Batch {
  batchNo: string;
  expiry: string; // YYYY-MM-DD
  qty: number;
}

export interface StockItem {
  id: string; // = safe item code, so the same code maps to the same doc across modules
  code: string;
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  minLevel: number;
  location?: string;
  unitPrice?: number;
  description?: string;
  batches?: Batch[];
  createdAt?: TS;
  updatedAt?: TS;
}

export type PatientType = 'student' | 'staff' | 'faculty' | 'other' | 'writeoff';

export const PATIENT_TYPES: { value: PatientType; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'staff', label: 'Staff / Employee' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'other', label: 'Other (visitor, family)' },
  { value: 'writeoff', label: 'Write-off (expired / damaged)' },
];

export type TxnType = 'in' | 'out' | 'adjust' | 'transfer_out' | 'transfer_in' | 'transfer_return';

export interface StockTxn {
  id: string;
  type: TxnType;
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number; // positive number; direction from type
  balanceAfter: number;
  batchNo?: string;
  expiry?: string;
  reference?: string; // invoice / indent / voucher no
  party?: string; // supplier, issued-to person/lab, transfer counterpart
  remarks?: string;
  transferId?: string;
  // Hospital issues
  patientType?: PatientType;
  patientId?: string; // e.g. O234747 or staff ID
  patientName?: string;
  complaint?: string;
  receivedOn?: string; // YYYY-MM-DD for receipts
  at: TS;
  by: string;
}

export interface Transfer {
  id: string;
  fromModule: string;
  toModule: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  category?: string;
  unit: string;
  qty: number;
  batchNo?: string;
  expiry?: string;
  remarks?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'returned';
  requestedBy: string;
  createdAt: TS;
  decidedBy?: string;
  decidedAt?: TS;
  decisionNote?: string;
}

export const TXN_LABEL: Record<TxnType, string> = {
  in: 'Stock in', out: 'Stock out', adjust: 'Adjustment', transfer_out: 'Transfer out', transfer_in: 'Transfer in', transfer_return: 'Transfer returned',
};

export const UNITS = ['Nos', 'Pcs', 'Box', 'Pack', 'Set', 'Kg', 'g', 'Litre', 'ml', 'Metre', 'Roll', 'Bag', 'Bottle', 'Strip', 'Tablet', 'Vial', 'Ream', 'Pair'];

export const itemsPath = (moduleId: string) => `stock/${moduleId}/items`;
export const txnsPath = (moduleId: string) => `stock/${moduleId}/txns`;
export const safeCode = (s: string) => s.trim().toUpperCase().replace(/[/#?\s]+/g, '-').slice(0, 120);
