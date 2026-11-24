import { Button, Card, CardContent, Chip, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/UploadFile';
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { readSheet } from '../../lib/exporters';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import { searchStudents } from './studentSearch';
import { HOSTELS, type Student } from './types';

const fields: Field[] = [
  { name: 'email', label: `Institute email (e.g. o234747@${INSTITUTE_DOMAIN})`, type: 'email', required: true },
  { name: 'name', label: 'Full name', required: true },
  { name: 'gender', label: 'Gender', type: 'select', half: true, options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }] },
  { name: 'year', label: 'Year (PUC1, PUC2, E1–E4)', half: true },
  { name: 'branch', label: 'Branch', half: true },
  { name: 'hostel', label: 'Hostel', type: 'select', half: true, options: HOSTELS.map((h) => ({ value: h, label: h })) },
  { name: 'room', label: 'Room no.', half: true },
  { name: 'phone', label: 'Student phone', half: true },
  { name: 'parentPhone', label: 'Parent phone', half: true },
];

export default function Students() {
  const notify = useNotify();
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (t: string) => {
    setLoading(true);
    try {
      setRows(t.trim().length >= 2 ? await searchStudents(t) : (await getDocs(query(collection(db, 'students'), where('status', '==', 'out'), limit(200)))).docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })));
    } catch (e) { notify(errMsg(e), 'error'); }
    setLoading(false);
  };
  useEffect(() => { const h = setTimeout(() => load(term), 350); return () => clearTimeout(h); /* eslint-disable-next-line */ }, [term]);

  const save = async (v: FormValues) => {
    const email = v.email.trim().toLowerCase();
    if (!email.endsWith('@' + INSTITUTE_DOMAIN)) throw new Error(`Email must end with @${INSTITUTE_DOMAIN}`);
    const data = { email, idNo: email.split('@')[0].toUpperCase(), name: v.name.trim(), gender: v.gender, year: v.year.trim(), branch: v.branch.trim(), hostel: v.hostel, room: v.room.trim(), phone: v.phone.trim(), parentPhone: v.parentPhone.trim(), updatedAt: serverTimestamp() };
    if (edit) await updateDoc(doc(db, 'students', edit.id), data);
    else await setDoc(doc(db, 'students', email), { ...data, status: 'in', currentOutpassId: '' });
    logAudit('outpass', edit ? 'update' : 'create', 'student', email, data.name);
    notify('Student saved.');
    load(term);
  };

  const importFile = async (f: File) => {
    try {
      const sheet = await readSheet(f);
      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of Object.keys(r)) if (keys.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return String(r[k] ?? '').trim();
        return '';
      };
      let added = 0, skipped = 0;
      for (let i = 0; i < sheet.length; i += 400) {
        const batch = writeBatch(db);
        for (const r of sheet.slice(i, i + 400)) {
          let email = pick(r, 'email', 'mail').toLowerCase();
          const idNo = pick(r, 'id', 'idno', 'idnumber', 'rollno').toUpperCase();
          if (!email && idNo) email = `${idNo.toLowerCase()}@${INSTITUTE_DOMAIN}`;
          const name = pick(r, 'name', 'studentname', 'fullname');
          if (!email.endsWith('@' + INSTITUTE_DOMAIN) || !name) { skipped++; continue; }
          // merge keeps the current in/out status of existing students
          batch.set(doc(db, 'students', email), {
            email, idNo: email.split('@')[0].toUpperCase(), name, gender: pick(r, 'gender'), year: pick(r, 'year', 'class'), branch: pick(r, 'branch', 'department'),
            hostel: pick(r, 'hostel'), room: pick(r, 'room', 'roomno'), phone: pick(r, 'phone', 'mobile'), parentPhone: pick(r, 'parentphone', 'parentmobile', 'fatherphone'), updatedAt: serverTimestamp(),
          }, { merge: true });
          added++;
        }
        await batch.commit();
      }
      // Students without a status field are treated as in campus.
      logAudit('outpass', 'import', 'student', '', `${added} from ${f.name}`);
      notify(`Imported/updated ${added} student(s); skipped ${skipped}. New students default to “in campus”.`, added ? 'success' : 'warning');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Student>[] = [
    { key: 'idNo', label: 'ID No.' }, { key: 'name', label: 'Name' }, { key: 'branch', label: 'Branch', hideOnMobile: true }, { key: 'year', label: 'Year', hideOnMobile: true },
    { key: 'hostel', label: 'Hostel' }, { key: 'room', label: 'Room', hideOnMobile: true }, { key: 'phone', label: 'Phone', hideOnMobile: true }, { key: 'parentPhone', label: 'Parent', hideOnMobile: true },
    { key: 'status', label: 'Status', value: (s) => (s.status === 'out' ? 'Out' : 'In campus'), render: (s) => <Chip size="small" color={s.status === 'out' ? 'warning' : 'success'} label={s.status === 'out' ? 'Out' : 'In campus'} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (s) => <Tooltip title="Edit"><IconButton size="small" onClick={() => setEdit(s)}><EditIcon fontSize="small" /></IconButton></Tooltip> },
  ];

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField placeholder="Search by ID no., name or email" value={term} onChange={(e) => setTerm(e.target.value)} sx={{ maxWidth: { md: 420 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>{term.trim().length >= 2 ? 'Search results' : 'Showing students currently out of campus'}</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Register student</Button>
            <Tooltip title="Excel/CSV columns: ID No (or Email), Name, Gender, Year, Branch, Hostel, Room, Phone, Parent Phone">
              <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>Import</Button>
            </Tooltip>
            <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
          </Stack>
        </CardContent>
      </Card>
      <DataTable rows={rows} columns={columns} loading={loading} exportName="students" dense />
      <FormDialog open={adding || !!edit} title={edit ? 'Edit student' : 'Register student'}
        fields={edit ? fields.map((f) => (f.name === 'email' ? { ...f, disabled: true } : f)) : fields}
        initial={edit ? Object.fromEntries(fields.map((f) => [f.name, String((edit as unknown as Record<string, unknown>)[f.name] ?? '')])) : undefined}
        onClose={() => { setAdding(false); setEdit(null); }} onSubmit={save} />
    </>
  );
}
