import { Alert, Button, Chip, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useState } from 'react';
import DataTable, { type Column } from '../../components/DataTable';
import FormDialog from '../../components/FormDialog';
import { useNotify } from '../../components/Notify';
import { errMsg, fmtDateTime } from '../../lib/format';
import { getModule } from '../../config/modules';
import { useStock } from './StockModule';
import { acceptTransfer, rejectTransfer, restockTransfer } from './ops';
import type { Transfer } from './types';

const COLORS: Record<Transfer['status'], 'warning' | 'success' | 'error' | 'default' | 'info'> = { pending: 'warning', accepted: 'success', rejected: 'error', cancelled: 'default', returned: 'info' };

export default function Transfers() {
  const { def, transfers, loading } = useStock();
  const notify = useNotify();
  const [view, setView] = useState<'in' | 'out'>('in');
  const [rej, setRej] = useState<Transfer | null>(null);
  const rows = transfers.filter((t) => (view === 'in' ? t.toModule === def.id : t.fromModule === def.id));
  const run = async (f: () => Promise<void>, ok: string) => { try { await f(); notify(ok); } catch (e) { notify(errMsg(e), 'error'); } };
  const rejectedWaiting = transfers.filter((t) => t.fromModule === def.id && t.status === 'rejected').length;

  const columns: Column<Transfer>[] = [
    { key: 'createdAt', label: 'Sent', value: (t) => fmtDateTime(t.createdAt) },
    { key: 'peer', label: view === 'in' ? 'From' : 'To', value: (t) => getModule(view === 'in' ? t.fromModule : t.toModule)?.short ?? '' },
    { key: 'itemName', label: 'Item', value: (t) => `${t.itemName} (${t.itemCode})` },
    { key: 'qty', label: 'Qty', align: 'right', value: (t) => t.qty, render: (t) => `${t.qty} ${t.unit}` },
    ...(def.batches ? [{ key: 'batchNo', label: 'Batch', value: (t: Transfer) => (t.batchNo ? `${t.batchNo} (exp ${t.expiry})` : '') } as Column<Transfer>] : []),
    { key: 'remarks', label: 'Remarks', hideOnMobile: true, value: (t) => [t.remarks, t.decisionNote && `Reply: ${t.decisionNote}`].filter(Boolean).join(' · ') },
    { key: 'requestedBy', label: 'By', hideOnMobile: true },
    { key: 'status', label: 'Status', render: (t) => <Chip size="small" color={COLORS[t.status]} label={t.status} /> },
    { key: 'actions', label: '', noExport: true, value: () => '', render: (t) => (
      <Stack direction="row" spacing={1}>
        {view === 'in' && t.status === 'pending' && <>
          <Button size="small" variant="contained" color="success" onClick={() => run(() => acceptTransfer(t), 'Accepted. Stock added.')}>Accept</Button>
          <Button size="small" color="error" onClick={() => setRej(t)}>Reject</Button>
        </>}
        {view === 'out' && t.status === 'pending' && <Button size="small" onClick={() => run(() => restockTransfer(t), 'Transfer cancelled; stock returned.')}>Cancel</Button>}
        {view === 'out' && t.status === 'rejected' && <Button size="small" variant="contained" onClick={() => run(() => restockTransfer(t), 'Stock returned to inventory.')}>Restock</Button>}
      </Stack>
    ) },
  ];

  return (
    <>
      {rejectedWaiting > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{rejectedWaiting} outgoing transfer(s) were rejected. Open “Outgoing” and click Restock to put the items back.</Alert>}
      <DataTable title="Transfers" rows={rows} columns={columns} loading={loading} exportName={`${def.id}-transfers-${view}`} dense
        toolbar={<ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="in">Incoming</ToggleButton><ToggleButton value="out">Outgoing</ToggleButton>
        </ToggleButtonGroup>}
        emptyText={view === 'in' ? 'No incoming transfers.' : 'No outgoing transfers. Use Items → ⋮ → Transfer to send stock.'} />
      <FormDialog open={!!rej} title="Reject transfer" fields={[{ name: 'note', label: 'Reason', type: 'textarea', required: true }]}
        submitLabel="Reject" onClose={() => setRej(null)} onSubmit={async (v) => { await rejectTransfer(rej!, v.note); notify('Transfer rejected. Sender can restock.'); }} />
    </>
  );
}
