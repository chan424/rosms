import {
  Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup, Grid2 as Grid,
  IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { firebaseConfig } from '../../firebaseConfig';
import { useCollection } from '../../lib/useCollection';
import { logAudit } from '../../lib/audit';
import { errMsg, fmtDateTime } from '../../lib/format';
import type { UserProfile } from '../../lib/types';
import { MODULES } from '../../config/modules';
import { ROLE_LABELS, SUPER_ADMINS, emailToUsername, isStaffEmail, usernameToEmail, type Role } from '../../config/roles';

const STAFF_ROLES: Role[] = ['hod', 'coordinator', 'staff', 'warden', 'caretaker', 'doctor', 'medassistant'];

export const randomPassword = (n = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  let p = Array.from(a, (x) => chars[x % chars.length]).join('');
  if (!/\d/.test(p)) p = p.slice(0, -1) + '7';
  return p;
};

function ModulePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <FormGroup>
      <Grid container>
        {MODULES.map((m) => (
          <Grid key={m.id} size={{ xs: 12, sm: 6 }}>
            <FormControlLabel control={<Checkbox size="small" checked={value.includes(m.id)} onChange={(e) => onChange(e.target.checked ? [...value, m.id] : value.filter((x) => x !== m.id))} />} label={m.short} />
          </Grid>
        ))}
      </Grid>
    </FormGroup>
  );
}

