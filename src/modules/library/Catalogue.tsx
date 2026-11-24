import { Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/UploadFile';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useRef, useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { readSheet } from '../../lib/exporters';
import { useLibrary } from './LibraryContext';
import { CATEGORIES, COL, type Book } from './types';

export const safeId = (s: string) => s.trim().replace(/[/#?\s]+/g, '-').slice(0, 120);

const fields: Field[] = [
  { name: 'accessionNo', label: 'Accession No.', required: true, half: true },
  { name: 'isbn', label: 'ISBN', half: true },
  { name: 'title', label: 'Title', required: true },
  { name: 'author', label: 'Author(s)', required: true },
  { name: 'category', label: 'Category', type: 'select', options: CATEGORIES.map((c) => ({ value: c, label: c })), half: true },
  { name: 'rack', label: 'Rack / Shelf', half: true },
  { name: 'publisher', label: 'Publisher', half: true },
  { name: 'edition', label: 'Edition', half: true },
  { name: 'year', label: 'Year', type: 'number', half: true },
  { name: 'price', label: 'Price (₹)', type: 'number', half: true, min: 0 },
  { name: 'copies', label: 'Number of copies', type: 'number', required: true, half: true, min: 1 },
];

export default function Catalogue() {
  const { books, loading } = useLibrary();
  const notify = useNotify();
  const [edit, setEdit] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<Book | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (v: FormValues) => {
    const copies = Math.max(1, parseInt(v.copies, 10) || 1);
    const data = {
      accessionNo: v.accessionNo.trim(), isbn: v.isbn.trim(), title: v.title.trim(), author: v.author.trim(),
      category: v.category, rack: v.rack.trim(), publisher: v.publisher.trim(), edition: v.edition.trim(),
      year: v.year ? Number(v.year) : '', price: v.price ? Number(v.price) : 0, copies, updatedAt: serverTimestamp(),
    };
    if (edit) {
      const issued = (edit.copies ?? 0) - (edit.available ?? 0);
      if (copies < issued) throw new Error(`${issued} copies are currently issued; copies cannot be less than that.`);
      await updateDoc(doc(db, COL.books, edit.id), { ...data, available: copies - issued });
      logAudit('library', 'update', 'book', edit.id, data.title);
      notify('Book updated.');
    } else {
      const id = safeId(data.accessionNo);
      if (books.some((b) => b.id === id)) throw new Error('A book with this accession number already exists.');
      await setDoc(doc(db, COL.books, id), { ...data, available: copies, createdAt: serverTimestamp() });
      logAudit('library', 'create', 'book', id, data.title);
      notify('Book added to catalogue.');
    }
  };

  const remove = async (b: Book) => {
    if ((b.available ?? 0) < (b.copies ?? 0)) return notify('Cannot delete: some copies are issued.', 'error');
    try {
      await deleteDoc(doc(db, COL.books, b.id));
      logAudit('library', 'delete', 'book', b.id, b.title);
      notify('Book removed.');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const importFile = async (f: File) => {
    try {
      const rows = await readSheet(f);
      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of Object.keys(r)) if (keys.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return String(r[k] ?? '').trim();
        return '';
      };
      let added = 0, skipped = 0;
      const existing = new Set(books.map((b) => b.id));
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        for (const r of rows.slice(i, i + 400)) {
          const acc = pick(r, 'accessionno', 'accno', 'accession', 'accessionnumber');
          const title = pick(r, 'title', 'booktitle');
          if (!acc || !title || existing.has(safeId(acc))) { skipped++; continue; }
          const copies = Math.max(1, parseInt(pick(r, 'copies', 'qty', 'quantity'), 10) || 1);
          existing.add(safeId(acc));
          batch.set(doc(db, COL.books, safeId(acc)), {
            accessionNo: acc, title, author: pick(r, 'author', 'authors'), isbn: pick(r, 'isbn'), category: pick(r, 'category', 'subject') || 'General',
            rack: pick(r, 'rack', 'shelf', 'location'), publisher: pick(r, 'publisher'), edition: pick(r, 'edition'), year: pick(r, 'year'),
            price: Number(pick(r, 'price', 'cost')) || 0, copies, available: copies, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          added++;
        }
        await batch.commit();
      }
      logAudit('library', 'import', 'book', '', `${added} added, ${skipped} skipped from ${f.name}`);
      notify(`Imported ${added} book(s); skipped ${skipped} (missing fields or duplicate accession no.).`, added ? 'success' : 'warning');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Book>[] = [
    { key: 'accessionNo', label: 'Acc. No.' },
    { key: 'title', label: 'Title' },
    { key: 'author', label: 'Author' },
    { key: 'isbn', label: 'ISBN', hideOnMobile: true },
    { key: 'category', label: 'Category', hideOnMobile: true },
    { key: 'rack', label: 'Rack', hideOnMobile: true },
    { key: 'copies', label: 'Copies', align: 'right', value: (b) => Number(b.copies) || 0 },
    { key: 'available', label: 'Available', align: 'right', value: (b) => Number(b.available) || 0, render: (b) => <Chip size="small" label={b.available} color={b.available > 0 ? 'success' : 'default'} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (b) => (
      <Stack direction="row">
        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEdit(b)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" onClick={() => setDel(b)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>
    ) },
  ];

  const initial = edit ? Object.fromEntries(fields.map((f) => [f.name, String((edit as unknown as Record<string, unknown>)[f.name] ?? '')])) : { copies: '1', category: 'General' };

  return (
    <>
      <DataTable
        title="Catalogue"
        rows={books}
        columns={columns}
        loading={loading}
        exportName="library-catalogue"
        searchPlaceholder="Search title, author, ISBN, accession no…"
        dense
        toolbar={<>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add book</Button>
          <Tooltip title="Excel/CSV with columns: Accession No, Title, Author, ISBN, Category, Publisher, Edition, Year, Rack, Copies, Price">
            <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>Import</Button>
          </Tooltip>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </>}
      />
      <FormDialog
        open={adding || !!edit}
        title={edit ? 'Edit book' : 'Add book'}
        fields={edit ? fields.map((f) => (f.name === 'accessionNo' ? { ...f, disabled: true } : f)) : fields}
        initial={initial}
        onClose={() => { setAdding(false); setEdit(null); }}
        onSubmit={save}
      />
      <ConfirmDialog open={!!del} title="Delete book?" message={`Remove “${del?.title}” from the catalogue? This cannot be undone.`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => del && remove(del)} />
    </>
  );
}
