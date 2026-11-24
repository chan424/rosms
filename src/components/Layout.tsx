import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader,
  Menu, MenuItem, Toolbar, Typography, useMediaQuery, useTheme, Chip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import PersonIcon from '@mui/icons-material/Person';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import HistoryIcon from '@mui/icons-material/History';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { accessibleModules, canManage, isSuperAdmin } from '../lib/permissions';
import { MODULES } from '../config/modules';
import { ROLE_LABELS, emailToUsername } from '../config/roles';
import ModuleIcon from './ModuleIcon';

const W = 272;

export default function Layout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { profile, signOut } = auth;
  const t = useTheme();
  const desktop = useMediaQuery(t.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const nav = useNavigate();
  const loc = useLocation();
  const mods = accessibleModules(auth);
  const groups = Array.from(new Set(mods.map((m) => m.group)));
  const showAudit = isSuperAdmin(profile) || MODULES.some((m) => canManage(auth, m.id));

  const go = (path: string) => { nav(path); setOpen(false); };
  const sel = (path: string) => loc.pathname === path || (path !== '/' && loc.pathname.startsWith(path));

  const drawer = (
    <Box sx={{ overflowY: 'auto' }}>
      <Toolbar />
      <List dense>
        <ListItemButton selected={sel('/')} onClick={() => go('/')}><ListItemIcon><DashboardIcon /></ListItemIcon><ListItemText primary="Dashboard" /></ListItemButton>
        <ListItemButton selected={sel('/me')} onClick={() => go('/me')}><ListItemIcon><PersonIcon /></ListItemIcon><ListItemText primary="My ROSMS" secondary="My outpasses & books" /></ListItemButton>
      </List>
      {groups.map((g) => (
        <List dense key={g} subheader={<ListSubheader sx={{ lineHeight: '32px' }}>{g}</ListSubheader>}>
          {mods.filter((m) => m.group === g).map((m) => (
            <ListItemButton key={m.id} selected={sel(`/m/${m.id}`)} onClick={() => go(`/m/${m.id}`)}>
              <ListItemIcon sx={{ color: m.color }}><ModuleIcon id={m.id} /></ListItemIcon>
              <ListItemText primary={m.short} />
            </ListItemButton>
          ))}
        </List>
      ))}
      {(showAudit || isSuperAdmin(profile)) && <Divider />}
      <List dense>
        {isSuperAdmin(profile) && (
          <ListItemButton selected={sel('/admin')} onClick={() => go('/admin')}><ListItemIcon><AdminIcon /></ListItemIcon><ListItemText primary="Administration" /></ListItemButton>
        )}
        {showAudit && (
          <ListItemButton selected={sel('/audit')} onClick={() => go('/audit')}><ListItemIcon><HistoryIcon /></ListItemIcon><ListItemText primary="Audit log" /></ListItemButton>
        )}
      </List>
    </Box>
  );

  const name = profile?.assignedTo || profile?.displayName || emailToUsername(profile?.email ?? '');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (th) => th.zIndex.drawer + 1, background: 'linear-gradient(90deg,#0d2d57,#15437f 60%,#1e5aa8)' }}>
        <Toolbar>
          {!desktop && <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }}><MenuIcon /></IconButton>}
          <Box component="img" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" sx={{ width: 34, height: 34, mr: 1.5 }} />
          <Box sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={() => go('/')}>
            <Typography variant="h6" sx={{ lineHeight: 1.1, fontWeight: 800, letterSpacing: 0.5 }}>ROSMS</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, display: { xs: 'none', sm: 'block' } }}>RGUKT Ongole Smart Management System · One campus, one system</Typography>
          </Box>
          <Chip size="small" label={profile ? ROLE_LABELS[profile.role] : ''} sx={{ mr: 1, bgcolor: 'rgba(255,255,255,.15)', color: '#fff', display: { xs: 'none', sm: 'flex' } }} />
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>{name.charAt(0).toUpperCase()}</Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{name}</Typography>
              <Typography variant="caption" color="text.secondary">{emailToUsername(profile?.email ?? '')}</Typography>
            </Box>
            <Divider />
            {profile?.username && <MenuItem onClick={() => { setAnchor(null); go('/account/password'); }}>Change password</MenuItem>}
            <MenuItem onClick={() => { setAnchor(null); signOut(); }}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        sx={{ width: W, flexShrink: 0, '& .MuiDrawer-paper': { width: W, boxSizing: 'border-box', borderRight: '1px solid #e3e8f1' } }}
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${W}px)` }, minWidth: 0 }}>
        <Toolbar />
        {children}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: 'center', mt: 6 }}>
          © {new Date().getFullYear()} Rajiv Gandhi University of Knowledge Technologies, Ongole · ROSMS
        </Typography>
      </Box>
    </Box>
  );
}
