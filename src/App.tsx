import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import MyPortalPage from './pages/MyPortalPage';
import NotAuthorized from './pages/NotAuthorized';
import LibraryModule from './modules/library/LibraryModule';
import StockModule from './modules/stock/StockModule';
import OutpassModule from './modules/outpass/OutpassModule';
import AdminPage from './modules/admin/AdminPage';
import AuditPage from './modules/admin/AuditPage';
import { getModule } from './config/modules';
import { canAccess, isSuperAdmin } from './lib/permissions';

function ModuleRoute() {
  const { moduleId } = useParams();
  const auth = useAuth();
  const def = getModule(moduleId);
  if (!def) return <NotAuthorized message="Unknown module." />;
  if (!canAccess(auth, def.id)) return <NotAuthorized />;
  if (def.kind === 'library') return <LibraryModule def={def} />;
  if (def.kind === 'outpass') return <OutpassModule def={def} />;
  return <StockModule key={def.id} def={def} />;
}

export default function App() {
  const auth = useAuth();
  const { user, profile, loading } = auth;

  if (loading && user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user || !profile) return <LoginPage />;
  if (profile.mustChangePassword) return <ChangePasswordPage forced />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/me" element={<MyPortalPage />} />
        <Route path="/m/:moduleId/*" element={<ModuleRoute />} />
        <Route path="/account/password" element={<ChangePasswordPage />} />
        <Route path="/admin" element={isSuperAdmin(profile) ? <AdminPage /> : <NotAuthorized />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
