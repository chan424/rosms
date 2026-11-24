import { Alert, MenuItem, TextField } from '@mui/material';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useCollection } from '../../lib/useCollection';
import { canManage, isSuperAdmin } from '../../lib/permissions';
import { fmtDateTime } from '../../lib/format';
import { MODULES } from '../../config/modules';
import type { AuditEntry } from '../../lib/types';

export default function AuditPage() {
  const auth = useAuth();
  const admin = isSuperAdmin(auth.profile);
  const allowed = [...MODULES.filter((m) => canManage(auth, m.id)).map((m) => ({ id: m.id, name: m.name })), ...(admin ? [{ id: 'admin', name: 'Administration' }, { id: 'system', name: 'System / passwords' }] : [])];
  const [mod, setMod] = useState(admin ? '' : allowed[0]?.id ?? '');
  const q = !mod && admin
    ? query(collection(db, 'audit'), orderBy('at', 'desc'), limit(1000))
    : mod ? query(collection(db, 'audit'), where('module', '==', mod), orderBy('at', 'desc'), limit(1000)) : null;
  const { data, loading, error } = useCollection<AuditEntry>(q, `audit-${mod}`);

  const columns: Column<AuditEntry>[] = [
    { key: 'at', label: 'When', value: (a) => fmtDateTime(a.at) },
    { key: 'email', label: 'Who' },
    { key: 'module', label: 'Module', value: (a) => MODULES.find((m) => m.id === a.module)?.short ?? a.module },
    { key: 'action', label: 'Action' },
    { key: 'entity', label: 'Record' },
    { key: 'details', label: 'Details' },
  ];

  if (!allowed.length) return <Alert severity="info">The audit log is available to super admins and module owners.</Alert>;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change, who made it and when (append-only)" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <DataTable title="Activity" rows={data} columns={columns} loading={loading} exportName={`audit-${mod || 'all'}`} dense
        toolbar={<TextField select label="Module" value={mod} onChange={(e) => setMod(e.target.value)} sx={{ minWidth: 220 }}>
          {admin && <MenuItem value="">All modules</MenuItem>}
          {allowed.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
        </TextField>} />
    </>
  );
}
