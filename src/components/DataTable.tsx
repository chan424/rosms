import {
  Box, Button, InputAdornment, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, TextField, Typography, LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import { useMemo, useState, type ReactNode } from 'react';
import { exportExcel, exportPdf } from '../lib/exporters';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Plain value for search, sort and export. Defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  noExport?: boolean;
  hideOnMobile?: boolean;
}

export default function DataTable<T extends { id: string }>({ rows, columns, loading, title, exportName, toolbar, searchPlaceholder = 'Search…', emptyText = 'No records yet.', dense, initialSort }: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  title?: string;
  exportName?: string;
  toolbar?: ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  dense?: boolean;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : ((r as unknown as Record<string, unknown>)[c.key] as string | number | null | undefined));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = s ? rows.filter((r) => columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(s))) : rows;
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) {
        out = [...out].sort((a, b) => {
          const va = val(c, a) ?? '';
          const vb = val(c, b) ?? '';
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const expCols = columns.filter((c) => !c.noExport).map((c) => ({ label: c.label, value: (r: T) => val(c, r) }));

  return (
    <Paper variant="outlined">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ p: 2 }} alignItems={{ md: 'center' }}>
        {title && <Typography variant="h6" sx={{ flexGrow: 1 }}>{title}</Typography>}
        <TextField
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          sx={{ maxWidth: { md: 320 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {!title && <Box sx={{ flexGrow: 1 }} />}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {toolbar}
          {exportName && (
            <>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setAnchor(e.currentTarget)}>Export</Button>
              <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); exportExcel(exportName, expCols, filtered); }}>Excel (.xlsx)</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); exportPdf(exportName, title ?? exportName, expCols, filtered); }}>PDF</MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Stack>
      {loading && <LinearProgress />}
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align} sx={c.hideOnMobile ? { display: { xs: 'none', md: 'table-cell' } } : undefined}>
                  <TableSortLabel
                    active={sort?.key === c.key}
                    direction={sort?.key === c.key ? sort.dir : 'asc'}
                    onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    {c.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.slice(page * rpp, page * rpp + rpp).map((r) => (
              <TableRow key={r.id} hover>
                {columns.map((c) => (
                  <TableCell key={c.key} align={c.align} sx={c.hideOnMobile ? { display: { xs: 'none', md: 'table-cell' } } : undefined}>
                    {c.render ? c.render(r) : String(val(c, r) ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {q ? 'No matching records.' : emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rpp}
        onRowsPerPageChange={(e) => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
}
