import { Autocomplete, Chip, MenuItem, TextField } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import { fmtDateTime } from '../../lib/format';
import { useStock } from './StockModule';
import { TXN_LABEL, type StockTxn, type TxnType } from './types';

export default function Ledger() {
  const { def, items, txns, loading } = useStock();
  const [type, setType] = useState<'' | TxnType>('');
  const [params, setParams] = useSearchParams();
  const itemId = params.get('item') ?? '';
  const item = items.find((i) => i.id === itemId) ?? null;
  const rows = txns.filter((t) => (!type || t.type === type) && (!itemId || t.itemId === itemId));
  const minus = (t: StockTxn) => t.type === 'out' || t.type === 'transfer_out';
  const columns: Column<StockTxn>[] = [
    { key: 'at', label: 'Date & time', value: (t) => fmtDateTime(t.at) },
    { key: 'type', label: 'Type', value: (t) => TXN_LABEL[t.type], render: (t) => <Chip size="small" variant="outlined" color={minus(t) ? 'warning' : t.type === 'adjust' ? 'default' : 'success'} label={TXN_LABEL[t.type]} /> },
    { key: 'itemCode', label: 'Code', hideOnMobile: true },
    { key: 'itemName', label: 'Item' },
    { key: 'qty', label: 'Qty', align: 'right', value: (t) => (minus(t) ? -t.qty : t.qty), render: (t) => `${minus(t) ? '−' : t.type === 'adjust' ? '±' : '+'}${t.qty} ${t.unit}` },
    { key: 'balanceAfter', label: 'Balance', align: 'right' },
    ...(def.batches ? [{ key: 'batchNo', label: 'Batch' } as Column<StockTxn>] : []),
    ...(def.batches ? [
      { key: 'patientId', label: 'Patient ID' } as Column<StockTxn>,
      { key: 'patientName', label: 'Patient', hideOnMobile: true } as Column<StockTxn>,
      { key: 'complaint', label: 'Complaint', hideOnMobile: true } as Column<StockTxn>,
      { key: 'receivedOn', label: 'Received on', hideOnMobile: true } as Column<StockTxn>,
      { key: 'expiry', label: 'Expiry', hideOnMobile: true } as Column<StockTxn>,
    ] : []),
    { key: 'reference', label: 'Ref / Voucher', hideOnMobile: true },
    { key: 'party', label: 'Supplier / Issued to' },
    { key: 'remarks', label: 'Remarks', hideOnMobile: true },
    { key: 'by', label: 'By', hideOnMobile: true },
  ];
  return (
    <DataTable title={item ? `History — ${item.name} (now ${item.quantity} ${item.unit})` : 'Stock ledger'} rows={rows} columns={columns} loading={loading} exportName={`${def.id}-ledger`} dense
      toolbar={<><Autocomplete sx={{ minWidth: 260 }} options={items} value={item} getOptionLabel={(o) => o.name}
        onChange={(_, v) => setParams(v ? { item: v.id } : {})} renderInput={(p) => <TextField {...p} label="Item / medicine" />} />
      <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as TxnType)} sx={{ minWidth: 160 }}>
        <MenuItem value="">All</MenuItem>
        {Object.entries(TXN_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
      </TextField></>} />
  );
}
