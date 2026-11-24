import { collection, doc, runTransaction, serverTimestamp, type DocumentData, type Transaction } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { getModule } from '../../config/modules';
import { itemsPath, txnsPath, type Batch, type PatientType, type StockItem, type Transfer, type TxnType } from './types';

const who = () => auth.currentUser?.email ?? 'unknown';
const sum = (b: Batch[]) => b.reduce((a, x) => a + x.qty, 0);
const name = (m: string) => getModule(m)?.short ?? m;

interface Movement {
  qty: number;
  receivedOn?: string;
  batchNo?: string;
  expiry?: string;
  reference?: string;
  party?: string;
  remarks?: string;
}

function addBatch(batches: Batch[], batchNo: string, expiry: string, qty: number) {
  const out = batches.map((b) => ({ ...b }));
  const ex = out.find((b) => b.batchNo === batchNo);
  if (ex) { ex.qty += qty; if (expiry) ex.expiry = expiry; } else out.push({ batchNo, expiry, qty });
  return out.sort((a, b) => a.expiry.localeCompare(b.expiry));
}

/** Removes qty from a specific batch, or first-expiry-first-out if none given. Returns batches touched. */
function takeBatch(batches: Batch[], qty: number, batchNo?: string) {
  let out = batches.map((b) => ({ ...b })).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const taken: Batch[] = [];
  let need = qty;
  const pool = batchNo ? out.filter((b) => b.batchNo === batchNo) : out;
  for (const b of pool) {
    if (need <= 0) break;
    const t = Math.min(b.qty, need);
    if (t > 0) { b.qty -= t; need -= t; taken.push({ ...b, qty: t }); }
  }
  if (need > 0) throw new Error(batchNo ? `Batch ${batchNo} does not have enough quantity.` : 'Not enough quantity in batches.');
  out = out.filter((b) => b.qty > 0);
  return { batches: out, taken };
}

function writeTxn(tx: Transaction, moduleId: string, item: StockItem, type: TxnType, m: Movement, balanceAfter: number, transferId?: string) {
  tx.set(doc(collection(db, txnsPath(moduleId))), {
    type, itemId: item.id, itemCode: item.code, itemName: item.name, unit: item.unit, qty: m.qty, balanceAfter,
    batchNo: m.batchNo ?? '', expiry: m.expiry ?? '', reference: m.reference ?? '', party: m.party ?? '', remarks: m.remarks ?? '',
    transferId: transferId ?? '', ...(m.receivedOn ? { receivedOn: m.receivedOn } : {}), at: serverTimestamp(), by: who(),
  });
}

export async function stockIn(moduleId: string, itemId: string, m: Movement, withBatches: boolean) {
  if (!(m.qty > 0)) throw new Error('Quantity must be more than zero.');
  if (withBatches && !m.batchNo?.trim()) m = { ...m, batchNo: 'UNBATCHED' };
  const ref = doc(db, itemsPath(moduleId), itemId);
  const item = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Item not found.');
    const it = { id: s.id, ...s.data() } as StockItem;
    const upd: DocumentData = { updatedAt: serverTimestamp() };
    let q = (it.quantity ?? 0) + m.qty;
    if (withBatches) { const b = addBatch(it.batches ?? [], m.batchNo!, m.expiry ?? '', m.qty); upd.batches = b; q = sum(b); }
    upd.quantity = q;
    tx.update(ref, upd);
    writeTxn(tx, moduleId, it, 'in', m, q);
    return it;
  });
  logAudit(moduleId, 'stock_in', 'item', itemId, `${m.qty} ${item.unit} ${item.name}${m.reference ? ` (ref ${m.reference})` : ''}`);
}

export async function stockOut(moduleId: string, itemId: string, m: Movement, withBatches: boolean) {
  if (!(m.qty > 0)) throw new Error('Quantity must be more than zero.');
  const ref = doc(db, itemsPath(moduleId), itemId);
  const item = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Item not found.');
    const it = { id: s.id, ...s.data() } as StockItem;
    if ((it.quantity ?? 0) < m.qty) throw new Error(`Only ${it.quantity} ${it.unit} in stock.`);
    const upd: DocumentData = { updatedAt: serverTimestamp() };
    let q = it.quantity - m.qty;
    let batchNo = m.batchNo;
    if (withBatches) {
      const r = takeBatch(it.batches ?? [], m.qty, m.batchNo || undefined);
      upd.batches = r.batches; q = sum(r.batches);
      batchNo = r.taken.map((t) => `${t.batchNo}×${t.qty}`).join(', ');
    }
    upd.quantity = q;
    tx.update(ref, upd);
    writeTxn(tx, moduleId, it, 'out', { ...m, batchNo }, q);
    return it;
  });
  logAudit(moduleId, 'stock_out', 'item', itemId, `${m.qty} ${item.unit} ${item.name} to ${m.party ?? '-'}`);
}

