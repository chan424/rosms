import { Chip, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { fmtDateTime } from '../../lib/format';
import { isLate } from './Board';
import { OUTPASS_TYPES, type Outpass } from './types';

export const outpassStatusChip = (o: Outpass) =>
  o.status === 'out' ? <Chip size="small" color={isLate(o) ? 'error' : 'warning'} label={isLate(o) ? 'Out · LATE' : 'Out'} />
  : o.status === 'returned' ? <Chip size="small" color={o.late ? 'error' : 'success'} variant={o.late ? 'outlined' : 'filled'} label={o.late ? 'Returned late' : 'Returned'} />
  : <Chip size="small" label="Cancelled" />;

export default function OutpassHistory({ rows, loading }: { rows: Outpass[]; loading: boolean }) {
  const [f, setF] = useState('');
  const shown = f === 'late' ? rows.filter((o) => o.late || isLate(o)) : f ? rows.filter((o) => o.status === f) : rows;
  const columns: Column<Outpass>[] = [
    { key: 'studentId', label: 'ID No.' },
    { key: 'studentName', label: 'Student' },
    { key: 'type', label: 'Type', value: (o) => OUTPASS_TYPES.find((t) => t.value === o.type)?.label ?? o.type, hideOnMobile: true },
    { key: 'reason', label: 'Reason' },
    { key: 'destination', label: 'Destination', hideOnMobile: true },
    { key: 'issuedByName', label: 'Issued by', value: (o) => `${o.issuedByName} (${o.issuedByRole})` },
    { key: 'issuedAt', label: 'Issued at', value: (o) => fmtDateTime(o.issuedAt) },
    { key: 'expectedReturn', label: 'Expected return', value: (o) => fmtDateTime(o.expectedReturn) },
    { key: 'actualReturn', label: 'Actual return', value: (o) => (o.actualReturn ? fmtDateTime(o.actualReturn) : '—') },
    { key: 'status', label: 'Status', value: (o) => (o.status === 'returned' && o.late ? 'returned late' : isLate(o) ? 'out (late)' : o.status), render: outpassStatusChip },
  ];
  return (
    <DataTable title="Outpass register (latest 500)" rows={shown} columns={columns} loading={loading} exportName="outpass-register" dense
      toolbar={<TextField select label="Filter" value={f} onChange={(e) => setF(e.target.value)} sx={{ minWidth: 150 }}>
        <MenuItem value="">All</MenuItem><MenuItem value="out">Out</MenuItem><MenuItem value="returned">Returned</MenuItem>
        <MenuItem value="late">Late</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem>
      </TextField>} />
  );
}
