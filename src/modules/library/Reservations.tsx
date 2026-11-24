import { Autocomplete, Button, Card, CardContent, Grid2 as Grid, Stack, TextField, Typography } from '@mui/material';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { logAudit } from '../../lib/audit';
import { errMsg, fmtDateTime } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { issueBook } from './ops';
import { COL, type Book, type Member, type Reservation } from './types';

export default function Reservations() {
  const { books, members, reservations, settings, loading } = useLibrary();
  const notify = useNotify();
  const [member, setMember] = useState<Member | null>(null);
  const [book, setBook] = useState<Book | null>(null);

  const reserve = async () => {
    if (!member || !book) return;
    if (reservations.some((r) => r.bookId === book.id && r.memberDocId === member.id)) return notify('Already reserved by this member.', 'warning');
    try {
      const ref = await addDoc(collection(db, COL.reservations), {
        bookId: book.id, title: book.title, accessionNo: book.accessionNo, memberDocId: member.id, memberId: member.memberId,
        memberName: member.name, memberEmail: (member.email ?? '').toLowerCase(), reservedAt: serverTimestamp(), status: 'active',
      });
      logAudit('library', 'reserve', 'reservation', ref.id, `${book.title} for ${member.name}`);
      notify('Reservation placed.');
      setBook(null);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const cancel = async (r: Reservation) => {
    try {
      await updateDoc(doc(db, COL.reservations, r.id), { status: 'cancelled', cancelledAt: serverTimestamp() });
      logAudit('library', 'cancel', 'reservation', r.id, `${r.title} for ${r.memberName}`);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const fulfil = async (r: Reservation) => {
    try {
      const res = await issueBook(r.bookId, r.memberDocId, settings);
      notify(`Issued to ${res.member}. Due ${res.due}.`);
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const avail = (id: string) => books.find((b) => b.id === id)?.available ?? 0;
  const queuePos = (r: Reservation) => reservations.filter((x) => x.bookId === r.bookId).sort((a, b) => (a.reservedAt?.toMillis?.() ?? 0) - (b.reservedAt?.toMillis?.() ?? 0)).findIndex((x) => x.id === r.id) + 1;

  const columns: Column<Reservation>[] = [
    { key: 'title', label: 'Book', value: (r) => `${r.title} (${r.accessionNo})` },
    { key: 'memberName', label: 'Member', value: (r) => `${r.memberName} (${r.memberId})` },
    { key: 'reservedAt', label: 'Reserved on', value: (r) => fmtDateTime(r.reservedAt) },
    { key: 'queue', label: 'Queue #', align: 'right', value: queuePos },
    { key: 'avail', label: 'Available', align: 'right', value: (r) => avail(r.bookId) },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (r) => (
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" disabled={avail(r.bookId) <= 0} onClick={() => fulfil(r)}>Issue</Button>
        <Button size="small" color="error" onClick={() => cancel(r)}>Cancel</Button>
      </Stack>
    ) },
  ];

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Reserve a book</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Autocomplete options={members.filter((m) => m.active)} value={member} onChange={(_, v) => setMember(v)} getOptionLabel={(m) => `${m.name} · ${m.memberId}`} renderInput={(p) => <TextField {...p} label="Member" />} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Autocomplete options={books} value={book} onChange={(_, v) => setBook(v)} getOptionLabel={(b) => `${b.accessionNo} · ${b.title} (${b.available} avail.)`} renderInput={(p) => <TextField {...p} label="Book" />} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button fullWidth size="large" variant="contained" disabled={!member || !book} onClick={reserve}>Reserve</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      <DataTable title="Active reservations" rows={reservations} columns={columns} loading={loading} exportName="library-reservations" dense />
    </>
  );
}
