import { Button, Card, CardContent, Grid2 as Grid, TextField, Typography } from '@mui/material';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { COL, type LibrarySettings } from './types';

const F: [keyof LibrarySettings, string][] = [
  ['loanDaysStudent', 'Loan period – students (days)'], ['loanDaysFaculty', 'Loan period – faculty (days)'], ['loanDaysStaff', 'Loan period – staff (days)'],
  ['maxBooksStudent', 'Max books – students'], ['maxBooksFaculty', 'Max books – faculty'], ['maxBooksStaff', 'Max books – staff'],
  ['finePerDay', 'Fine per day overdue (₹)'], ['maxRenewals', 'Max renewals per loan'],
];

export default function LibSettings() {
  const { settings } = useLibrary();
  const notify = useNotify();
  const [v, setV] = useState<LibrarySettings>(settings);
  useEffect(() => setV(settings), [settings]);

  const save = async () => {
    try {
      await setDoc(doc(db, COL.settings, 'config'), { ...v, updatedAt: serverTimestamp() });
      logAudit('library', 'update', 'settings', 'config', JSON.stringify(v));
      notify('Library rules saved.');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  return (
    <Card sx={{ maxWidth: 760 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Circulation rules</Typography>
        <Grid container spacing={2}>
          {F.map(([k, l]) => (
            <Grid key={k} size={{ xs: 12, sm: 6 }}>
              <TextField type="number" label={l} value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(0, Number(e.target.value)) })} />
            </Grid>
          ))}
        </Grid>
        <Button variant="contained" sx={{ mt: 3 }} onClick={save}>Save rules</Button>
      </CardContent>
    </Card>
  );
}
