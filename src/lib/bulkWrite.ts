import { writeBatch, type DocumentReference, type SetOptions } from 'firebase/firestore';
import { db } from './firebase';
import { errMsg } from './format';
import type { BulkReporter, PlannedRow } from '../components/BulkImportDialog';
import type { BulkValues } from './bulk';

/** Keeps only the non-empty values (so blank cells do not wipe existing data when updating). */
export function nonBlank<T extends Record<string, unknown>>(o: T, keep: string[] = []): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (keep.includes(k) || (v !== '' && v !== undefined && v !== null)) out[k] = v;
  return out as Partial<T>;
}

/**
 * Writes rows in Firestore batches (max 500 writes per batch). `ops` returns the writes for one row.
 * If a batch fails, its rows are reported as failed and the next batch continues.
 */
export async function batchedWrite(
  rows: PlannedRow[],
  ops: (row: PlannedRow) => { ref: DocumentReference; data: Record<string, unknown>; options?: SetOptions }[],
  r: BulkReporter,
  rowsPerBatch = 200,
) {
  for (let i = 0; i < rows.length; i += rowsPerBatch) {
    const chunk = rows.slice(i, i + rowsPerBatch);
    const batch = writeBatch(db);
    const ok: PlannedRow[] = [];
    for (const row of chunk) {
      try {
        for (const w of ops(row)) w.options ? batch.set(w.ref, w.data, w.options) : batch.set(w.ref, w.data);
        ok.push(row);
      } catch (e) { r.fail(row, errMsg(e)); }
    }
    try { await batch.commit(); } catch (e) { ok.forEach((row) => r.fail(row, `Not saved: ${errMsg(e)}`)); }
    r.progress(Math.min(rows.length, i + rowsPerBatch));
  }
}

/** Runs one async operation per row (for transactional stock movements). */
export async function sequentialWrite(rows: PlannedRow[], op: (row: PlannedRow) => Promise<void>, r: BulkReporter) {
  let n = 0;
  for (const row of rows) {
    try { await op(row); } catch (e) { r.fail(row, errMsg(e)); }
    r.progress(++n);
  }
}

export const yes = (v: BulkValues, k: string) => v[k] === 'Yes';
