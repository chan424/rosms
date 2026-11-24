import { Button, Chip, Grid2 as Grid, Stack } from '@mui/material';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import WarningIcon from '@mui/icons-material/WarningAmber';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import TodayIcon from '@mui/icons-material/Today';
import dayjs from 'dayjs';
import { useState } from 'react';
import StatCard from '../../components/StatCard';
import DataTable, { type Column } from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useNotify } from '../../components/Notify';
import { errMsg, fmtDateTime } from '../../lib/format';
import { cancelOutpass, markReturned } from './ops';
import { OUTPASS_TYPES, type Outpass } from './types';

export const isLate = (o: Outpass) => o.status === 'out' && (o.expectedReturn?.toMillis?.() ?? Infinity) < Date.now();

export default function Board({ open, recent, loading }: { open: Outpass[]; recent: Outpass[]; loading: boolean }) {
  const notify = useNotify();
  const [cancel, setCancel] = useState<Outpass | null>(null);
  const today = dayjs().startOf('day').valueOf();
  const issuedToday = recent.filter((o) => (o.issuedAt?.toMillis?.() ?? Date.now()) >= today).length;
  const returnedToday = recent.filter((o) => o.status === 'returned' && (o.actualReturn?.toMillis?.() ?? 0) >= today).length;
  const late = open.filter(isLate);

  const ret = async (o: Outpass) => {
    try { await markReturned(o.id); notify(`${o.studentName} marked back in campus${isLate(o) ? ' (late return recorded)' : ''}.`); } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Outpass>[] = [
    { key: 'studentId', label: 'ID No.' },
    { key: 'studentName', label: 'Student' },
    { key: 'hostel', label: 'Hostel', hideOnMobile: true },
    { key: 'type', label: 'Type', value: (o) => OUTPASS_TYPES.find((t) => t.value === o.type)?.label ?? o.type, hideOnMobile: true },
    { key: 'reason', label: 'Reason' },
    { key: 'issuedByName', label: 'Issued by', value: (o) => `${o.issuedByName} (${o.issuedByRole})` },
    { key: 'issuedAt', label: 'Out since', value: (o) => fmtDateTime(o.issuedAt) },
    { key: 'expectedReturn', label: 'Expected back', value: (o) => fmtDateTime(o.expectedReturn), render: (o) => <Chip size="small" color={isLate(o) ? 'error' : 'default'} label={(isLate(o) ? 'LATE · ' : '') + fmtDateTime(o.expectedReturn)} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (o) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={() => ret(o)}>Mark in</Button>
        <Button size="small" color="error" onClick={() => setCancel(o)}>Cancel</Button>
      </Stack>
    ) },
  ];

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Currently out of campus" value={open.length} icon={<DirectionsWalkIcon />} color="#00695c" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Late (past expected return)" value={late.length} icon={<WarningIcon />} color="#c62828" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Outpasses issued today" value={issuedToday} icon={<TodayIcon />} color="#1e5aa8" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Returned today" value={returnedToday} icon={<KeyboardReturnIcon />} color="#2e7d32" /></Grid>
      </Grid>
      <DataTable title="Students out of campus" rows={open} columns={columns} loading={loading} exportName="students-out-of-campus" dense initialSort={{ key: 'expectedReturn', dir: 'asc' }}
        emptyText="All registered students are in campus." />
      <ConfirmDialog open={!!cancel} title="Cancel outpass?" message={`Cancel the outpass for ${cancel?.studentName}? Use this only if the student never left campus.`} danger confirmLabel="Cancel outpass"
        onClose={() => setCancel(null)} onConfirm={async () => { try { await cancelOutpass(cancel!.id); notify('Outpass cancelled.'); } catch (e) { notify(errMsg(e), 'error'); } }} />
    </>
  );
}
