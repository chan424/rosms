import {
  Alert, Autocomplete, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  Grid2 as Grid, Stack, TextField, Typography,
} from '@mui/material';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { useNotify } from '../../components/Notify';
import { errMsg, fmtDate, inr } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { computeFine, daysOverdue, issueBook, renewLoan, returnBook } from './ops';
import { maxBooks, type Book, type Loan, type Member } from './types';

export default function Circulation() {
  const { books, members, activeLoans, reservations, settings, loading } = useLibrary();
  const notify = useNotify();
  const [member, setMember] = useState<Member | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [ret, setRet] = useState<Loan | null>(null);
  const [paid, setPaid] = useState(true);

  const reservedByOther = (bookId: string, memberDocId?: string) => reservations.some((r) => r.bookId === bookId && r.memberDocId !== memberDocId);
  const memberLoans = member ? activeLoans.filter((l) => l.memberDocId === member.id) : [];

  const issue = async () => {
    if (!member || !book) return;
    setBusy(true);
    try {
      const r = await issueBook(book.id, member.id, settings, due || undefined);
      notify(`Issued “${r.title}” to ${r.member}. Due ${r.due}.`);
      setBook(null);
      setDue('');
    } catch (e) { notify(errMsg(e), 'error'); }
    setBusy(false);
  };

  const doReturn = async () => {
    if (!ret) return;
    try {
      const fine = await returnBook(ret, settings, paid);
      notify(fine ? `Returned. Fine ${inr(fine)} ${paid ? 'collected' : 'recorded as due'}.` : 'Book returned.');
      const waiting = reservations.filter((r) => r.bookId === ret.bookId);
      if (waiting.length) notify(`Returned. Note: “${ret.title}” is reserved by ${waiting[0].memberName}. Keep it aside.`, 'info');
    } catch (e) { notify(errMsg(e), 'error'); }
    setRet(null);
  };

  const renew = async (l: Loan) => {
    const m = members.find((x) => x.id === l.memberDocId);
    try {
      const d = await renewLoan(l, settings, m?.type ?? 'student', reservedByOther(l.bookId, l.memberDocId));
      notify(`Renewed until ${d}.`);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const columns: Column<Loan>[] = [
    { key: 'accessionNo', label: 'Acc. No.' },
    { key: 'title', label: 'Title' },
    { key: 'memberName', label: 'Member', value: (l) => `${l.memberName} (${l.memberId})` },
    { key: 'issuedAt', label: 'Issued', value: (l) => fmtDate(l.issuedAt), hideOnMobile: true },
    { key: 'dueAt', label: 'Due', value: (l) => fmtDate(l.dueAt), render: (l) => <Chip size="small" color={daysOverdue(l) ? 'error' : 'default'} label={fmtDate(l.dueAt)} /> },
    { key: 'fine', label: 'Fine', align: 'right', value: (l) => computeFine(l, settings), render: (l) => inr(computeFine(l, settings)) },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (l) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={() => { setRet(l); setPaid(true); }}>Return</Button>
        <Button size="small" onClick={() => renew(l)}>Renew</Button>
      </Stack>
    ) },
  ];

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Issue a book</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={members.filter((m) => m.active)}
                value={member}
                onChange={(_, v) => setMember(v)}
                getOptionLabel={(m) => `${m.name} · ${m.memberId}`}
                renderInput={(p) => <TextField {...p} label="Member (name or ID)" />}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Autocomplete
                options={books.filter((b) => b.available > 0)}
                value={book}
                onChange={(_, v) => setBook(v)}
                getOptionLabel={(b) => `${b.accessionNo} · ${b.title} (${b.available} avail.)`}
                renderInput={(p) => <TextField {...p} label="Book (accession no. or title)" />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField type="date" label="Due date (optional)" value={due} onChange={(e) => setDue(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <Button fullWidth size="large" variant="contained" disabled={!member || !book || busy} onClick={issue}>{busy ? 'Issuing…' : 'Issue'}</Button>
            </Grid>
          </Grid>
          {member && (
            <Alert severity={memberLoans.length >= maxBooks(settings, member.type) ? 'warning' : 'info'} sx={{ mt: 2 }}>
              {member.name} has {memberLoans.length} of {maxBooks(settings, member.type)} allowed book(s).
              {memberLoans.some((l) => daysOverdue(l) > 0) && ' Has overdue books!'}
            </Alert>
          )}
          {book && reservedByOther(book.id, member?.id) && (
            <Alert severity="warning" sx={{ mt: 1 }}>This title has an active reservation by another member.</Alert>
          )}
        </CardContent>
      </Card>
      <DataTable title={`Books currently issued (${activeLoans.length})`} rows={activeLoans} columns={columns} loading={loading} exportName="library-issued" dense initialSort={{ key: 'dueAt', dir: 'asc' }} />
      <Dialog open={!!ret} onClose={() => setRet(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Return book</DialogTitle>
        <DialogContent>
          {ret && (
            <Stack spacing={1}>
              <Typography><b>{ret.title}</b> ({ret.accessionNo})</Typography>
              <Typography variant="body2">Member: {ret.memberName} ({ret.memberId})</Typography>
              <Typography variant="body2">Due: {fmtDate(ret.dueAt)} · {daysOverdue(ret)} day(s) late</Typography>
              <Typography variant="h6" color={computeFine(ret, settings) ? 'error' : 'success.main'}>Fine: {inr(computeFine(ret, settings))}</Typography>
              {computeFine(ret, settings) > 0 && (
                <FormControlLabel control={<Checkbox checked={paid} onChange={(e) => setPaid(e.target.checked)} />} label="Fine collected now" />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRet(null)}>Cancel</Button>
          <Button variant="contained" onClick={doReturn}>Confirm return</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