export async function adjustStock(moduleId: string, itemId: string, newQty: number, remarks: string) {
  const ref = doc(db, itemsPath(moduleId), itemId);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Item not found.');
    const it = { id: s.id, ...s.data() } as StockItem;
    if (it.batches?.length) throw new Error('Batch-tracked items are adjusted by stock in/out per batch.');
    tx.update(ref, { quantity: newQty, updatedAt: serverTimestamp() });
    writeTxn(tx, moduleId, it, 'adjust', { qty: Math.abs(newQty - (it.quantity ?? 0)), remarks: `${it.quantity} → ${newQty}. ${remarks}` }, newQty);
  });
  logAudit(moduleId, 'adjust', 'item', itemId, `set to ${newQty}: ${remarks}`);
}

export async function createTransfer(fromModule: string, toModule: string, itemId: string, m: Movement) {
  if (fromModule === toModule) throw new Error('Choose a different destination.');
  if (!(m.qty > 0)) throw new Error('Quantity must be more than zero.');
  const tRef = doc(collection(db, 'transfers'));
  const ref = doc(db, itemsPath(fromModule), itemId);
  const item = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Item not found.');
    const it = { id: s.id, ...s.data() } as StockItem;
    if ((it.quantity ?? 0) < m.qty) throw new Error(`Only ${it.quantity} ${it.unit} in stock.`);
    const upd: DocumentData = { updatedAt: serverTimestamp() };
    let q = it.quantity - m.qty;
    let batchNo = '', expiry = '';
    if (it.batches?.length) {
      const r = takeBatch(it.batches, m.qty, m.batchNo || undefined);
      if (r.taken.length > 1) throw new Error('Transfer one batch at a time: pick a batch with enough quantity.');
      upd.batches = r.batches; q = sum(r.batches); batchNo = r.taken[0].batchNo; expiry = r.taken[0].expiry;
    }
    upd.quantity = q;
    tx.update(ref, upd);
    writeTxn(tx, fromModule, it, 'transfer_out', { ...m, batchNo, expiry, party: name(toModule) }, q, tRef.id);
    tx.set(tRef, {
      fromModule, toModule, itemId, itemCode: it.code, itemName: it.name, category: it.category ?? '', unit: it.unit, qty: m.qty,
      batchNo, expiry, remarks: m.remarks ?? '', status: 'pending', requestedBy: who(), createdAt: serverTimestamp(),
    });
    return it;
  });
  logAudit(fromModule, 'transfer_out', 'transfer', tRef.id, `${m.qty} ${item.unit} ${item.name} → ${name(toModule)}`);
}

