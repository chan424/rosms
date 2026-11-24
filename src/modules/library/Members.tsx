import { Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import UploadIcon from '@mui/icons-material/UploadFile';
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { useRef, useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { readSheet } from '../../lib/exporters';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import { useLibrary } from './LibraryContext';
import { COL, type Member, type MemberType } from './types';
import { safeId } from './Catalogue';

const DEPTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'MME', 'CHE', 'PUC', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Telugu', 'Management', 'PED', 'Library', 'Administration', 'Other'];

const fields: Field[] = [
  { name: 'memberId', label: 'ID number (e.g. O234747 / Emp ID)', required: true, half: true },
  { name: 'type', label: 'Member type', type: 'select', required: true, half: true, options: [{ value: 'student', label: 'Student' }, { value: 'faculty', label: 'Faculty' }, { value: 'staff', label: 'Staff' }] },
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: `Institute email (@${INSTITUTE_DOMAIN})`, type: 'email', helper: 'Lets the member see their own loans in My ROSMS' },
  { name: 'department', label: 'Department', type: 'select', half: true, options: DEPTS.map((d) => ({ value: d, label: d })) },
  { name: 'year', label: 'Year / Class', half: true },
  { name: 'phone', label: 'Phone', half: true },
];

export default function Members() {
  const { members, loading } = useLibrary();
  const notify = useNotify();
  const [edit, setEdit] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validate = (v: FormValues) =>
    v.email && !v.email.toLowerCase().endsWith('@' + INSTITUTE_DOMAIN) ? `Email must end with @${INSTITUTE_DOMAIN}` : null;

  const save = async (v: FormValues) => {
    const data = {
      memberId: v.memberId.trim().toUpperCase(), name: v.name.trim(), email: v.email.trim().toLowerCase(), type: v.type as MemberType,
      department: v.department, year: v.year.trim(), phone: v.phone.trim(), updatedAt: serverTimestamp(),
    };
    if (edit) {
      await updateDoc(doc(db, COL.members, edit.id), data);
      logAudit('library', 'update', 'member', edit.id, data.name);
      notify('Member updated.');
    } else {
      const id = safeId(data.memberId);
      if (members.some((m) => m.id === id)) throw new Error('A member with this ID already exists.');
      await setDoc(doc(db, COL.members, id), { ...data, active: true, issuedCount: 0, createdAt: serverTimestamp() });
      logAudit('library', 'create', 'member', id, data.name);
      notify('Member added.');
    }
  };

  const toggle = async (m: Member) => {
    try {
      await updateDoc(doc(db, COL.members, m.id), { active: !m.active });
      logAudit('library', m.active ? 'deactivate' : 'activate', 'member', m.id, m.name);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const importFile = async (f: File) => {
    try {
      const rows = await readSheet(f);
      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of Object.keys(r)) if (keys.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return String(r[k] ?? '').trim();
        return '';
      };
      const existing = new Set(members.map((m) => m.id));
      let added = 0, skipped = 0;
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db);
        for (const r of rows.slice(i, i + 400)) {
          const mid = pick(r, 'id', 'idno', 'memberid', 'idnumber', 'rollno', 'empid').toUpperCase();
          const name = pick(r, 'name', 'fullname', 'studentname');
          if (!mid || !name || existing.has(safeId(mid))) { skipped++; continue; }
          existing.add(safeId(mid));
          const t = pick(r, 'type', 'membertype').toLowerCase();
          batch.set(doc(db, COL.members, safeId(mid)), {
            memberId: mid, name, email: pick(r, 'email', 'mail').toLowerCase(), type: t === 'faculty' || t === 'staff' ? t : 'student',
            department: pick(r, 'department', 'dept', 'branch'), year: pick(r, 'year', 'class'), phone: pick(r, 'phone', 'mobile'),
            active: true, issuedCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          added++;
        }
        await batch.commit();
      }
      logAudit('library', 'import', 'member', '', `${added} added, ${skipped} skipped from ${f.name}`);
      notify(`Imported ${added} member(s); skipped ${skipped}.`, added ? 'success' : 'warning');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Member>[] = [
    { key: 'memberId', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (m) => <Chip size="small" label={m.type} variant="outlined" /> },
    { key: 'department', label: 'Dept', hideOnMobile: true },
    { key: 'email', label: 'Email', hideOnMobile: true },
    { key: 'phone', label: 'Phone', hideOnMobile: true },
    { key: 'issuedCount', label: 'Books out', align: 'right', value: (m) => m.issuedCount ?? 0 },
    { key: 'active', label: 'Status', value: (m) => (m.active ? 'Active' : 'Inactive'), render: (m) => <Chip size="small" color={m.active ? 'success' : 'default'} label={m.active ? 'Active' : 'Inactive'} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (m) => (
      <Stack direction="row">
        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEdit(m)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title={m.active ? 'Deactivate' : 'Activate'}><IconButton size="small" onClick={() => toggle(m)}>{m.active ? <BlockIcon fontSize="small" /> : <CheckIcon fontSize="small" />}</IconButton></Tooltip>
      </Stack>
    ) },
  ];

  return (
    <>
      <DataTable title="Members" rows={members} columns={columns} loading={loading} exportName="library-members" dense
        toolbar={<>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add member</Button>
          <Tooltip title="Excel/CSV with columns: ID, Name, Type, Email, Department, Year, Phone">
            <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>Import</Button>
          </Tooltip>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </>}
      />
      <FormDialog open={adding || !!edit} title={edit ? 'Edit member' : 'Add member'}
        fields={edit ? fields.map((f) => (f.name === 'memberId' ? { ...f, disabled: true } : f)) : fields}
        initial={edit ? Object.fromEntries(fields.map((f) => [f.name, String((edit as unknown as Record<string, unknown>)[f.name] ?? '')])) : { type: 'student' }}
        validate={validate} onClose={() => { setAdding(false); setEdit(null); }} onSubmit={save} />
    </>
  );
}
