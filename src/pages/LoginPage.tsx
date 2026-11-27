import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography, InputAdornment, IconButton } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { INSTITUTE_DOMAIN } from '../config/roles';
import { MODULES } from '../config/modules';
import ModuleIcon from '../components/ModuleIcon';
import { palette, serif } from '../theme';

const GROUPS = Array.from(new Set(MODULES.map((m) => m.group)));

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
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, bgcolor: palette.canvas }}>
      {/* Left: the institution */}
      <Box
        sx={{
          position: 'relative', overflow: 'hidden', color: '#FAF8F4',
          bgcolor: palette.maroonDeep,
          backgroundImage: `radial-gradient(120% 90% at 0% 0%, ${palette.maroon} 0%, ${palette.maroonDeep} 55%, ${palette.maroonInk} 100%)`,
          px: { xs: 3, sm: 5, md: 8 }, py: { xs: 4, md: 7 },
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 5,
        }}
      >
        {/* fine ruled-paper texture */}
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg, #FAF8F4 0 1px, transparent 1px 28px)' }} />
        <Box aria-hidden sx={{ position: 'absolute', right: -120, bottom: -120, width: 420, height: 420, borderRadius: '50%', border: `1px solid ${palette.ochre}`, opacity: 0.25 }} />
        <Box aria-hidden sx={{ position: 'absolute', right: -60, bottom: -60, width: 300, height: 300, borderRadius: '50%', border: `1px solid ${palette.ochre}`, opacity: 0.18 }} />

        <Stack direction="row" spacing={1.75} alignItems="center" sx={{ position: 'relative' }}>
          <Box component="img" src={`${import.meta.env.BASE_URL}logo.svg`} alt="ROSMS" sx={{ width: 48, height: 48, borderRadius: '12px', boxShadow: '0 0 0 1px rgba(211,161,90,.35)' }} />
          <Box>
            <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 24, lineHeight: 1, letterSpacing: '0.02em' }}>ROSMS</Typography>
            <Typography sx={{ fontSize: 12.5, opacity: 0.75, mt: 0.4 }}>RGUKT Ongole · Smart Management System</Typography>
          </Box>
        </Stack>

        <Box sx={{ position: 'relative', maxWidth: 560 }}>
          <Typography variant="overline" sx={{ color: '#D3A15A', display: 'block', mb: 1.5, lineHeight: 1.7 }}>
            Rajiv Gandhi University of Knowledge Technologies
          </Typography>
          <Typography component="h1" sx={{ fontFamily: serif, fontWeight: 500, fontSize: { xs: 34, sm: 44, md: 52 }, lineHeight: 1.05, letterSpacing: '-0.02em', mb: 2.5 }}>
            One campus,
            <Box component="span" sx={{ display: 'block', fontStyle: 'italic', color: '#E9C98F' }}>one record of everything.</Box>
          </Typography>
          <Typography sx={{ opacity: 0.82, fontSize: 15.5, lineHeight: 1.65, maxWidth: 500 }}>
            Library circulation, the dispensary, central stores, department and works stock, and student outpasses —
            kept in a single register for the Ongole campus.
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 2.5, maxWidth: 640 }}>
          {GROUPS.map((g) => (
            <Box key={g}>
              <Typography sx={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D3A15A', fontWeight: 700, mb: 1, pb: 0.75, borderBottom: '1px solid rgba(250,248,244,.15)' }}>{g}</Typography>
              <Stack spacing={0.6}>
                {MODULES.filter((m) => m.group === g).map((m) => (
                  <Stack key={m.id} direction="row" spacing={1} alignItems="center" sx={{ fontSize: 13, opacity: 0.88 }}>
                    <ModuleIcon id={m.id} sx={{ fontSize: 15, opacity: 0.8 }} /> <span>{m.short}</span>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right: sign in */}
      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, sm: 4 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Paper elevation={1} sx={{ p: { xs: 3, sm: 4.5 }, borderRadius: 3, border: `1px solid ${palette.border}` }}>
            <Typography variant="overline" sx={{ color: palette.ochre }}>Welcome back</Typography>
            <Typography component="h2" sx={{ fontFamily: serif, fontWeight: 600, fontSize: 30, lineHeight: 1.15, mb: 1 }}>Sign in to ROSMS</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
              Students, faculty and officers use their <Box component="b" sx={{ color: 'text.primary' }}>@{INSTITUTE_DOMAIN}</Box> Google account.
            </Typography>
            {error && <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>{error}</Alert>}
            <Button
              fullWidth size="large" variant="outlined" startIcon={<GoogleIcon sx={{ color: palette.maroon }} />} onClick={signInGoogle}
              sx={{ py: 1.25, bgcolor: '#fff', color: 'text.primary', borderColor: palette.borderStrong, fontWeight: 600 }}
            >
              Continue with Google
            </Button>
            <Divider sx={{ my: 3, color: palette.stoneLight, fontSize: 12, '&::before, &::after': { borderColor: palette.border } }}>staff username</Divider>
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
                  slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> } }}
                />
                <Button type="submit" variant="contained" size="large" disabled={busy || !username || !password} sx={{ py: 1.25 }}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>
          </Paper>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 2.5, px: 1, color: 'text.secondary' }}>
            <LockOutlined sx={{ fontSize: 16, mt: '2px', color: palette.stoneLight }} />
            <Typography variant="caption" sx={{ lineHeight: 1.6 }}>
              Access is limited to your assigned modules and every change is recorded in the audit log.
              Forgot your staff password? Contact the AO office.
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
