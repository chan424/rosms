import { Alert, Box, Card, CardActionArea, CardContent, Chip, Grid2 as Grid, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { accessibleModules, isOwner, isSuperAdmin } from '../lib/permissions';
import { ROLE_LABELS, emailToUsername } from '../config/roles';
import ModuleIcon from '../components/ModuleIcon';
import PageHeader from '../components/PageHeader';
import { palette } from '../theme';

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
        <Stack spacing={4}>
          {Array.from(new Set(mods.map((m) => m.group))).map((g) => (
            <Box key={g}>
              <Typography variant="overline" sx={{ color: palette.stoneLight, display: 'block', mb: 1.25 }}>{g}</Typography>
              <Grid container spacing={2}>
                {mods.filter((m) => m.group === g).map((m) => (
                  <Grid key={m.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ height: '100%', transition: 'border-color .15s, box-shadow .15s, transform .15s', '&:hover': { borderColor: palette.borderStrong, boxShadow: '0 6px 22px rgba(31,27,24,.07)', transform: 'translateY(-1px)' } }}>
                      <CardActionArea sx={{ height: '100%' }} onClick={() => nav(`/m/${m.id}`)}>
                        <CardContent sx={{ p: 2.5 }}>
                          <Stack direction="row" spacing={1.75} alignItems="flex-start">
                            <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: m.color + '14', color: m.color, border: `1px solid ${m.color}26` }}>
                              <ModuleIcon id={m.id} fontSize="small" />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{m.name}</Typography>
                                {isOwner(auth, m.id) && <Chip size="small" label="Owner" sx={{ height: 20, fontSize: 11, bgcolor: palette.ochreSoft, color: '#7A4E12' }} />}
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.55 }}>{m.description}</Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}
