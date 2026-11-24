import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography, Grid2 as Grid, InputAdornment, IconButton } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { INSTITUTE_DOMAIN } from '../config/roles';
import { MODULES } from '../config/modules';
import ModuleIcon from '../components/ModuleIcon';

export default function LoginPage() {
  const { signInGoogle, signInStaff, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const staff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await signInStaff(username, password);
    setBusy(false);
  };

  return (
    <Grid container sx={{ minHeight: '100vh' }}>
      <Grid size={{ xs: 12, md: 7 }} sx={{ background: 'linear-gradient(135deg,#0d2d57 0%,#15437f 55%,#1e5aa8 100%)', color: '#fff', p: { xs: 4, md: 8 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <Box component="img" src={`${import.meta.env.BASE_URL}logo.svg`} alt="ROSMS" sx={{ width: 64, height: 64 }} />
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: 1 }}>ROSMS</Typography>
            <Typography sx={{ opacity: 0.9 }}>RGUKT Ongole Smart Management System</Typography>
          </Box>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#f8c471' }}>One campus, one system.</Typography>
        <Typography sx={{ opacity: 0.85, maxWidth: 560, mb: 4 }}>
          Library, hospital, central stores, department and works stock, and student outpasses — managed in one secure place for
          Rajiv Gandhi University of Knowledge Technologies, Ongole.
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          {MODULES.map((m) => (
            <Stack key={m.id} direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.25, py: 0.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,.1)', fontSize: 13 }}>
              <ModuleIcon id={m.id} sx={{ fontSize: 16 }} /> <span>{m.short}</span>
            </Stack>
          ))}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, md: 6 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, width: '100%', maxWidth: 420 }}>
          <Typography variant="h5" gutterBottom>Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Students, faculty and officers: use your <b>@{INSTITUTE_DOMAIN}</b> Google account.
          </Typography>
          {error && <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>{error}</Alert>}
          <Button fullWidth size="large" variant="contained" startIcon={<GoogleIcon />} onClick={signInGoogle}>
            Sign in with Google
          </Button>
          <Divider sx={{ my: 3 }}>or staff username</Divider>
          <Box component="form" onSubmit={staff}>
            <Stack spacing={2}>
              <TextField label="Username" placeholder="e.g. warden01" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
              <TextField
                label="Password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } }}
              />
              <Button type="submit" variant="outlined" size="large" disabled={busy || !username || !password}>
                {busy ? 'Signing in…' : 'Sign in with username'}
              </Button>
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
            Forgot your staff password? Contact the ROSMS administrator (AO office) to reset it.
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}
