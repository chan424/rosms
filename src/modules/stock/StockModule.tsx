import { Alert, Box, Tab, Tabs } from '@mui/material';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { createContext, useContext } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { ModuleDef } from '../../config/modules';
import PageHeader from '../../components/PageHeader';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/useCollection';
import { itemsPath, txnsPath, type StockItem, type StockTxn, type Transfer } from './types';
import StockDashboard from './StockDashboard';
import Items from './Items';
import Ledger from './Ledger';
import Transfers from './Transfers';
import Alerts from './Alerts';
import Dispense from './hospital/Dispense';
import DailyRegister from './hospital/DailyRegister';
import PatientHistory from './hospital/PatientHistory';

interface StockData {
  def: ModuleDef;
  items: StockItem[];
  txns: StockTxn[];
  transfers: Transfer[];
  loading: boolean;
}

const Ctx = createContext<StockData | null>(null);
export const useStock = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStock outside provider');
  return c;
};

export const EXPIRY_WARN_DAYS = 60;

export default function StockModule({ def }: { def: ModuleDef }) {
  const items = useCollection<StockItem>(query(collection(db, itemsPath(def.id)), orderBy('name')), `items-${def.id}`);
  const txns = useCollection<StockTxn>(query(collection(db, txnsPath(def.id)), orderBy('at', 'desc'), limit(1500)), `txns-${def.id}`);
  const tOut = useCollection<Transfer>(query(collection(db, 'transfers'), where('fromModule', '==', def.id), orderBy('createdAt', 'desc'), limit(300)), `tout-${def.id}`);
  const tIn = useCollection<Transfer>(query(collection(db, 'transfers'), where('toModule', '==', def.id), orderBy('createdAt', 'desc'), limit(300)), `tin-${def.id}`);
  const transfers = { data: [...tIn.data, ...tOut.data].sort((a, b) => (b.createdAt?.toMillis?.() ?? Date.now()) - (a.createdAt?.toMillis?.() ?? Date.now())), error: tIn.error || tOut.error };
  const loc = useLocation();
  const nav = useNavigate();
  const base = `/m/${def.id}`;
  const seg = loc.pathname.split('/')[3] || 'dashboard';
  const pendingIn = transfers.data.filter((t) => t.toModule === def.id && t.status === 'pending').length;
  const transfersTab: [string, string] = ['transfers', pendingIn ? `Transfers (${pendingIn} incoming)` : 'Transfers'];
  const tabs: [string, string][] = def.batches
    ? [['dashboard', 'Dashboard'], ['dispense', 'Issue medicines'], ['items', 'Medicines & Receive'], ['register', 'Daily register'],
       ['patient', 'Patient history'], ['ledger', 'Ledger'], ['alerts', 'Stock & Expiry alerts'], transfersTab]
    : [['dashboard', 'Dashboard'], ['items', 'Items & Stock'], ['ledger', 'Ledger'], transfersTab, ['alerts', 'Low stock']];
  const error = items.error || txns.error || transfers.error;

  return (
    <Ctx.Provider value={{ def, items: items.data, txns: txns.data, transfers: transfers.data, loading: items.loading }}>
      <PageHeader title={def.name} subtitle={def.description} color={def.color} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabs.some((t) => t[0] === seg) ? seg : 'dashboard'} onChange={(_, v) => nav(`${base}/${v}`)} variant="scrollable" allowScrollButtonsMobile>
          {tabs.map(([k, l]) => <Tab key={k} value={k} label={l} />)}
        </Tabs>
      </Box>
      <Routes>
        <Route index element={<StockDashboard />} />
        <Route path="dashboard" element={<StockDashboard />} />
        <Route path="items" element={<Items />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="alerts" element={<Alerts />} />
        {def.batches && <Route path="dispense" element={<Dispense />} />}
        {def.batches && <Route path="register" element={<DailyRegister />} />}
        {def.batches && <Route path="patient" element={<PatientHistory />} />}
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Ctx.Provider>
  );
}
