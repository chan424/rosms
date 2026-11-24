import { Alert, Autocomplete, Button, Card, CardContent, Chip, Grid2 as Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useNotify } from '../../components/Notify';
import { useAuth } from '../../lib/AuthContext';
import { errMsg } from '../../lib/format';
import { emailToUsername } from '../../config/roles';
import { issueOutpass } from './ops';
import { searchStudents } from './studentSearch';
import { OUTPASS_TYPES, type OutpassType, type Student } from './types';

export default function IssueOutpass() {
  const { profile } = useAuth();
  const notify = useNotify();
  const [term, setTerm] = useState('');
  const [opts, setOpts] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [type, setType] = useState<OutpassType>('local');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [ret, setRet] = useState(dayjs().hour(20).minute(0).format('YYYY-MM-DDTHH:mm'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => { searchStudents(term).then(setOpts).catch(() => setOpts([])); }, 300);
    return () => clearTimeout(h);
  }, [term]);

  const submit = async () => {
    if (!student || !profile) return;
    if (!reason.trim()) return notify('Enter the reason.', 'error');
    setBusy(true);
    try {
      await issueOutpass(student, { type, reason: reason.trim(), destination: destination.trim(), expectedReturn: new Date(ret) }, profile);
      notify(`Outpass issued to ${student.name}.`);
      setStudent(null); setReason(''); setDestination(''); setTerm('');
    } catch (e) { notify(errMsg(e), 'error'); }
    setBusy(false);
  };

  return (
    <Card sx={{ maxWidth: 900 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Issue an outpass</Typography>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Autocomplete
              options={opts}
              value={student}
              filterOptions={(x) => x}
              onChange={(_, v) => setStudent(v)}
              onInputChange={(_, v) => setTerm(v)}
              getOptionLabel={(s) => `${s.idNo} · ${s.name}${s.hostel ? ` · ${s.hostel}` : ''}`}
              renderOption={(p, s) => (
                <li {...p} key={s.id}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    <span style={{ flexGrow: 1 }}>{s.idNo} · {s.name} {s.hostel && `· ${s.hostel}`}</span>
                    <Chip size="small" color={s.status === 'out' ? 'warning' : 'success'} label={s.status === 'out' ? 'Out' : 'In campus'} />
                  </Stack>
                </li>
              )}
              noOptionsText={term.length < 2 ? 'Type ID number (e.g. O234747), name or email' : 'No student found. Register them under “Students”.'}
              renderInput={(p) => <TextField {...p} label="Student (ID no., name or email)" />}
            />
          </Grid>
          {student && (
            <Grid size={12}>
              <Alert severity={student.status === 'out' ? 'warning' : 'info'}>
                {student.name} ({student.idNo}) · {student.branch} {student.year} · {student.hostel} {student.room} · Phone {student.phone || '—'} · Parent {student.parentPhone || '—'}
                {student.status === 'out' && ' — already OUT on an outpass.'}
              </Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Outpass type" value={type} onChange={(e) => setType(e.target.value as OutpassType)}>
              {OUTPASS_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField type="datetime-local" label="Expected return" value={ret} onChange={(e) => setRet(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={12}><TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} required /></Grid>
          <Grid size={12}><TextField label="Destination / Accompanied by" value={destination} onChange={(e) => setDestination(e.target.value)} /></Grid>
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Issued by: <b>{profile?.assignedTo || profile?.displayName || emailToUsername(profile?.email ?? '')}</b> · time is recorded automatically.</Typography>
            <Button variant="contained" size="large" disabled={!student || student.status === 'out' || busy} onClick={submit}>{busy ? 'Issuing…' : 'Issue outpass'}</Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
