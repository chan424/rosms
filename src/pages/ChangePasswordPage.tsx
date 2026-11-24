import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { errMsg } from '../lib/format';
import { logAudit } from '../lib/audit';
import { useNotify } from '../components/Notify';

export const passwordProblem = (p: string) => {
  if (p.length < 10) return 'Use at least 10 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use both letters and numbers.';
  return null;
};

export default function ChangePasswordPage({ forced }: { forced?: boolean }) {
  const { profile, signOut } = useAuth();
  const notify = useNotify();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile?.username) {
    return <Alert severity="info">Google accounts are managed by your institute Google Workspace; there is no ROSMS password to change.</Alert>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pw);
    if (p) return setErr(p);
    if (pw !== pw2) return setErr('Passwords do not match.');
    if (pw === cur) return setErr('New password must be different from the current one.');
    setBusy(true);
    setErr(null);
    try {
      const u = auth.currentUser!;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, cur));
      await updatePassword(u, pw);
      await updateDoc(doc(db, 'users', u.uid), { mustChangePassword: false });
      logAudit('system', 'password_change', 'user', u.uid, profile.username);
      notify('Password updated.');
      setCur(''); setPw(''); setPw2('');
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ py: forced ? 8 : 2 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        {forced && <Box component="img" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" sx={{ width: 48, mb: 1 }} />}
        <Typography variant="h5" gutterBottom>{forced ? 'Set your new password' : 'Change password'}</Typography>
        {forced && <Alert severity="warning" sx={{ mb: 2 }}>For security, you must replace the temporary password before using ROSMS.</Alert>}
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Username" value={profile.username} disabled />
            <TextField label="Current (temporary) password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
            <TextField label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required helperText="At least 10 characters with letters and numbers" autoComplete="new-password" />
            <TextField label="Confirm new password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" />
            <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>
            {forced && <Button onClick={signOut}>Sign out</Button>}
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
