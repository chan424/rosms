import { Alert, Button, Card, CardContent, Stack, TextField } from '@mui/material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import DataTable, { type Column } from '../../../components/DataTable';
import { useNotify } from '../../../components/Notify';
import { db } from '../../../lib/firebase';
import { errMsg, fmtDateTime } from '../../../lib/format';
import { useStock } from '../StockModule';
import { txnsPath, type StockTxn } from '../types';

export default function PatientHistory() {
  const { def } = useStock();
  const notify = useNotify();
  const [id, setId] = useState('');
  const [rows, setRows] = useState<StockTxn[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    const pid = id.trim().toUpperCase().replace(/@.*/, '');
    if (!pid) return;
    setLoading(true);
    try {
      const s = await getDocs(query(collection(db, txnsPath(def.id)), where('patientId', '==', pid)));
      setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockTxn, 'id'>) })).sort((a, b) => (b.at?.toMillis?.() ?? 0) - (a.at?.toMillis?.() ?? 0)));
    } catch (e) { notify(errMsg(e), 'error'); }
    setLoading(false);
  };

  const cols: Column<StockTxn>[] = [
    { key: 'at', label: 'Date & time', value: (t) => fmtDateTime(t.at) },
    { key: 'itemName', label: 'Medicine / item' },
    { key: 'qty', label: 'Qty', align: 'right', render: (t) => `${t.qty} ${t.unit}` },
    { key: 'complaint', label: 'Complaint / diagnosis' },
    { key: 'batchNo', label: 'Batch', hideOnMobile: true },
    { key: 'by', label: 'Issued by', value: (t) => t.by.split('@')[0] },
  ];
  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Student ID / staff ID (e.g. O234747)" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} sx={{ maxWidth: 360 }} />
            <Button variant="contained" onClick={search} disabled={loading}>Search</Button>
          </Stack>
        </CardContent>
      </Card>
      {rows && rows.length === 0 && <Alert severity="info">No medicines have been issued to {id.toUpperCase()}.</Alert>}
      {rows && rows.length > 0 && (
        <DataTable title={`Medicines given to ${rows[0].patientId}${rows[0].patientName ? ` · ${rows[0].patientName}` : ''} (${rows.length})`} rows={rows} columns={cols} loading={loading} exportName={`hospital-patient-${rows[0].patientId}`} dense />
      )}
    </Stack>
  );
}
