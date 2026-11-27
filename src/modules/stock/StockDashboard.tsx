import { Card, CardContent, Chip, Grid2 as Grid, List, ListItem, ListItemText, Typography } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import WarningIcon from '@mui/icons-material/WarningAmber';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import MedicationIcon from '@mui/icons-material/Medication';
import dayjs from 'dayjs';
import StatCard from '../../components/StatCard';
import { fmtDateTime, inr } from '../../lib/format';
import { EXPIRY_WARN_DAYS, useStock } from './StockModule';
import { TXN_LABEL } from './types';

export default function StockDashboard() {
  const { def, items, txns, transfers } = useStock();
  const low = items.filter((i) => (i.quantity ?? 0) <= (i.minLevel ?? 0));
  const outOfStock = items.filter((i) => !(i.quantity ?? 0)).length;
  const todayStart = dayjs().startOf('day').valueOf();
  const todayIssues = txns.filter((t) => t.type === 'out' && (t.at?.toMillis?.() ?? Date.now()) >= todayStart);
  const value = items.reduce((a, i) => a + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
  const pending = transfers.filter((t) => t.status === 'pending' && t.toModule === def.id).length;
  const soon = dayjs().add(EXPIRY_WARN_DAYS, 'day').format('YYYY-MM-DD');
  const expiring = items.flatMap((i) => (i.batches ?? []).filter((b) => b.expiry && b.expiry <= soon)).length;
  const monthStart = dayjs().startOf('month').valueOf();
  const monthTx = txns.filter((t) => (t.at?.toMillis?.() ?? 0) >= monthStart);

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Items" value={items.length} icon={<Inventory2Icon />} color={def.color} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label={def.batches ? 'Out of stock / low' : 'Low stock'} value={def.batches ? `${outOfStock} / ${low.length - outOfStock}` : low.length} icon={<WarningIcon />} color="#B42318" /></Grid>
        {def.batches
          ? <Grid size={{ xs: 6, md: 3 }}><StatCard label="Issues today" value={todayIssues.length} hint={`${new Set(todayIssues.map((t) => t.patientId || t.patientName)).size} patients`} icon={<MedicationIcon />} color="#1F6B48" /></Grid>
          : <Grid size={{ xs: 6, md: 3 }}><StatCard label="Stock value" value={inr(value)} icon={<CurrencyRupeeIcon />} color="#1F6B48" /></Grid>}
        {def.batches
          ? <Grid size={{ xs: 6, md: 3 }}><StatCard label={`Batches expiring ≤ ${EXPIRY_WARN_DAYS} days`} value={expiring} icon={<EventBusyIcon />} color="#B5571E" /></Grid>
          : <Grid size={{ xs: 6, md: 3 }}><StatCard label="Incoming transfers" value={pending} icon={<SwapHorizIcon />} color="#57406E" /></Grid>}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Recent movements</Typography>
            <List dense>
              {txns.slice(0, 10).map((t) => (
                <ListItem key={t.id} divider secondaryAction={<Chip size="small" label={`${['out', 'transfer_out'].includes(t.type) ? '−' : '+'}${t.qty} ${t.unit}`} color={['out', 'transfer_out'].includes(t.type) ? 'warning' : 'success'} />}>
                  <ListItemText primary={`${t.itemName} · ${def.batches && t.type === 'out' ? 'Issued' : def.batches && t.type === 'in' ? 'Received' : TXN_LABEL[t.type]}`} secondary={`${fmtDateTime(t.at)} · ${t.by}${t.party ? ` · ${t.party}` : ''}`} />
                </ListItem>
              ))}
              {txns.length === 0 && <Typography color="text.secondary">No stock movements yet. Add items under “Items & Stock”.</Typography>}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>This month</Typography>
            <Typography>Stock-in entries: <b>{monthTx.filter((t) => t.type === 'in' || t.type === 'transfer_in').length}</b></Typography>
            <Typography>Stock-out entries: <b>{monthTx.filter((t) => t.type === 'out' || t.type === 'transfer_out').length}</b></Typography>
            <Typography sx={{ mb: 2 }}>Pending incoming transfers: <b>{pending}</b></Typography>
            <Typography variant="h6" gutterBottom>Low stock</Typography>
            {low.slice(0, 8).map((i) => <Typography key={i.id} variant="body2">• {i.name}: <b>{i.quantity}</b> {i.unit} (min {i.minLevel})</Typography>)}
            {low.length === 0 && <Typography variant="body2" color="text.secondary">All items above minimum level.</Typography>}
          </CardContent></Card>
        </Grid>
      </Grid>
    </>
  );
}
