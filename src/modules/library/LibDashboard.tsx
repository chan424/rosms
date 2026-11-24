import { Card, CardContent, Grid2 as Grid, LinearProgress, List, ListItem, ListItemText, Stack, Typography, Chip } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import PeopleIcon from '@mui/icons-material/People';
import OutboxIcon from '@mui/icons-material/Outbox';
import WarningIcon from '@mui/icons-material/WarningAmber';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StatCard from '../../components/StatCard';
import { useLibrary } from './LibraryContext';
import { computeFine, daysOverdue } from './ops';
import { fmtDate, fmtDateTime, inr } from '../../lib/format';

export default function LibDashboard() {
  const { books, members, activeLoans, history, reservations, settings, loading } = useLibrary();
  const copies = books.reduce((a, b) => a + (Number(b.copies) || 0), 0);
  const available = books.reduce((a, b) => a + (Number(b.available) || 0), 0);
  const overdue = activeLoans.filter((l) => daysOverdue(l) > 0);
  const accruing = overdue.reduce((a, l) => a + computeFine(l, settings), 0);
  const unpaid = history.filter((l) => l.status === 'returned' && !l.finePaid && l.fine > 0).reduce((a, l) => a + l.fine, 0);
  const byCat = Object.entries(books.reduce<Record<string, number>>((acc, b) => { const c = b.category || 'Uncategorised'; acc[c] = (acc[c] ?? 0) + (Number(b.copies) || 0); return acc; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCat = byCat[0]?.[1] ?? 1;

  return (
    <>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Titles" value={books.length} icon={<MenuBookIcon />} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Total copies" value={copies} icon={<LibraryBooksIcon />} color="#6a1b9a" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Available now" value={available} icon={<CheckCircleIcon />} color="#2e7d32" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Members" value={members.filter((m) => m.active).length} icon={<PeopleIcon />} color="#00838f" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Books issued" value={activeLoans.length} icon={<OutboxIcon />} color="#ef6c00" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Overdue" value={overdue.length} icon={<WarningIcon />} color="#c62828" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Fines (accruing + unpaid)" value={inr(accruing + unpaid)} icon={<CurrencyRupeeIcon />} color="#ad1457" hint={`${inr(settings.finePerDay)}/day`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Active reservations" value={reservations.length} icon={<BookmarkIcon />} color="#4527a0" /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Recent circulation</Typography>
            <List dense>
              {history.slice(0, 8).map((l) => (
                <ListItem key={l.id} divider secondaryAction={<Chip size="small" color={l.status === 'issued' ? (daysOverdue(l) ? 'error' : 'warning') : 'success'} label={l.status === 'issued' ? (daysOverdue(l) ? 'Overdue' : 'Issued') : 'Returned'} />}>
                  <ListItemText primary={l.title} secondary={`${l.memberName} · ${fmtDateTime(l.issuedAt)} · due ${fmtDate(l.dueAt)}`} />
                </ListItem>
              ))}
              {history.length === 0 && <Typography color="text.secondary">No circulation yet.</Typography>}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Collection by category</Typography>
            <Stack spacing={1.5}>
              {byCat.map(([c, n]) => (
                <div key={c}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2">{c}</Typography><Typography variant="body2" color="text.secondary">{n}</Typography></Stack>
                  <LinearProgress variant="determinate" value={(n / maxCat) * 100} sx={{ height: 8, borderRadius: 4 }} />
                </div>
              ))}
              {byCat.length === 0 && <Typography color="text.secondary">Add books to the catalogue to see this chart.</Typography>}
            </Stack>
          </CardContent></Card>
        </Grid>
      </Grid>
    </>
  );
}
