import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress,
  MenuItem, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography, alpha, useMediaQuery, useTheme,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/UploadFile';
import PasteIcon from '@mui/icons-material/ContentPaste';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadErrorRows, downloadTemplate, parseGrid, parsePasted, readGrid,
  type BulkColumn, type BulkValues, type ParseResult,
} from '../lib/bulk';
import { errMsg } from '../lib/format';

export type BulkMode = 'upsert' | 'add' | 'update';
export type RowStatus = 'new' | 'update' | 'ready' | 'skip' | 'error';

export interface PlannedRow {
  line: number;
  values: BulkValues;
  id: string | null;
  exists: boolean;
  status: RowStatus;
  message?: string;
}

export interface BulkReporter {
  progress: (done: number) => void;
  fail: (row: PlannedRow, message: string) => void;
}

export interface BulkFlag { key: string; label: string; help?: string; default?: boolean }

export interface BulkImportConfig {
  /** e.g. "Library books" */
  title: string;
  /** Base name of the template / error files. */
  fileName: string;
  columns: BulkColumn[];
  samples: Record<string, string | number>[];
  notes?: string[];
  /** Record id for a row, used to match existing records (add / update). Omit for append-only uploads such as stock movements. */
  keyOf?: (v: BulkValues) => string | null;
  /** Which of these ids already exist. */
  existing?: (ids: string[]) => Promise<Set<string>> | Set<string>;
  /** Returns a fresh row checker for one planning pass (so it can keep running totals). */
  checker?: () => (v: BulkValues, ctx: { id: string | null; exists: boolean }) => string | null;
  flags?: BulkFlag[];
  /** Whether add / update modes make sense (true when keyOf is given). */
  commit: (rows: PlannedRow[], opts: { mode: BulkMode; flags: Record<string, boolean>; source: string }, r: BulkReporter) => Promise<void>;
}

const STATUS: Record<RowStatus, { label: string; color: 'success' | 'info' | 'default' | 'error' | 'primary' }> = {
  new: { label: 'New', color: 'success' },
  update: { label: 'Update', color: 'info' },
  ready: { label: 'Ready', color: 'primary' },
  skip: { label: 'Skip', color: 'default' },
  error: { label: 'Error', color: 'error' },
};

const PREVIEW_LIMIT = 300;

