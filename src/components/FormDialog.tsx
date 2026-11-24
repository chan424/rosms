import {
  Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid2 as Grid, MenuItem, TextField, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'email' | 'password' | 'autocomplete';

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  helper?: string;
  half?: boolean;
  min?: number;
  disabled?: boolean;
}

export type FormValues = Record<string, string>;

export default function FormDialog({ open, title, fields, initial, submitLabel = 'Save', onClose, onSubmit, validate }: {
  open: boolean;
  title: string;
  fields: Field[];
  initial?: FormValues;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (v: FormValues) => Promise<void> | void;
  validate?: (v: FormValues) => string | null;
}) {
  const [values, setValues] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = useTheme();
  const mobile = useMediaQuery(t.breakpoints.down('sm'));

  useEffect(() => {
    if (open) {
      const base: FormValues = {};
      fields.forEach((f) => (base[f.name] = initial?.[f.name] ?? ''));
      setValues(base);
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !String(values[f.name] ?? '').trim()) return setErr(`${f.label} is required.`);
      if (f.type === 'number' && values[f.name] !== '' && isNaN(Number(values[f.name]))) return setErr(`${f.label} must be a number.`);
      if (f.type === 'number' && f.min !== undefined && values[f.name] !== '' && Number(values[f.name]) < f.min) return setErr(`${f.label} must be at least ${f.min}.`);
    }
    const v = validate?.(values);
    if (v) return setErr(v);
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={mobile}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Grid container spacing={2}>
          {fields.map((f) => (
            <Grid key={f.name} size={{ xs: 12, sm: f.half ? 6 : 12 }}>
              {f.type === 'autocomplete' ? (
                <Autocomplete
                  options={f.options ?? []}
                  getOptionLabel={(o) => o.label}
                  value={(f.options ?? []).find((o) => o.value === values[f.name]) ?? null}
                  onChange={(_, o) => set(f.name, o?.value ?? '')}
                  disabled={f.disabled}
                  renderInput={(p) => <TextField {...p} label={f.label} required={f.required} helperText={f.helper} />}
                />
              ) : (
                <TextField
                  label={f.label}
                  required={f.required}
                  disabled={f.disabled}
                  value={values[f.name] ?? ''}
                  onChange={(e) => set(f.name, e.target.value)}
                  select={f.type === 'select'}
                  multiline={f.type === 'textarea'}
                  minRows={f.type === 'textarea' ? 3 : undefined}
                  type={f.type === 'datetime' ? 'datetime-local' : f.type === 'select' || f.type === 'textarea' ? undefined : f.type ?? 'text'}
                  slotProps={{ inputLabel: f.type === 'date' || f.type === 'datetime' ? { shrink: true } : undefined }}
                  helperText={f.helper}
                >
                  {f.type === 'select' && (f.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
