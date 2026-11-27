import { Alert, Card, CardContent, Chip, Grid2 as Grid, InputAdornment, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { collection, doc, endAt, getDocs, limit, onSnapshot, orderBy, query, startAt, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { useCollection } from '../lib/useCollection';
import { fmtDate, fmtDateTime } from '../lib/format';
import { isInstituteEmail } from '../config/roles';
import type { Student, Outpass } from '../modules/outpass/types';
import type { Book, Loan } from '../modules/library/types';
import { outpassStatusChip } from '../modules/outpass/OutpassHistory';
import { daysOverdue } from '../modules/library/ops';

export default function MyPortalPage() {
  const { profile } = useAuth();
  const email = profile?.email.toLowerCase() ?? '';
  const inst = isInstituteEmail(email);
  const [me, setMe] = useState<Student | null>(null);
  const outpasses = useCollection<Outpass>(inst ? query(collection(db, 'outpasses'), where('studentEmail', '==', email), orderBy('issuedAt', 'desc'), limit(50)) : null, `my-op-${email}`);
  const loans = useCollection<Loan>(inst ? query(collection(db, 'library_loans'), where('memberEmail', '==', email), orderBy('issuedAt', 'desc'), limit(50)) : null, `my-loans-${email}`);
  const [term, setTerm] = useState('');
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    if (!inst) return;
    return onSnapshot(doc(db, 'students', email), (s) => setMe(s.exists() ? ({ id: s.id, ...s.data() } as Student) : null), () => setMe(null));
  }, [email, inst]);

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) { setBooks([]); return; }
    const h = setTimeout(async () => {
      const cap = t.replace(/\b\w/g, (c) => c.toUpperCase());
      const res = new Map<string, Book>();
      for (const [field, v] of [['title', cap], ['title', t], ['author', cap], ['accessionNo', t]] as const) {
        try {
          const s = await getDocs(query(collection(db, 'library_books'), orderBy(field), startAt(v), endAt(v + '\uf8ff'), limit(15)));
          s.docs.forEach((d) => res.set(d.id, { id: d.id, ...(d.data() as Omit<Book, 'id'>) }));
        } catch { /* ignore */ }
      }
      setBooks([...res.values()].slice(0, 30));
    }, 350);
    return () => clearTimeout(h);
  }, [term]);

  const active = loans.data.filter((l) => l.status === 'issued');

  return (
    <>
      <PageHeader title="My ROSMS" subtitle="Your campus status, outpasses and library books" />
      {!inst && <Alert severity="info" sx={{ mb: 2 }}>Personal records are linked to @rguktong.ac.in Google accounts. Staff usernames do not have personal records.</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}><CardContent>
            <Typography variant="overline" color="text.secondary">Campus status</Typography>
            {me ? (
              <>
                <Typography variant="h4" sx={{ color: me.status === 'out' ? 'warning.main' : 'success.main' }}>{me.status === 'out' ? 'Out of campus' : 'In campus'}</Typography>
                <Typography variant="body2" color="text.secondary">{me.idNo} · {me.name} · {me.hostel} {me.room}</Typography>
              </>
            ) : <Typography color="text.secondary">No hostel record linked to {email || 'this account'}.</Typography>}
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}><CardContent>
            <Typography variant="overline" color="text.secondary">My library books ({active.length} issued)</Typography>
            <List dense>
              {loans.data.slice(0, 10).map((l) => (
                <ListItem key={l.id} divider secondaryAction={l.status === 'issued' ? <Chip size="small" color={daysOverdue(l) ? 'error' : 'warning'} label={daysOverdue(l) ? `Overdue ${daysOverdue(l)}d` : `Due ${fmtDate(l.dueAt)}`} /> : <Chip size="small" label={l.fine && !l.finePaid ? `Fine ₹${l.fine} due` : 'Returned'} color={l.fine && !l.finePaid ? 'error' : 'success'} />}>
                  <ListItemText primary={l.title} secondary={`Issued ${fmtDate(l.issuedAt)}`} />
                </ListItem>
              ))}
              {loans.data.length === 0 && <Typography variant="body2" color="text.secondary">No library loans.</Typography>}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">My outpasses</Typography>
            <List dense>
              {outpasses.data.map((o) => (
                <ListItem key={o.id} divider secondaryAction={outpassStatusChip(o)}>
                  <ListItemText primary={`${o.reason}${o.destination ? ` → ${o.destination}` : ''}`}
                    secondary={`Issued ${fmtDateTime(o.issuedAt)} by ${o.issuedByName} (${o.issuedByRole}) · expected ${fmtDateTime(o.expectedReturn)}${o.actualReturn ? ` · returned ${fmtDateTime(o.actualReturn)}` : ''}`} />
                </ListItem>
              ))}
              {outpasses.data.length === 0 && <Typography variant="body2" color="text.secondary">No outpasses on record.</Typography>}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">Search the library catalogue</Typography>
            <TextField placeholder="Title, author or accession no." value={term} onChange={(e) => setTerm(e.target.value)} sx={{ my: 1, maxWidth: 480 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
            <Stack spacing={1}>
              {books.map((b) => (
                <Stack key={b.id} direction="row" spacing={1} alignItems="center" sx={{ borderBottom: '1px solid #EDE7DC', py: 0.5 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}><b>{b.title}</b> — {b.author} · {b.accessionNo} · Rack {b.rack || '—'}</Typography>
                  <Chip size="small" color={b.available > 0 ? 'success' : 'default'} label={b.available > 0 ? `${b.available} available` : 'All issued'} />
                </Stack>
              ))}
              {term.trim().length >= 2 && books.length === 0 && <Typography variant="body2" color="text.secondary">No matching books.</Typography>}
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>
    </>
  );
}