/** Destination accepts: stock is added to the item with the same code (created if missing). */
export async function acceptTransfer(t: Transfer) {
  const tRef = doc(db, 'transfers', t.id);
  const dRef = doc(db, itemsPath(t.toModule), t.itemId);
  await runTransaction(db, async (tx) => {
    const ts = await tx.get(tRef);
    if (!ts.exists() || ts.data().status !== 'pending') throw new Error('Transfer is no longer pending.');
    const ds = await tx.get(dRef);
    let it: StockItem;
    let batches: Batch[] | undefined;
    let q: number;
    if (ds.exists()) {
      it = { id: ds.id, ...ds.data() } as StockItem;
      if (t.batchNo) { batches = addBatch(it.batches ?? [], t.batchNo, t.expiry ?? '', t.qty); q = sum(batches); } else q = (it.quantity ?? 0) + t.qty;
      tx.update(dRef, { quantity: q, ...(batches ? { batches } : {}), updatedAt: serverTimestamp() });
    } else {
      batches = t.batchNo ? [{ batchNo: t.batchNo, expiry: t.expiry ?? '', qty: t.qty }] : undefined;
      q = t.qty;
      it = { id: t.itemId, code: t.itemCode, name: t.itemName, unit: t.unit, quantity: q, minLevel: 0 };
      tx.set(dRef, { code: t.itemCode, name: t.itemName, category: t.category ?? '', unit: t.unit, quantity: q, minLevel: 0, location: '', unitPrice: 0, description: '', ...(batches ? { batches } : {}), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    writeTxn(tx, t.toModule, it, 'transfer_in', { qty: t.qty, batchNo: t.batchNo, expiry: t.expiry, party: name(t.fromModule), remarks: t.remarks }, q, t.id);
    tx.update(tRef, { status: 'accepted', decidedBy: who(), decidedAt: serverTimestamp() });
  });
  logAudit(t.toModule, 'transfer_in', 'transfer', t.id, `${t.qty} ${t.unit} ${t.itemName} from ${name(t.fromModule)}`);
}

export async function rejectTransfer(t: Transfer, note: string) {
  await runTransaction(db, async (tx) => {
    const tRef = doc(db, 'transfers', t.id);
    const ts = await tx.get(tRef);
    if (!ts.exists() || ts.data().status !== 'pending') throw new Error('Transfer is no longer pending.');
    tx.update(tRef, { status: 'rejected', decidedBy: who(), decidedAt: serverTimestamp(), decisionNote: note });
  });
  logAudit(t.toModule, 'transfer_reject', 'transfer', t.id, `${t.itemName}: ${note}`);
}

/** Source restocks a pending (cancel) or rejected transfer. */
export async function restockTransfer(t: Transfer) {
  const tRef = doc(db, 'transfers', t.id);
  const ref = doc(db, itemsPath(t.fromModule), t.itemId);
  await runTransaction(db, async (tx) => {
    const ts = await tx.get(tRef);
    const st = ts.data()?.status;
    if (st !== 'pending' && st !== 'rejected') throw new Error('Nothing to restock.');
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('Source item no longer exists.');
    const it = { id: s.id, ...s.data() } as StockItem;
    let q: number;
    const upd: DocumentData = { updatedAt: serverTimestamp() };
    if (t.batchNo) { const b = addBatch(it.batches ?? [], t.batchNo, t.expiry ?? '', t.qty); upd.batches = b; q = sum(b); } else q = (it.quantity ?? 0) + t.qty;
    upd.quantity = q;
    tx.update(ref, upd);
    writeTxn(tx, t.fromModule, it, 'transfer_return', { qty: t.qty, batchNo: t.batchNo, expiry: t.expiry, party: name(t.toModule), remarks: st === 'pending' ? 'Cancelled by sender' : 'Rejected by receiver' }, q, t.id);
    tx.update(tRef, { status: st === 'pending' ? 'cancelled' : 'returned', closedAt: serverTimestamp() });
  });
  logAudit(t.fromModule, 'transfer_restock', 'transfer', t.id, `${t.qty} ${t.unit} ${t.itemName}`);
}

export interface Patient {
  type: PatientType;
  id: string;
  name: string;
  complaint?: string;
}

export interface DispenseLine {
  itemId: string;
  qty: number;
  batchNo?: string;
}

/** Hospital issue: one patient, one or more medicines, in a single atomic transaction. */
export async function dispense(moduleId: string, patient: Patient, lines: DispenseLine[]) {
  const valid = lines.filter((l) => l.itemId && l.qty > 0);
  if (!valid.length) throw new Error('Add at least one medicine with a quantity.');
  if (patient.type !== 'writeoff' && !patient.id.trim() && !patient.name.trim()) throw new Error('Enter whom the medicine was given to (ID or name).');
  const pid = patient.id.trim().toUpperCase();
  const pname = patient.name.trim();
  const party = patient.type === 'writeoff' ? 'Write-off' : [pid, pname].filter(Boolean).join(' · ');
  const names: string[] = [];
  await runTransaction(db, async (tx) => {
    const ids = Array.from(new Set(valid.map((l) => l.itemId)));
    const snaps = await Promise.all(ids.map((id) => tx.get(doc(db, itemsPath(moduleId), id))));
    const items: Record<string, StockItem> = {};
    snaps.forEach((s) => {
      if (!s.exists()) throw new Error('A selected medicine no longer exists.');
      items[s.id] = { id: s.id, ...s.data() } as StockItem;
    });
    for (const l of valid) {
      const it = items[l.itemId];
      if ((it.quantity ?? 0) < l.qty) throw new Error(`${it.name}: only ${it.quantity} ${it.unit} in stock.`);
      let batchNo = l.batchNo ?? '';
      if (it.batches?.length) {
        const r = takeBatch(it.batches, l.qty, l.batchNo || undefined);
        it.batches = r.batches;
        it.quantity = sum(r.batches);
        batchNo = r.taken.map((t) => `${t.batchNo}×${t.qty}`).join(', ');
      } else it.quantity -= l.qty;
      names.push(`${l.qty} ${it.unit} ${it.name}`);
      tx.set(doc(collection(db, txnsPath(moduleId))), {
        type: 'out', itemId: it.id, itemCode: it.code, itemName: it.name, unit: it.unit, qty: l.qty, balanceAfter: it.quantity,
        batchNo, expiry: '', reference: '', party, remarks: patient.complaint ?? '', transferId: '',
        patientType: patient.type, patientId: pid, patientName: pname, complaint: (patient.complaint ?? '').trim(),
        at: serverTimestamp(), by: who(),
      });
    }
    for (const id of ids) {
      const it = items[id];
      tx.update(doc(db, itemsPath(moduleId), id), { quantity: it.quantity, ...(it.batches ? { batches: it.batches } : {}), updatedAt: serverTimestamp() });
    }
  });
  logAudit(moduleId, patient.type === 'writeoff' ? 'write_off' : 'issue', 'patient', pid || pname, `${party}: ${names.join('; ')}`);
}
