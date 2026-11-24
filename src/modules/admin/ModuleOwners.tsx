import { Alert, Autocomplete, Button, Card, CardContent, Chip, Grid2 as Grid, Stack, TextField, Typography } from '@mui/material';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNotify } from '../../components/Notify';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { logAudit } from '../../lib/audit';
import { errMsg } from '../../lib/format';
import { MODULES } from '../../config/modules';
import { INSTITUTE_DOMAIN } from '../../config/roles';
import ModuleIcon from '../../components/ModuleIcon';

export default function ModuleOwners() {
  const { moduleDocs } = useAuth();
  const notify = useNotify();
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setDraft(Object.fromEntries(MODULES.map((m) => [m.id, moduleDocs[m.id]?.owners ?? []])));
  }, [moduleDocs]);

  const save = async (id: string) => {
    const owners = (draft[id] ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const bad = owners.find((e) => !e.endsWith('@' + INSTITUTE_DOMAIN));
    if (bad) return notify(`${bad} is not an @${INSTITUTE_DOMAIN} address.`, 'error');
    try {
      await setDoc(doc(db, 'modules', id), { name: MODULES.find((m) => m.id === id)?.name ?? id, owners, updatedAt: serverTimestamp() }, { merge: true });
      logAudit('admin', 'set_owners', 'module', id, owners.join(', '));
      notify('Owners saved.');
    } catch (e) { notify(errMsg(e), 'error'); }
  };

  const missing = MODULES.filter((m) => !moduleDocs[m.id]).length;

  return (
    <>
      <Alert severity={missing ? 'warning' : 'info'} sx={{ mb: 2 }}>
        Owners (HoDs / coordinators) sign in with their official Google account and get view + modify rights on their module, plus its audit log.
        {missing > 0 && ` ${missing} module(s) have no settings document yet — run the seed script or save owners here.`}
      </Alert>
      <Grid container spacing={2}>
        {MODULES.map((m) => (
          <Grid key={m.id} size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <ModuleIcon id={m.id} sx={{ color: m.color }} />
                  <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>{m.name}</Typography>
                  {m.ownerUsername && <Chip size="small" variant="outlined" label={`login: ${m.ownerUsername}`} />}
                </Stack>
                <Autocomplete
                  multiple freeSolo options={m.defaultOwners}
                  value={draft[m.id] ?? []}
                  onChange={(_, v) => setDraft({ ...draft, [m.id]: v as string[] })}
                  renderInput={(p) => <TextField {...p} label="Owner emails" placeholder={`name@${INSTITUTE_DOMAIN} — press Enter`} />}
                />
                <Button size="small" variant="contained" sx={{ mt: 1.5 }} onClick={() => save(m.id)}>Save</Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
