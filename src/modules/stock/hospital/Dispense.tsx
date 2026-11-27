import {
  Alert, Autocomplete, Button, Card, CardContent, Chip, Grid2 as Grid, IconButton, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useMemo, useState } from 'react';
import { useNotify } from '../../../components/Notify';
import { errMsg, fmtDateTime } from '../../../lib/format';
import { useStock } from '../StockModule';
import { dispense } from '../ops';
import { PATIENT_TYPES, type PatientType, type StockItem } from '../types';

interface Line { key: number; item: StockItem | null; qty: string; batchNo: string }
const blank = (): Line => ({ key: Math.random(), item: null, qty: '', batchNo: '' });

export default function Dispense() {
  const { def, items, txns } = useStock();
  const notify = useNotify();
  const [ptype, setPtype] = useState<PatientType>('student');
  const [pid, setPid] = useState('');
  const [pname, setPname] = useState('');
  const [complaint, setComplaint] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [busy, setBusy] = useState(false);

  const inStock = useMemo(() => items.filter((i) => (i.quantity ?? 0) > 0), [items]);
  const recentForPatient = pid.trim().length >= 3 ? txns.filter((t) => t.type === 'out' && t.patientId === pid.trim().toUpperCase()).slice(0, 5) : [];
  const set = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));

  const submit = async () => {
    setBusy(true);
    try {
      await dispense(def.id, { type: ptype, id: pid, name: pname, complaint }, lines.map((l) => ({ itemId: l.item?.id ?? '', qty: Number(l.qty) || 0, batchNo: l.batchNo })));
      notify(ptype === 'writeoff' ? 'Write-off recorded.' : `Issued ${lines.filter((l) => l.item).length} medicine(s) to ${pid.toUpperCase() || pname}.`);
      setPid(''); setPname(''); setComplaint(''); setLines([blank()]);
    } catch (e) { notify(errMsg(e), 'error'); }
    setBusy(false);
  };

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Issue medicines</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Given to" value={ptype} onChange={(e) => setPtype(e.target.value as PatientType)}>
                  {PATIENT_TYPES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                </TextField>
              </Grid>
              {ptype !== 'writeoff' && <>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label={ptype === 'student' ? 'Student ID (e.g. O234747)' : 'ID / Employee no.'} value={pid} onChange={(e) => setPid(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}><TextField label="Name" value={pname} onChange={(e) => setPname(e.target.value)} /></Grid>
              </>}
              <Grid size={12}>
                <TextField label={ptype === 'writeoff' ? 'Reason (expired / damaged / lost)' : 'Complaint / diagnosis (optional)'} value={complaint} onChange={(e) => setComplaint(e.target.value)} />
              </Grid>
            </Grid>
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Medicines</Typography>
            <Stack spacing={1.5}>
              {lines.map((l) => (
                <Grid container spacing={1} key={l.key} alignItems="center">
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Autocomplete options={inStock} value={l.item} onChange={(_, v) => set(l.key, { item: v, batchNo: '' })}
                      groupBy={(o) => o.category || 'Other'}
                      getOptionLabel={(o) => `${o.name} (${o.quantity} ${o.unit})`}
                      renderInput={(p) => <TextField {...p} label="Medicine / item" />} />
                  </Grid>
                  <Grid size={{ xs: 5, sm: 2 }}><TextField type="number" label="Qty" value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} /></Grid>
                  <Grid size={{ xs: 5, sm: 3 }}>
                    <TextField select label="Batch" value={l.batchNo} onChange={(e) => set(l.key, { batchNo: e.target.value })} disabled={!l.item?.batches?.length}>
                      <MenuItem value="">Auto (earliest expiry)</MenuItem>
                      {(l.item?.batches ?? []).map((b) => <MenuItem key={b.batchNo} value={b.batchNo}>{b.batchNo}{b.expiry ? ` · exp ${b.expiry}` : ''} · {b.qty}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 2, sm: 1 }}>
                    <IconButton disabled={lines.length === 1} onClick={() => setLines(lines.filter((x) => x.key !== l.key))}><DeleteIcon /></IconButton>
                  </Grid>
                </Grid>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button startIcon={<AddIcon />} onClick={() => setLines([...lines, blank()])}>Add another medicine</Button>
              <span style={{ flexGrow: 1 }} />
              <Button variant="contained" size="large" disabled={busy} onClick={submit}>{busy ? 'Saving…' : ptype === 'writeoff' ? 'Record write-off' : 'Issue'}</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Date, time and your login are recorded automatically as “issued by”.</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Recent issues {recentForPatient.length ? `to ${pid.toUpperCase()}` : ''}</Typography>
            {pid.trim().length >= 3 && recentForPatient.length === 0 && <Alert severity="info">No earlier issues for {pid.toUpperCase()} in recent records.</Alert>}
            {(recentForPatient.length ? recentForPatient : txns.filter((t) => t.type === 'out').slice(0, 8)).map((t) => (
              <Stack key={t.id} sx={{ py: 1, borderBottom: '1px solid #EDE7DC' }}>
                <Typography variant="body2"><b>{t.itemName}</b> × {t.qty} {t.unit}</Typography>
                <Typography variant="caption" color="text.secondary">{fmtDateTime(t.at)} · {t.party || '—'}{t.complaint ? ` · ${t.complaint}` : ''}</Typography>
                <Chip size="small" variant="outlined" label={`by ${t.by.split('@')[0]}`} sx={{ alignSelf: 'flex-start', mt: 0.5 }} />
              </Stack>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
