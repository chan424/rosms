import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { num, type BulkColumn } from '../../lib/bulk';
import { batchedWrite, nonBlank, sequentialWrite } from '../../lib/bulkWrite';
import type { BulkImportConfig, PlannedRow } from '../../components/BulkImportDialog';
import type { ModuleDef } from '../../config/modules';
import { adjustStock, dispense, stockIn, stockOut } from './ops';
import { PATIENT_TYPES, UNITS, itemsPath, safeCode, txnsPath, type PatientType, type StockItem } from './types';

const who = () => auth.currentUser?.email ?? '';

/** Item master upload: add new items (with opening stock) and update details of existing ones. */
export function itemImport(def: ModuleDef, items: StockItem[]): BulkImportConfig {
  const B = !!def.batches;
  const byId = new Map(items.map((i) => [i.id, i]));
  const noun = B ? 'medicines' : 'items';
  const columns: BulkColumn[] = [
    { key: 'code', label: 'Item Code', required: true, aliases: ['Code', 'Item No', 'Part No', 'Medicine Code'], help: 'Unique code. Use the same code in every module so transfers match. Existing codes are updated.' },
    { key: 'name', label: B ? 'Medicine Name' : 'Item Name', required: true, aliases: ['Name', 'Item', 'Item Name', 'Medicine', 'Medicine Name', 'Description of Item'] },
    { key: 'unit', label: 'Unit', suggestions: UNITS, aliases: ['UOM', 'Units'], help: `Blank = ${B ? 'Nos' : 'Nos'}. Usual: ${UNITS.join(', ')}` },
    { key: 'category', label: 'Category', aliases: ['Type', 'Group'] },
    { key: 'location', label: 'Location', aliases: ['Lab', 'Store', 'Room', 'Location / Lab / Store'] },
    { key: 'minLevel', label: 'Min Level', type: 'number', min: 0, aliases: ['Minimum Level', 'Reorder Level', 'Min Stock', 'Min'], help: 'Low-stock alert below this quantity' },
    { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, aliases: ['Rate', 'Price', 'Unit Price (Rs)', 'Cost'] },
    { key: 'quantity', label: 'Quantity', type: 'number', min: 0, aliases: ['Qty', 'Opening Stock', 'Opening Quantity', 'Stock', 'Balance', 'Physical Count'],
      help: B ? 'Opening stock for new medicines. For existing medicines use Bulk stock in/out.' : 'Opening stock for new items. For existing items it is used only if you tick "apply as physical count".' },
    ...(B ? [
      { key: 'batchNo', label: 'Batch No', aliases: ['Batch'], help: 'Batch of the opening stock (blank = OPENING)' } as BulkColumn,
      { key: 'expiry', label: 'Expiry', type: 'date', aliases: ['Expiry Date', 'Exp Date', 'Exp'], help: 'Expiry of the opening stock batch' } as BulkColumn,
    ] : []),
    { key: 'description', label: 'Description', aliases: ['Specifications', 'Specification', 'Remarks'] },
  ];
  return {
    title: `${def.short} ${noun}`,
    fileName: `rosms-${def.id}-items`,
    columns,
    samples: B ? [
      { code: 'TAB-001', name: 'Paracetamol 500 mg', unit: 'Tablet', category: 'Tablets', location: 'Dispensary', minLevel: 200, unitPrice: 1.2, quantity: 1000, batchNo: 'PCM2405', expiry: '2027-03-31' },
      { code: 'SYR-004', name: 'Cough syrup 100 ml', unit: 'Bottle', category: 'Ointments, Drops & Syrups', minLevel: 10, quantity: 24, batchNo: 'CS118', expiry: '2026-12-31' },
    ] : [
      { code: 'CHAIR-01', name: 'Plastic chair (with arms)', unit: 'Nos', category: 'Furniture', location: 'Store room 2', minLevel: 10, unitPrice: 950, quantity: 120, description: 'Supreme, grey' },
      { code: 'A4-PAPER', name: 'A4 paper 75 GSM', unit: 'Ream', category: 'Stationery', location: 'Main store', minLevel: 20, unitPrice: 260, quantity: 50 },
    ],
    notes: [
      `Rows are matched on Item Code. New ${noun} are added with Quantity as opening stock (written to the ledger).`,
      'When updating, blank cells keep the current value. Stock quantities of existing items change only through the ledger.',
    ],
    keyOf: (v) => (v.code ? safeCode(v.code) : null),
    existing: (ids) => new Set(ids.filter((id) => byId.has(id))),
    flags: B ? [] : [{ key: 'adjust', label: 'Apply Quantity of existing items as a physical count', help: 'Posts an "Adjustment" in the ledger for every existing item whose Quantity differs from the system stock.' }],
    commit: async (rows, { flags, source }, r) => {
      const adj: PlannedRow[] = [];
      const progress = (n: number) => r.progress(Math.min(rows.length, n));
      await batchedWrite(rows, (row) => {
        const v = row.values;
        const base = { code: v.code.toUpperCase(), name: v.name, unit: v.unit, category: v.category, location: v.location, minLevel: v.minLevel === '' ? '' : num(v.minLevel), unitPrice: v.unitPrice === '' ? '' : num(v.unitPrice), description: v.description };
        const ref = doc(db, itemsPath(def.id), row.id!);
        if (row.exists) {
          const cur = byId.get(row.id!)!;
          if (!B && flags.adjust && v.quantity !== '' && num(v.quantity) !== (cur.quantity ?? 0)) adj.push(row);
          return [{ ref, data: { ...nonBlank(base), updatedAt: serverTimestamp() }, options: { merge: true } }];
        }
        const qty = num(v.quantity);
        const unit = v.unit || 'Nos';
        const batchNo = B && qty > 0 ? v.batchNo || 'OPENING' : '';
        const item = { ...base, unit, minLevel: num(v.minLevel), unitPrice: num(v.unitPrice), quantity: qty, ...(B ? { batches: qty > 0 ? [{ batchNo, expiry: v.expiry, qty }] : [] } : {}), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        const writes = [{ ref, data: item as Record<string, unknown> }];
        if (qty > 0) writes.push({ ref: doc(collection(db, txnsPath(def.id))), data: {
          type: 'in', itemId: row.id, itemCode: base.code, itemName: base.name, unit, qty, balanceAfter: qty, batchNo, expiry: B ? v.expiry : '',
          reference: source, party: 'Opening balance', remarks: 'Opening stock (bulk upload)', transferId: '', at: serverTimestamp(), by: who(),
        } });
        return writes;
      }, { ...r, progress }, 150);
      for (const row of adj) {
        try { await adjustStock(def.id, row.id!, num(row.values.quantity), `Physical count (bulk upload: ${source})`); } catch (e) { r.fail(row, (e as Error).message); }
      }
      logAudit(def.id, 'bulk_upload', 'item', '', `${rows.length} row(s) from ${source}${adj.length ? `, ${adj.length} count adjustment(s)` : ''}`);
    },
  };
}

/** Bulk stock movements: many receipts (IN) and issues (OUT) in one sheet, each written to the ledger. */
export function movementImport(def: ModuleDef, items: StockItem[]): BulkImportConfig {
  const B = !!def.batches;
  const byId = new Map(items.map((i) => [i.id, i]));
  const ptypes = PATIENT_TYPES.map((p) => p.value);
  const columns: BulkColumn[] = [
    { key: 'code', label: 'Item Code', required: true, aliases: ['Code', 'Medicine Code'], help: 'Must already exist in this module (add it with the items upload first).' },
    { key: 'movement', label: 'Movement', required: true, type: 'enum', options: ['IN', 'OUT'], aliases: ['Type', 'In/Out', 'Transaction'], help: 'IN = received, OUT = issued' },
    { key: 'qty', label: 'Quantity', required: true, type: 'number', min: 0.0001, aliases: ['Qty'] },
    { key: 'date', label: 'Date', type: 'date', aliases: ['Received On', 'Issue Date'], help: 'Receipt date (kept with IN rows). The ledger time is the upload time.' },
    { key: 'reference', label: 'Reference', aliases: ['Invoice No', 'Indent No', 'Voucher No', 'Ref', 'DC No'] },
    { key: 'party', label: B ? 'Supplier / Issued To' : 'Supplier / Issued To', aliases: ['Party', 'Supplier', 'Issued To', 'Received From'], help: B ? 'Supplier for IN rows' : 'Supplier for IN; person / lab for OUT (required for OUT)' },
    ...(B ? [
      { key: 'batchNo', label: 'Batch No', aliases: ['Batch'], help: 'IN: batch received. OUT: blank = earliest expiry first' } as BulkColumn,
      { key: 'expiry', label: 'Expiry', type: 'date', aliases: ['Expiry Date', 'Exp Date'] } as BulkColumn,
      { key: 'ptype', label: 'Patient Type', type: 'enum', options: ptypes, aliases: ['Given To'], help: `OUT rows: ${ptypes.join(', ')} (blank = student)` } as BulkColumn,
      { key: 'pid', label: 'Patient ID', aliases: ['Student ID', 'Staff ID', 'ID No'], help: 'OUT rows, e.g. O234747' } as BulkColumn,
      { key: 'pname', label: 'Patient Name', aliases: ['Name'] } as BulkColumn,
      { key: 'complaint', label: 'Complaint', aliases: ['Diagnosis', 'Reason'] } as BulkColumn,
    ] : []),
    { key: 'remarks', label: 'Remarks', aliases: ['Purpose'] },
  ];
  return {
    title: `${def.short} stock in / out`,
    fileName: `rosms-${def.id}-stock-movements`,
    columns,
    samples: B ? [
      { code: 'TAB-001', movement: 'IN', qty: 500, date: '2026-11-20', reference: 'INV-7781', party: 'Govt. medical stores', batchNo: 'PCM2411', expiry: '2028-10-31' },
      { code: 'TAB-001', movement: 'OUT', qty: 6, ptype: 'student', pid: 'O234747', pname: 'K. Ravi Kumar', complaint: 'Fever' },
    ] : [
      { code: 'A4-PAPER', movement: 'IN', qty: 40, date: '2026-11-20', reference: 'INV-2231', party: 'Sri Sai Stationers' },
      { code: 'A4-PAPER', movement: 'OUT', qty: 5, reference: 'IND-118', party: 'CSE Lab 3', remarks: 'Lab records' },
    ],
    notes: ['Each row is posted to the ledger in sheet order. OUT rows cannot take stock below zero.'],
    checker: () => {
      const running = new Map<string, number>();
      return (v) => {
        const id = safeCode(v.code);
        const it = byId.get(id);
        if (!it) return `Item code ${v.code} not found in ${def.short}`;
        const have = running.get(id) ?? it.quantity ?? 0;
        const q = num(v.qty);
        if (v.movement === 'OUT') {
          if (q > have) return `Only ${have} ${it.unit} available`;
          if (!B && !v.party) return 'Supplier / Issued To is required for OUT rows';
          if (B && (v.ptype || 'student') !== 'writeoff' && !v.pid && !v.pname) return 'Patient ID or name is required for OUT rows';
          running.set(id, have - q);
        } else running.set(id, have + q);
        return null;
      };
    },
    commit: async (rows, { source }, r) => {
      await sequentialWrite(rows, async (row) => {
        const v = row.values;
        const id = safeCode(v.code);
        const qty = num(v.qty);
        if (v.movement === 'IN') {
          await stockIn(def.id, id, { qty, receivedOn: v.date || undefined, batchNo: v.batchNo, expiry: v.expiry, reference: v.reference, party: v.party, remarks: v.remarks || 'Bulk upload' }, B);
        } else if (B) {
          await dispense(def.id, { type: (v.ptype || 'student') as PatientType, id: v.pid ?? '', name: v.pname ?? '', complaint: v.complaint || v.remarks }, [{ itemId: id, qty, batchNo: v.batchNo || undefined }]);
        } else {
          await stockOut(def.id, id, { qty, reference: v.reference, party: v.party, remarks: v.remarks }, false);
        }
      }, r);
      logAudit(def.id, 'bulk_movements', 'item', '', `${rows.length} movement(s) from ${source}`);
    },
  };
}
