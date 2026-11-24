import { Chip, Stack } from '@mui/material';
import dayjs from 'dayjs';
import DataTable, { type Column } from '../../components/DataTable';
import { EXPIRY_WARN_DAYS, useStock } from './StockModule';
import type { StockItem } from './types';

interface ExpRow { id: string; name: string; code: string; batchNo: string; expiry: string; qty: number; unit: string; days: number }

export default function Alerts() {
  const { def, items, loading } = useStock();
  const out = items.filter((i) => !(i.quantity ?? 0));
  const low = items.filter((i) => (i.quantity ?? 0) > 0 && (i.quantity ?? 0) <= (i.minLevel ?? 0));
  const cols: Column<StockItem>[] = [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Item' }, { key: 'category', label: 'Category', hideOnMobile: true },
    { key: 'quantity', label: 'In stock', align: 'right', value: (i) => i.quantity ?? 0, render: (i) => <Chip size="small" color={i.quantity ? 'warning' : 'error'} label={`${i.quantity} ${i.unit}`} /> },
    { key: 'minLevel', label: 'Min level', align: 'right', value: (i) => i.minLevel ?? 0 },
    { key: 'reorder', label: 'Suggested order', align: 'right', value: (i) => Math.max(0, (i.minLevel ?? 0) * 2 - (i.quantity ?? 0)) },
  ];
  const today = dayjs().startOf('day');
  const exp: ExpRow[] = items.flatMap((i) => (i.batches ?? []).filter((b) => !!b.expiry).map((b) => ({ id: `${i.id}-${b.batchNo}`, name: i.name, code: i.code, batchNo: b.batchNo, expiry: b.expiry, qty: b.qty, unit: i.unit, days: dayjs(b.expiry).diff(today, 'day') })))
    .filter((r) => r.days <= EXPIRY_WARN_DAYS);
  const ecols: Column<ExpRow>[] = [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Item' }, { key: 'batchNo', label: 'Batch' }, { key: 'expiry', label: 'Expiry' },
    { key: 'qty', label: 'Qty', align: 'right', value: (r) => r.qty, render: (r) => `${r.qty} ${r.unit}` },
    { key: 'days', label: 'Status', value: (r) => r.days, render: (r) => <Chip size="small" color={r.days < 0 ? 'error' : 'warning'} label={r.days < 0 ? `Expired ${-r.days}d ago` : `${r.days} days left`} /> },
  ];
  return (
    <Stack spacing={3}>
      <DataTable title={`Out of stock (${out.length})`} rows={out} columns={cols} loading={loading} exportName={`${def.id}-out-of-stock`} dense />
      <DataTable title={`Low stock (${low.length})`} rows={low} columns={cols} loading={loading} exportName={`${def.id}-low-stock`} dense />
      {def.batches && <DataTable title={`Expired / expiring within ${EXPIRY_WARN_DAYS} days (${exp.length})`} rows={exp} columns={ecols} exportName={`${def.id}-expiry`} dense initialSort={{ key: 'days', dir: 'asc' }} />}
    </Stack>
  );
}
