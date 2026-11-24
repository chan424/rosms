import { Alert, Box, Tab, Tabs } from '@mui/material';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ModuleDef } from '../../config/modules';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../lib/AuthContext';
import { canManage } from '../../lib/permissions';
import { LibraryProvider, useLibrary } from './LibraryContext';
import LibDashboard from './LibDashboard';
import Catalogue from './Catalogue';
import Members from './Members';
import Circulation from './Circulation';
import Overdue from './Overdue';
import Reservations from './Reservations';
import History from './History';
import LibSettings from './LibSettings';

function Inner({ def }: { def: ModuleDef }) {
  const auth = useAuth();
  const manage = canManage(auth, def.id);
  const loc = useLocation();
  const nav = useNavigate();
  const { error } = useLibrary();
  const tabs = [
    ['dashboard', 'Dashboard'], ['catalogue', 'Catalogue'], ['members', 'Members'], ['circulation', 'Issue / Return'],
    ['overdue', 'Overdue'], ['reservations', 'Reservations'], ['history', 'History & Fines'],
    ...(manage ? [['settings', 'Settings']] : []),
  ];
  const seg = loc.pathname.split('/')[3] || 'dashboard';
  const base = `/m/${def.id}`;

  return (
    <>
      <PageHeader title={def.name} subtitle="Central Library · RGUKT Ongole" color={def.color} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabs.some((t) => t[0] === seg) ? seg : 'dashboard'} onChange={(_, v) => nav(`${base}/${v}`)} variant="scrollable" allowScrollButtonsMobile>
          {tabs.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
        </Tabs>
      </Box>
      <Routes>
        <Route index element={<LibDashboard />} />
        <Route path="dashboard" element={<LibDashboard />} />
        <Route path="catalogue" element={<Catalogue />} />
        <Route path="members" element={<Members />} />
        <Route path="circulation" element={<Circulation />} />
        <Route path="overdue" element={<Overdue />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="history" element={<History />} />
        {manage && <Route path="settings" element={<LibSettings />} />}
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </>
  );
}

export default function LibraryModule({ def }: { def: ModuleDef }) {
  return (
    <LibraryProvider>
      <Inner def={def} />
    </LibraryProvider>
  );
}
