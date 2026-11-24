import { Button, Chip, IconButton, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UploadIcon from '@mui/icons-material/UploadFile';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../lib/AuthContext';
import { canManage } from '../../lib/permissions';
import { parseMedicineRows, readWorkbookRows } from './medicineSheet';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg, inr } from '../../lib/format';
import BulkImportDialog from '../../components/BulkImportDialog';
import { itemImport, movementImport } from './bulk';
import { STOCK_MODULES } from '../../config/modules';
import { useStock } from './StockModule';
import { adjustStock, createTransfer, dispense, stockIn, stockOut } from './ops';
import { PATIENT_TYPES, UNITS, itemsPath, safeCode, txnsPath, type PatientType, type StockItem } from './types';
import { auth, db as fdb } from '../../lib/firebase';
import { collection } from 'firebase/firestore';

type Action = 'in' | 'out' | 'adjust' | 'transfer';

export default function Items() {
  const { def, items, loading } = useStock();
  const notify = useNotify();
  const [edit, setEdit] = useState<StockItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [act, setAct] = useState<{ a: Action; item: StockItem } | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; item: StockItem } | null>(null);
  const [del, setDel] = useState<StockItem | null>(null);
  const [bulk, setBulk] = useState<'items' | 'moves' | null>(null);
  const [bulkMenu, setBulkMenu] = useState<HTMLElement | null>(null);
  const B = !!def.batches;
  const nav = useNavigate();
  const access = useAuth();
  const manager = canManage(access, def.id);
  const sheetRef = useRef<HTMLInputElement>(null);

  const itemFields: Field[] = [
    { name: 'code', label: 'Item code', required: true, half: true, helper: 'Same code across modules lets transfers match items' },
    { name: 'unit', label: 'Unit', type: 'select', required: true, half: true, options: UNITS.map((u) => ({ value: u, label: u })) },
    { name: 'name', label: 'Item name', required: true },
    { name: 'category', label: 'Category', half: true },
    { name: 'location', label: 'Location / Lab / Store', half: true },
    { name: 'minLevel', label: 'Minimum stock level (alert)', type: 'number', half: true, min: 0 },
    { name: 'unitPrice', label: 'Unit price (₹)', type: 'number', half: true, min: 0 },
    ...(!edit && !B ? [{ name: 'quantity', label: 'Opening quantity', type: 'number', half: true, min: 0 } as Field] : []),
    { name: 'description', label: 'Description / Specifications', type: 'textarea' },
  ];

  const saveItem = async (v: FormValues) => {
    const data = {
      code: v.code.trim().toUpperCase(), name: v.name.trim(), unit: v.unit, category: v.category.trim(), location: v.location.trim(),
      minLevel: Number(v.minLevel) || 0, unitPrice: Number(v.unitPrice) || 0, description: v.description.trim(), updatedAt: serverTimestamp(),
    };
    if (edit) {
      await updateDoc(doc(db, itemsPath(def.id), edit.id), data);
      logAudit(def.id, 'update', 'item', edit.id, data.name);
      notify('Item updated.');
    } else {
      const id = safeCode(data.code);
      if (items.some((i) => i.id === id)) throw new Error('An item with this code already exists.');
      const q = Number(v.quantity) || 0;
      await setDoc(doc(db, itemsPath(def.id), id), { ...data, quantity: 0, ...(B ? { batches: [] } : {}), createdAt: serverTimestamp() });
      if (q > 0) await stockIn(def.id, id, { qty: q, remarks: 'Opening stock' }, false);
      logAudit(def.id, 'create', 'item', id, data.name);
      notify('Item added.');
    }
  };

  const remove = async (i: StockItem) => {
    if ((i.quantity ?? 0) > 0) return notify('Only items with zero stock can be deleted. Issue or adjust to zero first.', 'error');
    try { await deleteDoc(doc(db, itemsPath(def.id), i.id)); logAudit(def.id, 'delete', 'item', i.id, i.name); notify('Item deleted.'); } catch (e) { notify(errMsg(e), 'error'); }
  };

  const actionFields = (a: Action, it: StockItem): Field[] => {
    const batchOpts = (it.batches ?? []).map((b) => ({ value: b.batchNo, label: `${b.batchNo} · exp ${b.expiry} · ${b.qty} ${it.unit}` }));
    if (a === 'in' && B) return [
      { name: 'qty', label: `Quantity received (${it.unit})`, type: 'number', required: true, half: true, min: 1 },
      { name: 'receivedOn', label: 'Received on', type: 'date', required: true, half: true },
      { name: 'batchNo', label: 'Batch no.', half: true },
      { name: 'expiry', label: 'Expiry date', type: 'date', half: true },
      { name: 'party', label: 'Supplier / received from', half: true },
      { name: 'reference', label: 'Indent / invoice no.', half: true },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ];
    if (a === 'out' && B) return [
      { name: 'ptype', label: 'Given to', type: 'select', required: true, half: true, options: PATIENT_TYPES.map((p) => ({ value: p.value, label: p.label })) },
      { name: 'qty', label: `Quantity (${it.unit}) — in stock ${it.quantity}`, type: 'number', required: true, half: true, min: 1 },
      { name: 'pid', label: 'Student ID (e.g. O234747) / staff ID', half: true },
      { name: 'pname', label: 'Name', half: true },
      { name: 'batchNo', label: 'Batch', type: 'select', options: [{ value: '', label: 'Auto (earliest expiry)' }, ...batchOpts] },
      { name: 'complaint', label: 'Complaint / diagnosis / reason (optional)', type: 'textarea' },
    ];
    if (a === 'in') return [
      { name: 'qty', label: `Quantity (${it.unit})`, type: 'number', required: true, half: true, min: 1 },
      { name: 'reference', label: 'Invoice / DC / Voucher no.', half: true },
      ...(B ? [{ name: 'batchNo', label: 'Batch no.', required: true, half: true } as Field, { name: 'expiry', label: 'Expiry date', type: 'date', required: true, half: true } as Field] : []),
      { name: 'party', label: 'Supplier / Received from' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ];
    if (a === 'out') return [
      { name: 'qty', label: `Quantity (${it.unit}) — in stock ${it.quantity}`, type: 'number', required: true, half: true, min: 1 },
      { name: 'reference', label: 'Indent / Requisition no.', half: true },
      ...(B ? [{ name: 'batchNo', label: 'Batch (blank = earliest expiry first)', type: 'select', options: [{ value: '', label: 'Auto (FEFO)' }, ...batchOpts] } as Field] : []),
      { name: 'party', label: 'Issued to (person / lab / patient ID)', required: true },
      { name: 'remarks', label: 'Purpose / Remarks', type: 'textarea' },
    ];
    if (a === 'adjust') return [
      { name: 'qty', label: `New physical count (${it.unit}) — system shows ${it.quantity}`, type: 'number', required: true, min: 0 },
      { name: 'remarks', label: 'Reason (stock verification, damage, loss…)', type: 'textarea', required: true },
    ];
    return [
      { name: 'to', label: 'Transfer to', type: 'select', required: true, options: STOCK_MODULES.filter((m) => m.id !== def.id).map((m) => ({ value: m.id, label: m.name })) },
      { name: 'qty', label: `Quantity (${it.unit}) — in stock ${it.quantity}`, type: 'number', required: true, half: true, min: 1 },
      ...(B ? [{ name: 'batchNo', label: 'Batch', type: 'select', half: true, options: [{ value: '', label: 'Auto (FEFO)' }, ...batchOpts] } as Field] : []),
      { name: 'remarks', label: 'Remarks / Indent ref.', type: 'textarea' },
    ];
  };

  const doAction = async (v: FormValues) => {
    if (!act) return;
    const { a, item } = act;
    const m = { qty: Number(v.qty), reference: v.reference, party: v.party, remarks: v.remarks, batchNo: v.batchNo, expiry: v.expiry, receivedOn: v.receivedOn };
    if (a === 'out' && B) await dispense(def.id, { type: (v.ptype || 'student') as PatientType, id: v.pid ?? '', name: v.pname ?? '', complaint: v.complaint }, [{ itemId: item.id, qty: Number(v.qty), batchNo: v.batchNo }]);
    else if (a === 'in') await stockIn(def.id, item.id, m, B);
    else if (a === 'out') await stockOut(def.id, item.id, m, B);
    else if (a === 'adjust') await adjustStock(def.id, item.id, Number(v.qty), v.remarks);
    else await createTransfer(def.id, v.to, item.id, m);
    notify(a === 'transfer' ? 'Transfer sent. The receiving module must accept it.' : 'Stock updated.');
  };

  const importMedicineSheet = async (f: File) => {
    try {
      const rows = parseMedicineRows(await readWorkbookRows(f));
      if (!rows.length) return notify('No medicine rows found. Expected columns S No, Indent, Quantity under section headings.', 'error');
      const byName = new Set(items.map((i) => i.name.trim().toLowerCase()));
      const ids = new Set(items.map((i) => i.id));
      let added = 0, skipped = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const batch = writeBatch(db);
        for (const r of rows.slice(i, i + 200)) {
          if (byName.has(r.name.toLowerCase())) { skipped++; continue; }
          let id = safeCode(r.code);
          for (let n = 2; ids.has(id); n++) id = `${safeCode(r.code)}-${n}`;
          ids.add(id); byName.add(r.name.toLowerCase());
          const batches = r.qty > 0 ? [{ batchNo: 'OPENING', expiry: '', qty: r.qty }] : [];
          batch.set(doc(db, itemsPath(def.id), id), { code: id, name: r.name, category: r.category, unit: r.unit, quantity: r.qty, batches, minLevel: r.unit === 'Tablet' ? 50 : 2, location: 'Dispensary', unitPrice: 0, description: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          batch.set(doc(collection(fdb, txnsPath(def.id))), { type: 'in', itemId: id, itemCode: id, itemName: r.name, unit: r.unit, qty: r.qty, balanceAfter: r.qty, batchNo: r.qty > 0 ? 'OPENING' : '', expiry: '', reference: f.name, party: 'Opening balance', remarks: 'Opening stock (sheet import)', transferId: '', at: serverTimestamp(), by: auth.currentUser?.email ?? '' });
          added++;
        }
        await batch.commit();
      }
      logAudit(def.id, 'import_opening_stock', 'item', '', `${added} added, ${skipped} skipped from ${f.name}`);
      notify(`Imported ${added} medicine(s) as opening stock; ${skipped} already existed and were skipped.`, added ? 'success' : 'info');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<StockItem>[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Item', render: (i) => (<><Typography variant="body2" fontWeight={600}>{i.name}</Typography>{B && (i.batches?.length ?? 0) > 0 && <Typography variant="caption" color="text.secondary">{i.batches!.length} batch(es), next expiry {i.batches![0].expiry}</Typography>}</>) },
    { key: 'category', label: 'Category', hideOnMobile: true },
    { key: 'location', label: 'Location', hideOnMobile: true },
    { key: 'quantity', label: 'In stock', align: 'right', value: (i) => i.quantity ?? 0, render: (i) => <Chip size="small" color={(i.quantity ?? 0) <= (i.minLevel ?? 0) ? 'error' : 'success'} label={`${i.quantity ?? 0} ${i.unit}`} /> },
    { key: 'minLevel', label: 'Min', align: 'right', hideOnMobile: true },
    { key: 'unitPrice', label: 'Value', align: 'right', hideOnMobile: true, value: (i) => (i.quantity ?? 0) * (i.unitPrice ?? 0), render: (i) => inr((i.quantity ?? 0) * (i.unitPrice ?? 0)) },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (i) => (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Button size="small" variant="outlined" color="success" onClick={() => setAct({ a: 'in', item: i })}>{B ? 'Receive' : 'In'}</Button>
        <Button size="small" variant="outlined" color="warning" disabled={!i.quantity} onClick={() => setAct({ a: 'out', item: i })}>{B ? 'Issue' : 'Out'}</Button>
        <IconButton size="small" onClick={(e) => setMenu({ el: e.currentTarget, item: i })}><MoreVertIcon fontSize="small" /></IconButton>
      </Stack>
    ) },
  ];

  const titles: Record<Action, string> = { in: 'Stock in', out: 'Stock out / Issue', adjust: 'Adjust stock (physical verification)', transfer: 'Transfer to another module' };

  return (
    <>
      <DataTable title="Items" rows={items} columns={columns} loading={loading} exportName={`${def.id}-items`} dense
        toolbar={<>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add item</Button>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={(e) => setBulkMenu(e.currentTarget)}>Bulk upload (Excel)</Button>
          {B && manager && <>
            <Tooltip title="Upload the hospital stock sheet (sections like TABLETS / OINTMENTS / INJECTIONS, columns S No · Indent · Quantity; 'Nill' = 0). New medicines are added with their quantity as opening stock; existing names are skipped.">
              <Button variant="outlined" color="secondary" startIcon={<UploadIcon />} onClick={() => sheetRef.current?.click()}>Import stock sheet</Button>
            </Tooltip>
            <input ref={sheetRef} type="file" hidden accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) importMedicineSheet(f); e.target.value = ''; }} />
          </>}
        </>} />
      <Menu anchorEl={bulkMenu} open={!!bulkMenu} onClose={() => setBulkMenu(null)}>
        <MenuItem onClick={() => { setBulk('items'); setBulkMenu(null); }}>
          <Stack><Typography variant="body2">{B ? 'Medicines' : 'Items'}: add new / update details</Typography><Typography variant="caption" color="text.secondary">Item master with opening stock</Typography></Stack>
        </MenuItem>
        <MenuItem onClick={() => { setBulk('moves'); setBulkMenu(null); }}>
          <Stack><Typography variant="body2">Stock in / out (many rows)</Typography><Typography variant="caption" color="text.secondary">{B ? 'Receipts with batch / expiry, issues to patients' : 'Receipts and issues, posted to the ledger'}</Typography></Stack>
        </MenuItem>
      </Menu>
      {bulk && <BulkImportDialog open onClose={() => setBulk(null)} config={bulk === 'items' ? itemImport(def, items) : movementImport(def, items)} />}
      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { nav(`/m/${def.id}/ledger?item=${encodeURIComponent(menu!.item.id)}`); setMenu(null); }}>View history</MenuItem>
        <MenuItem onClick={() => { setAct({ a: 'transfer', item: menu!.item }); setMenu(null); }}>Transfer…</MenuItem>
        {!B && <MenuItem onClick={() => { setAct({ a: 'adjust', item: menu!.item }); setMenu(null); }}>Adjust count…</MenuItem>}
        <MenuItem onClick={() => { setEdit(menu!.item); setMenu(null); }}>Edit details</MenuItem>
        <MenuItem onClick={() => { setDel(menu!.item); setMenu(null); }} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>
      <FormDialog open={adding || !!edit} title={edit ? 'Edit item' : 'Add item'}
        fields={edit ? itemFields.map((f) => (f.name === 'code' ? { ...f, disabled: true } : f)) : itemFields}
        initial={edit ? Object.fromEntries(itemFields.map((f) => [f.name, String((edit as unknown as Record<string, unknown>)[f.name] ?? '')])) : { unit: 'Nos', minLevel: '0' }}
        onClose={() => { setAdding(false); setEdit(null); }} onSubmit={saveItem} />
      {act && (
        <FormDialog open title={`${titles[act.a]} — ${act.item.name}`} fields={actionFields(act.a, act.item)}
          initial={act.a === 'transfer' && !def.central ? { to: 'central' } : act.a === 'in' && B ? { receivedOn: dayjs().format('YYYY-MM-DD') } : act.a === 'out' && B ? { ptype: 'student' } : undefined}
          submitLabel={act.a === 'transfer' ? 'Send transfer' : 'Save'} onClose={() => setAct(null)} onSubmit={doAction} />
      )}
      <ConfirmDialog open={!!del} title="Delete item?" message={`Delete “${del?.name}”? Ledger history is kept.`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => del && remove(del)} />
    </>
  );
}
