import { Box, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import UsersAdmin from './UsersAdmin';
import ModuleOwners from './ModuleOwners';

export default function AdminPage() {
  const [tab, setTab] = useState(0);
  return (
    <>
      <PageHeader title="Administration" subtitle="Users, staff logins, module access and owners" />
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="Users & staff logins" />
          <Tab label="Module owners" />
        </Tabs>
      </Box>
      {tab === 0 && <UsersAdmin />}
      {tab === 1 && <ModuleOwners />}
    </>
  );
}