export default function UsersAdmin() {
  const notify = useNotify();
  const users = useCollection<UserProfile>(collection(db, 'users'), 'all-users');
  const [edit, setEdit] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<{ role: Role; modules: string[]; assignedTo: string; disabled: boolean; mustChangePassword: boolean }>({ role: 'staff', modules: [], assignedTo: '', disabled: false, mustChangePassword: false });
  const [creating, setCreating] = useState(false);
  const [nu, setNu] = useState({ username: '', role: 'staff' as Role, assignedTo: '', modules: [] as string[] });
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const openEdit = (u: UserProfile) => {
    setEdit(u);
    setForm({ role: u.role, modules: u.modules ?? [], assignedTo: u.assignedTo ?? '', disabled: !!u.disabled, mustChangePassword: !!u.mustChangePassword });
  };

  const saveEdit = async () => {
    if (!edit) return;
    try {
      if (form.role === 'superadmin' && !SUPER_ADMINS.includes(edit.email)) throw new Error('Super admin is reserved for the four configured admin emails.');
      await updateDoc(doc(db, 'users', edit.id), { ...form, updatedAt: serverTimestamp() });
      logAudit('admin', 'update_user', 'user', edit.id, `${emailToUsername(edit.email)}: role=${form.role}, modules=${form.modules.join('|')}, disabled=${form.disabled}, assignedTo=${form.assignedTo}`);
      notify('User updated.');
      setEdit(null);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const createStaff = async () => {
    const username = nu.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return notify('Username: 3–40 characters, letters/numbers/dot/dash/underscore.', 'error');
    setBusy(true);
    const password = randomPassword();
    // A secondary Firebase app creates the account without signing the admin out.
    const sec = initializeApp(firebaseConfig, `create-${Date.now()}`);
    try {
      const secAuth = getAuth(sec);
      const cred = await createUserWithEmailAndPassword(secAuth, usernameToEmail(username), password);
      await signOut(secAuth);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: usernameToEmail(username), username, role: nu.role, modules: nu.modules, assignedTo: nu.assignedTo.trim(),
        disabled: false, mustChangePassword: true, createdAt: serverTimestamp(),
      });
      logAudit('admin', 'create_user', 'user', cred.user.uid, `${username} (${nu.role})`);
      setCreated({ username, password });
      setCreating(false);
      setNu({ username: '', role: 'staff', assignedTo: '', modules: [] });
    } catch (e) {
      notify(errMsg(e).includes('email-already-in-use') ? 'That username already exists.' : errMsg(e), 'error');
    } finally {
      await deleteApp(sec).catch(() => undefined);
      setBusy(false);
    }
  };

  const columns: Column<UserProfile>[] = [
    { key: 'email', label: 'Login', value: (u) => emailToUsername(u.email), render: (u) => (<><Typography variant="body2" fontWeight={600}>{emailToUsername(u.email)}</Typography>{u.displayName && <Typography variant="caption" color="text.secondary">{u.displayName}</Typography>}</>) },
    { key: 'kind', label: 'Type', value: (u) => (isStaffEmail(u.email) ? 'Username' : 'Google') },
    { key: 'role', label: 'Role', value: (u) => ROLE_LABELS[u.role] ?? u.role },
    { key: 'assignedTo', label: 'Assigned to', hideOnMobile: true },
    { key: 'modules', label: 'Modules', value: (u) => (u.modules ?? []).join(', '), render: (u) => <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>{(u.modules ?? []).map((m) => <Chip key={m} size="small" label={MODULES.find((x) => x.id === m)?.short ?? m} />)}</Stack> },
    { key: 'lastLoginAt', label: 'Last login', value: (u) => fmtDateTime(u.lastLoginAt), hideOnMobile: true },
    { key: 'status', label: 'Status', value: (u) => (u.disabled ? 'Disabled' : u.mustChangePassword ? 'Awaiting first login' : 'Active'), render: (u) => <Chip size="small" color={u.disabled ? 'default' : u.mustChangePassword ? 'warning' : 'success'} label={u.disabled ? 'Disabled' : u.mustChangePassword ? 'First login pending' : 'Active'} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (u) => <Tooltip title="Edit access"><IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton></Tooltip> },
  ];

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Google users appear here after their first sign-in. To <b>reset a staff password</b> or fully delete an account, use <code>scripts/manage-users.mjs</code> (see README) — the free Firebase plan does not allow this from the browser. Disabling here blocks all data access immediately.
      </Alert>
      <DataTable title="Users" rows={users.data} columns={columns} loading={users.loading} exportName="rosms-users" dense
        toolbar={<Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreating(true)}>New staff login</Button>} />

      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit access — {edit && emailToUsername(edit.email)}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
            </TextField>
            <TextField label="Assigned to (person using this login)" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
            <Typography variant="subtitle2">Modules (view + modify)</Typography>
            <ModulePicker value={form.modules} onChange={(modules) => setForm({ ...form, modules })} />
            <FormControlLabel control={<Checkbox checked={form.disabled} onChange={(e) => setForm({ ...form, disabled: e.target.checked })} />} label="Disabled (blocks sign-in and all data access)" />
            {edit && isStaffEmail(edit.email) && <FormControlLabel control={<Checkbox checked={form.mustChangePassword} onChange={(e) => setForm({ ...form, mustChangePassword: e.target.checked })} />} label="Require password change at next login" />}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="contained" onClick={saveEdit}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New staff login</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField label="Username" placeholder="e.g. staff31 or warden21" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
            <TextField select label="Role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              {STAFF_ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
            </TextField>
            <TextField label="Assigned to (name)" value={nu.assignedTo} onChange={(e) => setNu({ ...nu, assignedTo: e.target.value })} />
            <Typography variant="subtitle2">Modules</Typography>
            <ModulePicker value={nu.modules} onChange={(modules) => setNu({ ...nu, modules })} />
            <Typography variant="caption" color="text.secondary">A random temporary password is generated and shown once. The user must change it at first login.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setCreating(false)}>Cancel</Button><Button variant="contained" disabled={busy} onClick={createStaff}>{busy ? 'Creating…' : 'Create login'}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!created} onClose={() => setCreated(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Login created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>Copy this now. The password is not stored anywhere and will not be shown again.</Alert>
          <Typography>Username: <b>{created?.username}</b></Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography>Temporary password: <b style={{ fontFamily: 'monospace' }}>{created?.password}</b></Typography>
            <IconButton size="small" onClick={() => { navigator.clipboard.writeText(`${created?.username} / ${created?.password}`); notify('Copied.'); }}><ContentCopyIcon fontSize="small" /></IconButton>
          </Stack>
        </DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setCreated(null)}>Done</Button></DialogActions>
      </Dialog>
    </>
  );
}