export default function BulkImportDialog({ open, onClose, config: liveConfig }: { open: boolean; onClose: () => void; config: BulkImportConfig }) {
  // Freeze the configuration (and the data snapshot it closes over) while the dialog is open,
  // so live updates during an import do not change the preview.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => liveConfig, [open]);
  const { title, fileName, columns, samples, notes, keyOf, existing, checker, flags = [], commit } = config;
  const t = useTheme();
  const mobile = useMediaQuery(t.breakpoints.down('md'));
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [paste, setPaste] = useState('');
  const [source, setSource] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<BulkMode>('upsert');
  const [flagVals, setFlagVals] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'error'>('all');
  const [phase, setPhase] = useState<'input' | 'preview' | 'running' | 'done'>('input');
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<{ row: PlannedRow; message: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('file'); setPaste(''); setSource(''); setParsed(null); setExistingIds(new Set()); setMode('upsert');
    setFlagVals(Object.fromEntries(flags.map((f) => [f.key, !!f.default]))); setFilter('all'); setPhase('input');
    setDone(0); setFailures([]); setErr(null); setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const planned: PlannedRow[] = useMemo(() => {
    if (!parsed) return [];
    const seen = new Map<string, number>();
    const check = checker?.();
    return parsed.rows.map((r) => {
      const id = keyOf ? keyOf(r.values) : null;
      const exists = !!id && existingIds.has(id);
      const base: PlannedRow = { line: r.line, values: r.values, id, exists, status: keyOf ? (exists ? 'update' : 'new') : 'ready' };
      if (r.errors.length) return { ...base, status: 'error', message: r.errors.join('; ') };
      if (keyOf) {
        if (!id) return { ...base, status: 'error', message: `Missing ${columns[0].label}` };
        if (seen.has(id)) return { ...base, status: 'error', message: `Same record as Excel row ${seen.get(id)}` };
        seen.set(id, r.line);
        if (mode === 'add' && exists) return { ...base, status: 'skip', message: 'Already exists (mode: add new only)' };
        if (mode === 'update' && !exists) return { ...base, status: 'skip', message: 'Not found (mode: update existing only)' };
      }
      const m = check?.(r.values, { id, exists });
      if (m) return { ...base, status: 'error', message: m };
      return base;
    });
  }, [parsed, existingIds, mode, keyOf, checker]);

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { new: 0, update: 0, ready: 0, skip: 0, error: 0 };
    planned.forEach((p) => c[p.status]++);
    return c;
  }, [planned]);
  const toWrite = planned.filter((p) => p.status === 'new' || p.status === 'update' || p.status === 'ready');

  const load = async (grid: unknown[][], label: string) => {
    setErr(null);
    const res = parseGrid(grid, columns);
    if (!res.rows.length) return setErr('No data rows found. Keep the header row and put one record per row below it.');
    if (res.missingColumns.length && res.headerFound) return setErr(`Required column(s) missing: ${res.missingColumns.join(', ')}. Download the template to see the expected headers.`);
    setBusy(true);
    try {
      if (keyOf && existing) {
        const ids = Array.from(new Set(res.rows.map((r) => keyOf(r.values)).filter(Boolean) as string[]));
        setExistingIds(await existing(ids));
      }
      setParsed(res); setSource(label); setPhase('preview');
    } catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  };

  const onFile = async (f: File) => {
    try { await load(await readGrid(f), f.name); } catch (e) { setErr(`Could not read ${f.name}: ${errMsg(e)}`); }
  };

  const run = async () => {
    setPhase('running'); setDone(0);
    const fails: { row: PlannedRow; message: string }[] = [];
    try {
      await commit(toWrite, { mode, flags: flagVals, source: source || 'bulk upload' }, {
        progress: (n) => setDone(n),
        fail: (row, message) => { fails.push({ row, message }); },
      });
    } catch (e) {
      fails.push({ row: { line: 0, values: {}, id: null, exists: false, status: 'error' }, message: errMsg(e) });
    }
    setFailures(fails); setDone(toWrite.length); setPhase('done');
  };

  const errorRows = [
    ...planned.filter((p) => p.status === 'error').map((p) => ({ line: p.line, values: p.values, message: p.message ?? '' })),
    ...failures.filter((f) => f.row.line).map((f) => ({ line: f.row.line, values: f.row.values, message: f.message })),
  ];
  const shown = (filter === 'error' ? planned.filter((p) => p.status === 'error' || p.status === 'skip') : planned).slice(0, PREVIEW_LIMIT);
  const previewCols = columns.slice(0, mobile ? 2 : 5);

  return (
    <Dialog open={open} onClose={phase === 'running' ? undefined : onClose} maxWidth="lg" fullWidth fullScreen={mobile}>
      <DialogTitle>Bulk upload — {title}</DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

        {phase === 'input' && (
          <Stack spacing={2}>
            <Alert severity="info" icon={false}>
              <Typography variant="body2" gutterBottom>
                <b>Step 1.</b> Download the template, fill one row per record (or use your own sheet with the same column names).{' '}
                <b>Step 2.</b> Upload it, or copy the rows from Excel / Google Sheets and paste them. <b>Step 3.</b> Check the preview, then import.
              </Typography>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} sx={{ mt: 1 }}
                onClick={() => downloadTemplate(fileName, title, columns, samples, notes)}>Download Excel template</Button>
            </Alert>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Columns <Typography component="span" variant="caption" color="text.secondary">(bold = required)</Typography></Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                {columns.map((c) => (
                  <Tooltip key={c.key} title={[c.help, c.options ? `Allowed: ${c.options.join(', ')}` : '', c.type === 'date' ? 'Date: YYYY-MM-DD or DD-MM-YYYY' : ''].filter(Boolean).join(' · ') || c.label}>
                    <Chip size="small" label={c.label} variant={c.required ? 'filled' : 'outlined'} color={c.required ? 'primary' : 'default'} sx={{ fontWeight: c.required ? 700 : 400 }} />
                  </Tooltip>
                ))}
              </Stack>
              {notes?.map((n) => <Typography key={n} variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>• {n}</Typography>)}
            </Box>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab value="file" icon={<UploadIcon />} iconPosition="start" label="Upload Excel / CSV" />
                <Tab value="paste" icon={<PasteIcon />} iconPosition="start" label="Paste rows" />
              </Tabs>
            </Box>
            {tab === 'file' ? (
              <Box
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
                sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}
              >
                <UploadIcon color="action" sx={{ fontSize: 40 }} />
                <Typography sx={{ mb: 1 }}>Drag an .xlsx, .xls or .csv file here</Typography>
                <Button variant="contained" onClick={() => fileRef.current?.click()} disabled={busy}>Choose file</Button>
                <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv,.ods" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
              </Box>
            ) : (
              <Stack spacing={1}>
                <TextField multiline minRows={8} maxRows={16} value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder={`Select the cells in Excel (include the header row) and press Ctrl+V here.\n\n${columns.map((c) => c.label).join('\t')}`}
                  slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }} />
                <Typography variant="caption" color="text.secondary">Without a header row, the columns are read in the template order: {columns.map((c) => c.label).join(', ')}.</Typography>
                <Box><Button variant="contained" disabled={!paste.trim() || busy} onClick={() => load(parsePasted(paste), 'pasted rows')}>Preview</Button></Box>
              </Stack>
            )}
            {busy && <LinearProgress />}
          </Stack>
        )}

        {phase === 'preview' && parsed && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                <b>{planned.length}</b> row(s) from <b>{source}</b>
                {!parsed.headerFound && ' — no header row found, columns read in template order'}
              </Typography>
              {keyOf && (
                <TextField select size="small" label="Mode" value={mode} onChange={(e) => setMode(e.target.value as BulkMode)} sx={{ minWidth: 260 }}>
                  <MenuItem value="upsert">Add new and update existing</MenuItem>
                  <MenuItem value="add">Add new only (skip existing)</MenuItem>
                  <MenuItem value="update">Update existing only</MenuItem>
                </TextField>
              )}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(Object.keys(STATUS) as RowStatus[]).filter((s) => counts[s]).map((s) => (
                <Chip key={s} color={STATUS[s].color} label={`${STATUS[s].label}: ${counts[s]}`} />
              ))}
            </Stack>
            {parsed.unknownHeaders.length > 0 && (
              <Alert severity="warning">Ignored column(s): {parsed.unknownHeaders.join(', ')}</Alert>
            )}
            {flags.map((f) => (
              <FormControlLabel key={f.key} control={<Checkbox checked={!!flagVals[f.key]} onChange={(e) => setFlagVals((s) => ({ ...s, [f.key]: e.target.checked }))} />}
                label={<><Typography variant="body2">{f.label}</Typography>{f.help && <Typography variant="caption" color="text.secondary">{f.help}</Typography>}</>} />
            ))}
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
                <ToggleButton value="all">All rows</ToggleButton>
                <ToggleButton value="error">Errors & skipped</ToggleButton>
              </ToggleButtonGroup>
              {errorRows.length > 0 && <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadErrorRows(fileName, columns, errorRows)}>Download error rows</Button>}
            </Stack>
            <TableContainer sx={{ maxHeight: 420, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Status</TableCell>
                    {previewCols.map((c) => <TableCell key={c.key}>{c.label}</TableCell>)}
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.line} sx={p.status === 'error' ? { bgcolor: (th) => alpha(th.palette.error.main, 0.06) } : undefined}>
                      <TableCell>{p.line}</TableCell>
                      <TableCell><Chip size="small" color={STATUS[p.status].color} label={STATUS[p.status].label} /></TableCell>
                      {previewCols.map((c) => <TableCell key={c.key} sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.values[c.key]}</TableCell>)}
                      <TableCell sx={{ color: p.status === 'error' ? 'error.main' : 'text.secondary', fontSize: 12 }}>{p.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {(filter === 'all' ? planned.length : counts.error + counts.skip) > PREVIEW_LIMIT && (
              <Typography variant="caption" color="text.secondary">Showing the first {PREVIEW_LIMIT} rows.</Typography>
            )}
            {counts.error > 0 && <Alert severity="warning">Rows with errors are not imported. Fix them in the sheet and upload again, or import the valid rows now.</Alert>}
          </Stack>
        )}

        {(phase === 'running' || phase === 'done') && (
          <Stack spacing={2}>
            <Typography>{phase === 'running' ? 'Importing…' : 'Finished.'} {done} / {toWrite.length}</Typography>
            <LinearProgress variant="determinate" value={toWrite.length ? (100 * done) / toWrite.length : 100} />
            {phase === 'done' && (
              <>
                <Alert severity={failures.length ? 'warning' : 'success'}>
                  {toWrite.length - failures.filter((f) => f.row.line).length} row(s) saved
                  {counts.new ? ` · ${counts.new} new` : ''}{counts.update ? ` · ${counts.update} updated` : ''}
                  {counts.error ? ` · ${counts.error} had errors` : ''}{counts.skip ? ` · ${counts.skip} skipped` : ''}
                  {failures.length ? ` · ${failures.length} failed while saving` : ''}.
                </Alert>
                {failures.slice(0, 20).map((f, i) => (
                  <Typography key={i} variant="body2" color="error">{f.row.line ? `Row ${f.row.line}: ` : ''}{f.message}</Typography>
                ))}
                {errorRows.length > 0 && <Box><Button startIcon={<DownloadIcon />} onClick={() => downloadErrorRows(fileName, columns, errorRows)}>Download rows to fix</Button></Box>}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'preview' && <Button onClick={() => { setPhase('input'); setParsed(null); }}>Back</Button>}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={phase === 'running'}>{phase === 'done' ? 'Close' : 'Cancel'}</Button>
        {phase === 'preview' && (
          <Button variant="contained" disabled={!toWrite.length} onClick={run}>
            Import {toWrite.length} row(s)
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
