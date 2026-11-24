import { Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/UploadFile';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { CATEGORIES, COL, safeId, type Book } from './types';
import BulkImportDialog from '../../components/BulkImportDialog';
import { bookImport } from './bulk';

export { safeId } from './types';

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
  const [bulk, setBulk] = useState(false);

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
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setBulk(true)}>Bulk upload (Excel)</Button>
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
      <BulkImportDialog open={bulk} onClose={() => setBulk(false)} config={bookImport(books)} />
      <ConfirmDialog open={!!del} title="Delete book?" message={`Remove “${del?.title}” from the catalogue? This cannot be undone.`} danger confirmLabel="Delete" onClose={() => setDel(null)} onConfirm={() => del && remove(del)} />
    </>
  );
}
