import { Alert, Box, Card, CardActionArea, CardContent, Chip, Grid2 as Grid, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { accessibleModules, isOwner, isSuperAdmin } from '../lib/permissions';
import { ROLE_LABELS, emailToUsername } from '../config/roles';
import ModuleIcon from '../components/ModuleIcon';
import PageHeader from '../components/PageHeader';

export default function DashboardPage() {
  const auth = useAuth();
  const { profile } = auth;
  const nav = useNavigate();
  const mods = accessibleModules(auth);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.assignedTo || profile?.displayName || emailToUsername(profile?.email ?? '');

  return (
    <>
      <PageHeader title={`${greet}, ${name}`} subtitle={`${profile ? ROLE_LABELS[profile.role] : ''} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} />
      {isSuperAdmin(profile) && <Alert severity="info" sx={{ mb: 3 }}>You are a super admin: every module and the Administration panel are available to you.</Alert>}
      {mods.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6">Welcome to ROSMS</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No management modules are assigned to your account. You can still view your campus status, outpasses and library books in <b>My ROSMS</b>.
            </Typography>
            <Chip label="Open My ROSMS" color="primary" onClick={() => nav('/me')} />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {mods.map((m) => (
            <Grid key={m.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card sx={{ height: '100%', borderTop: 4, borderTopColor: m.color }}>
                <CardActionArea sx={{ height: '100%' }} onClick={() => nav(`/m/${m.id}`)}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: m.color + '1a', color: m.color }}>
                        <ModuleIcon id={m.id} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={700}>{m.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{m.description}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      <Chip size="small" label={m.group} variant="outlined" />
                      {isOwner(auth, m.id) && <Chip size="small" color="primary" label="Owner" />}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}
