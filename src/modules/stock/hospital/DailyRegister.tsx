import { Grid2 as Grid, Stack, TextField } from '@mui/material';
import { Timestamp, collection, orderBy, query, where } from 'firebase/firestore';
import dayjs from 'dayjs';
import { useState } from 'react';
import DataTable, { type Column } from '../../../components/DataTable';
import StatCard from '../../../components/StatCard';
import { db } from '../../../lib/firebase';
import { useCollection } from '../../../lib/useCollection';
import { fmtDateTime } from '../../../lib/format';
import { useStock } from '../StockModule';
import { PATIENT_TYPES, TXN_LABEL, txnsPath, type StockTxn } from '../types';

export default function DailyRegister() {
  const { def } = useStock();
  const [day, setDay] = useState(dayjs().format('YYYY-MM-DD'));
  const start = dayjs(day).startOf('day');
  const { data, loading } = useCollection<StockTxn>(
    query(collection(db, txnsPath(def.id)), where('at', '>=', Timestamp.fromDate(start.toDate())), where('at', '<', Timestamp.fromDate(start.add(1, 'day').toDate())), orderBy('at', 'desc')),
    `reg-${def.id}-${day}`,
  );
  const issues = data.filter((t) => t.type === 'out');
  const patients = new Set(issues.filter((t) => t.patientType !== 'writeoff').map((t) => t.patientId || t.patientName)).size;
  const cols: Column<StockTxn>[] = [
    { key: 'at', label: 'Time', value: (t) => fmtDateTime(t.at) },
    { key: 'type', label: 'Entry', value: (t) => (t.type === 'out' ? (t.patientType === 'writeoff' ? 'Write-off' : 'Issued') : TXN_LABEL[t.type]) },
    { key: 'patientType', label: 'Given to', value: (t) => PATIENT_TYPES.find((p) => p.value === t.patientType)?.label ?? '' },
    { key: 'patientId', label: 'ID' },
    { key: 'patientName', label: 'Name' },
    { key: 'complaint', label: 'Complaint / note', hideOnMobile: true },
    { key: 'itemName', label: 'Medicine / item' },
    { key: 'qty', label: 'Qty', align: 'right', render: (t) => `${t.qty} ${t.unit}` },
    { key: 'batchNo', label: 'Batch', hideOnMobile: true },
    { key: 'party', label: 'Supplier / ref', value: (t) => (t.type === 'out' ? '' : [t.party, t.reference].filter(Boolean).join(' · ')), hideOnMobile: true },
    { key: 'by', label: 'By', value: (t) => t.by.split('@')[0] },
  ];
  return (
    <Stack spacing={2}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField type="date" label="Date" value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 4, md: 3 }}><StatCard label="Patients" value={patients} /></Grid>
        <Grid size={{ xs: 4, md: 3 }}><StatCard label="Issue entries" value={issues.length} /></Grid>
        <Grid size={{ xs: 4, md: 3 }}><StatCard label="Receipts" value={data.filter((t) => t.type === 'in').length} /></Grid>
      </Grid>
      <DataTable title={`Daily register — ${start.format('DD MMM YYYY')}`} rows={data} columns={cols} loading={loading} exportName={`hospital-register-${day}`} dense />
    </Stack>
  );
}
