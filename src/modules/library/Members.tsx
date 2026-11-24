import { Button, Chip, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import UploadIcon from '@mui/icons-material/UploadFile';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog, { type Field, type FormValues } from '../../components/FormDialog';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import { useLibrary } from './LibraryContext';
import { COL, DEPTS, safeId, type Member, type MemberType } from './types';
import BulkImportDialog from '../../components/BulkImportDialog';
import { memberImport } from './bulk';


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
  const [bulk, setBulk] = useState(false);

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
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setBulk(true)}>Bulk upload (Excel)</Button>
        </>}
      />
      <BulkImportDialog open={bulk} onClose={() => setBulk(false)} config={memberImport(members)} />
      <FormDialog open={adding || !!edit} title={edit ? 'Edit member' : 'Add member'}
        fields={edit ? fields.map((f) => (f.name === 'memberId' ? { ...f, disabled: true } : f)) : fields}
        initial={edit ? Object.fromEntries(fields.map((f) => [f.name, String((edit as unknown as Record<string, unknown>)[f.name] ?? '')])) : { type: 'student' }}
        validate={validate} onClose={() => { setAdding(false); setEdit(null); }} onSubmit={save} />
    </>
  );
}
