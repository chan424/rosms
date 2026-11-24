import { Button, Chip, FormControlLabel, Switch } from '@mui/material';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { useNotify } from '../../components/Notify';
import { errMsg, fmtDate, inr } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { markFinePaid } from './ops';
import type { Loan } from './types';

export default function History() {
  const { history, loading } = useLibrary();
  const notify = useNotify();
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const rows = unpaidOnly ? history.filter((l) => l.status === 'returned' && l.fine > 0 && !l.finePaid) : history;

  const pay = async (l: Loan) => {
    try { await markFinePaid(l); notify(`Fine ${inr(l.fine)} marked as collected.`); } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Loan>[] = [
    { key: 'accessionNo', label: 'Acc. No.' },
    { key: 'title', label: 'Title' },
    { key: 'memberName', label: 'Member', value: (l) => `${l.memberName} (${l.memberId})` },
    { key: 'issuedAt', label: 'Issued', value: (l) => fmtDate(l.issuedAt) },
    { key: 'dueAt', label: 'Due', value: (l) => fmtDate(l.dueAt), hideOnMobile: true },
    { key: 'returnedAt', label: 'Returned', value: (l) => (l.status === 'returned' ? fmtDate(l.returnedAt) : '—') },
    { key: 'status', label: 'Status', render: (l) => <Chip size="small" label={l.status} color={l.status === 'issued' ? 'warning' : 'success'} /> },
    { key: 'fine', label: 'Fine', align: 'right', value: (l) => l.fine ?? 0, render: (l) => (l.fine ? inr(l.fine) : '—') },
    { key: 'finePaid', label: 'Fine status', value: (l) => (l.fine ? (l.finePaid ? 'Paid' : 'Due') : ''), render: (l) => (l.fine ? (l.finePaid ? <Chip size="small" color="success" label="Paid" /> : <Button size="small" variant="outlined" color="error" onClick={() => pay(l)}>Collect</Button>) : '—') },
  ];
  return (
    <DataTable title="Circulation history" rows={rows} columns={columns} loading={loading} exportName="library-history" dense
      toolbar={<FormControlLabel control={<Switch checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} />} label="Unpaid fines only" />} />
  );
}
