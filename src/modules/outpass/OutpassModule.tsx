import { Alert, Box, Tab, Tabs } from '@mui/material';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ModuleDef } from '../../config/modules';
import PageHeader from '../../components/PageHeader';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/useCollection';
import type { Outpass } from './types';
import Board from './Board';
import IssueOutpass from './IssueOutpass';
import OutpassHistory from './OutpassHistory';
import Students from './Students';

export default function OutpassModule({ def }: { def: ModuleDef }) {
  const open = useCollection<Outpass>(query(collection(db, 'outpasses'), where('status', '==', 'out')), 'op-open');
  const recent = useCollection<Outpass>(query(collection(db, 'outpasses'), orderBy('issuedAt', 'desc'), limit(500)), 'op-recent');
  const loc = useLocation();
  const nav = useNavigate();
  const base = `/m/${def.id}`;
  const seg = loc.pathname.split('/')[3] || 'board';
  const late = open.data.filter((o) => (o.expectedReturn?.toMillis?.() ?? Infinity) < Date.now()).length;
  const tabs: [string, string][] = [['board', late ? `Status board (${late} late)` : 'Status board'], ['issue', 'Issue outpass'], ['history', 'All outpasses'], ['students', 'Students']];

  return (
    <>
      <PageHeader title={def.name} subtitle="Hostel in/out register · outpasses issued by wardens, caretakers and coordinators" color={def.color} />
      {(open.error || recent.error) && <Alert severity="error" sx={{ mb: 2 }}>{open.error || recent.error}</Alert>}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabs.some((t) => t[0] === seg) ? seg : 'board'} onChange={(_, v) => nav(`${base}/${v}`)} variant="scrollable" allowScrollButtonsMobile>
          {tabs.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
        </Tabs>
      </Box>
      <Routes>
        <Route index element={<Board open={open.data} recent={recent.data} loading={open.loading} />} />
        <Route path="board" element={<Board open={open.data} recent={recent.data} loading={open.loading} />} />
        <Route path="issue" element={<IssueOutpass />} />
        <Route path="history" element={<OutpassHistory rows={recent.data} loading={recent.loading} />} />
        <Route path="students" element={<Students />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </>
  );
}
