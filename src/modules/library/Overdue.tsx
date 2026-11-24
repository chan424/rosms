import { Alert, Chip } from '@mui/material';
import DataTable, { type Column } from '../../components/DataTable';
import { fmtDate, inr } from '../../lib/format';
import { useLibrary } from './LibraryContext';
import { computeFine, daysOverdue } from './ops';
import type { Loan } from './types';

export default function Overdue() {
  const { activeLoans, members, settings, loading } = useLibrary();
  const rows = activeLoans.filter((l) => daysOverdue(l) > 0);
  const phone = (l: Loan) => members.find((m) => m.id === l.memberDocId)?.phone ?? '';
  const columns: Column<Loan>[] = [
    { key: 'memberId', label: 'Member ID' },
    { key: 'memberName', label: 'Member' },
    { key: 'phone', label: 'Phone', value: phone, hideOnMobile: true },
    { key: 'memberEmail', label: 'Email', hideOnMobile: true },
    { key: 'accessionNo', label: 'Acc. No.' },
    { key: 'title', label: 'Title' },
    { key: 'dueAt', label: 'Due date', value: (l) => fmtDate(l.dueAt) },
    { key: 'days', label: 'Days overdue', align: 'right', value: (l) => daysOverdue(l), render: (l) => <Chip size="small" color="error" label={daysOverdue(l)} /> },
    { key: 'fine', label: 'Fine', align: 'right', value: (l) => computeFine(l, settings), render: (l) => inr(computeFine(l, settings)) },
  ];
  return (
    <>
      <Alert severity={rows.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
        {rows.length ? `${rows.length} book(s) overdue. Total accrued fine ${inr(rows.reduce((a, l) => a + computeFine(l, settings), 0))} at ${inr(settings.finePerDay)}/day.` : 'No overdue books. 🎉'}
      </Alert>
      <DataTable title="Overdue list" rows={rows} columns={columns} loading={loading} exportName="library-overdue" dense initialSort={{ key: 'days', dir: 'desc' }} />
    </>
  );
}
