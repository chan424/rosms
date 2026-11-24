/**
 * Bulk upload helpers shared by every module: column specs, Excel/CSV/paste parsing,
 * per-cell validation and downloadable templates.
 */

export type BulkColType = 'text' | 'number' | 'int' | 'date' | 'email' | 'enum' | 'yesno';

export interface BulkColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: BulkColType;
  /** Allowed values for 'enum' (matched case-insensitively, stored in this spelling). */
  options?: string[];
  /** Other header spellings that map to this column. */
  aliases?: string[];
  /** Suggested values: matched case-insensitively but any other value is still accepted. */
  suggestions?: string[];
  min?: number;
  help?: string;
}

export type BulkValues = Record<string, string>;

export interface ParsedRow {
  /** Row number as the user sees it in Excel (header = row 1). */
  line: number;
  values: BulkValues;
  errors: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  headerFound: boolean;
  unknownHeaders: string[];
  missingColumns: string[];
}

export const normHeader = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Accepts 2026-03-31, 31-03-2026, 31/03/2026, 31.03.26, Excel serials and Date objects. Returns YYYY-MM-DD or null. */
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return isoDate(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial date (1900 system)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, +m[2], +m[1]); }
  m = s.match(/^(\d{1,2})[-/.\s]([A-Za-z]{3,})[-/.\s,]*(\d{2,4})$/);
  if (m) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    let y = +m[3]; if (y < 100) y += 2000;
    if (mon) return valid(y, mon, +m[1]);
  }
  m = s.match(/^([A-Za-z]{3,})[-/.\s]+(\d{2,4})$/); // "Mar 2027" / "MAR-27" (expiry style): last day of month
  if (m) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    let y = +m[2]; if (y < 100) y += 2000;
    if (mon) return valid(y, mon, new Date(y, mon, 0).getDate());
  }
  return null;
  function valid(y: number, mo: number, d: number) {
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? isoDate(dt) : null;
  }
}

const YES = ['yes', 'y', 'true', '1', 'active'];
const NO = ['no', 'n', 'false', '0', 'inactive'];

function cellText(v: unknown) {
  if (v instanceof Date) return isoDate(v);
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/** Normalises and validates one raw cell. Returns [value, error]. */
export function coerceCell(col: BulkColumn, raw: unknown): [string, string | null] {
  const t = col.type ?? 'text';
  if (t === 'date') {
    if (raw === '' || raw === null || raw === undefined) return ['', col.required ? `${col.label} is required` : null];
    const d = parseDate(raw);
    return d ? [d, null] : [cellText(raw), `${col.label}: “${cellText(raw)}” is not a date (use YYYY-MM-DD or DD-MM-YYYY)`];
  }
  const s = cellText(raw);
  if (!s) return ['', col.required ? `${col.label} is required` : null];
  if (t === 'number' || t === 'int') {
    const n = Number(s.replace(/[,₹\s]/g, '').replace(/^rs\.?/i, ''));
    if (isNaN(n)) return [s, `${col.label}: “${s}” is not a number`];
    if (t === 'int' && !Number.isInteger(n)) return [s, `${col.label} must be a whole number`];
    if (col.min !== undefined && n < col.min) return [s, `${col.label} must be at least ${col.min}`];
    return [String(n), null];
  }
  if (t === 'email') {
    const e = s.toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? [e, null] : [s, `${col.label}: “${s}” is not a valid email`];
  }
  if (t === 'enum') {
    const hit = (col.options ?? []).find((o) => normHeader(o) === normHeader(s));
    return hit ? [hit, null] : [s, `${col.label}: “${s}” is not one of ${(col.options ?? []).join(', ')}`];
  }
  if (t === 'yesno') {
    if (YES.includes(s.toLowerCase())) return ['Yes', null];
    if (NO.includes(s.toLowerCase())) return ['No', null];
    return [s, `${col.label} must be Yes or No`];
  }
  if (col.suggestions) {
    const hit = col.suggestions.find((o) => normHeader(o) === normHeader(s));
    if (hit) return [hit, null];
  }
  return [s, null];
}

function headerIndex(cols: BulkColumn[]) {
  const map = new Map<string, string>();
  for (const c of cols) {
    map.set(normHeader(c.label), c.key);
    map.set(normHeader(c.key), c.key);
    for (const a of c.aliases ?? []) map.set(normHeader(a), c.key);
  }
  return map;
}

const blank = (r: unknown[]) => r.every((c) => cellText(c) === '');

/**
 * Turns a grid of cells (first sheet, or pasted text) into validated rows.
 * The header row is detected in the first 10 rows; if none is found the columns are
 * assumed to be in template order (handy when pasting rows without headers).
 */
export function parseGrid(grid: unknown[][], cols: BulkColumn[]): ParseResult {
  const idx = headerIndex(cols);
  let headerRow = -1;
  let best = 0;
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const hits = (grid[r] ?? []).filter((c) => idx.has(normHeader(c))).length;
    if (hits > best) { best = hits; headerRow = r; }
  }
  const minHits = Math.min(2, cols.filter((c) => c.required).length || 1);
  const headerFound = headerRow >= 0 && best >= minHits;
  let colKeys: (string | null)[];
  const unknownHeaders: string[] = [];
  if (headerFound) {
    colKeys = (grid[headerRow] ?? []).map((h) => {
      const k = idx.get(normHeader(h)) ?? null;
      if (!k && cellText(h)) unknownHeaders.push(cellText(h));
      return k;
    });
  } else {
    colKeys = cols.map((c) => c.key);
  }
  const present = new Set(colKeys.filter(Boolean) as string[]);
  const missingColumns = cols.filter((c) => c.required && !present.has(c.key)).map((c) => c.label);
  const start = headerFound ? headerRow + 1 : 0;
  const rows: ParsedRow[] = [];
  for (let r = start; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    if (blank(cells)) continue;
    const raw: Record<string, unknown> = {};
    colKeys.forEach((k, i) => { if (k && raw[k] === undefined) raw[k] = cells[i]; });
    // Skip the template's example/instruction rows if someone left them in.
    if (Object.values(raw).some((v) => /^\s*(e\.g\.|example)/i.test(String(v ?? '')))) continue;
    const values: BulkValues = {};
    const errors: string[] = [];
    for (const c of cols) {
      const [v, e] = coerceCell(c, raw[c.key]);
      values[c.key] = v;
      if (e) errors.push(e);
    }
    rows.push({ line: r + 1, values, errors });
  }
  return { rows, headerFound, unknownHeaders, missingColumns };
}

/** Reads the first non-empty sheet of an .xlsx / .xls / .csv / .ods file as a grid of cells. */
export async function readGrid(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  for (const n of wb.SheetNames) {
    if (/^(instructions?|help|readme)$/i.test(n.trim())) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '', raw: true });
    if (grid.some((r) => !blank(r))) return grid;
  }
  return [];
}

/** Parses text copied from Excel / Google Sheets (tab-separated) or CSV. */
export function parsePasted(text: string): unknown[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const tabbed = lines.some((l) => l.includes('\t'));
  if (tabbed) return lines.map((l) => l.split('\t').map((c) => c.replace(/^"(.*)"$/s, '$1').trim()));
  // Minimal CSV parser with quoted fields.
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell.trim());
  out.push(row);
  return out;
}

const describe = (c: BulkColumn) => {
  const t = c.type ?? 'text';
  if (t === 'enum') return `One of: ${(c.options ?? []).join(', ')}`;
  if (t === 'yesno') return 'Yes or No';
  if (t === 'date') return 'Date (YYYY-MM-DD or DD-MM-YYYY)';
  if (t === 'int') return `Whole number${c.min !== undefined ? ` ≥ ${c.min}` : ''}`;
  if (t === 'number') return `Number${c.min !== undefined ? ` ≥ ${c.min}` : ''}`;
  if (t === 'email') return 'Email address';
  return c.suggestions ? `Text (usual: ${c.suggestions.slice(0, 8).join(', ')}${c.suggestions.length > 8 ? '…' : ''})` : 'Text';
};

/**
 * Downloads an .xlsx template: a "Data" sheet with just the header row (ready to fill), and an
 * "Instructions" sheet that explains each column and shows sample rows.
 */
export async function downloadTemplate(fileName: string, title: string, cols: BulkColumn[], samples: Record<string, string | number>[], notes: string[] = []) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c.label)]);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, c.label.length + 3) }));
  const help: (string | number)[][] = [
    [`ROSMS — ${title} upload template`],
    ['Fill the "Data" sheet: one row per record under the header row. Columns can be in any order; extra columns are ignored.'],
    ['You can also copy the rows (with the header) and paste them into ROSMS → Bulk upload → Paste.'],
    ...notes.map((n) => [n]),
    [],
    ['Column', 'Required?', 'Format / allowed values', 'Notes'],
    ...cols.map((c) => [c.label, c.required ? 'Required' : 'Optional', describe(c), c.help ?? '']),
    [],
    ['Example rows (for reference only; this sheet is never imported):'],
    cols.map((c) => c.label),
    ...samples.map((s) => cols.map((c) => s[c.key] ?? '')),
  ];
  const hs = XLSX.utils.aoa_to_sheet(help);
  hs['!cols'] = cols.map((_, i) => ({ wch: [24, 11, 48, 60][i] ?? 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.utils.book_append_sheet(wb, hs, 'Instructions');
  XLSX.writeFile(wb, `${fileName}-template.xlsx`);
}

/** Downloads the rows that failed, with an "Error" column, so they can be fixed and re-uploaded. */
export async function downloadErrorRows(fileName: string, cols: BulkColumn[], rows: { line: number; values: BulkValues; message: string }[]) {
  const XLSX = await import('xlsx');
  const data = [['Excel row', ...cols.map((c) => c.label), 'Error'], ...rows.map((r) => [r.line, ...cols.map((c) => r.values[c.key] ?? ''), r.message])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  XLSX.writeFile(wb, `${fileName}-errors.xlsx`);
}

export const num = (s: string | undefined, d = 0) => (s === undefined || s === '' || isNaN(Number(s)) ? d : Number(s));

/** Runs async work over items in chunks, reporting progress. */
export async function inChunks<T>(items: T[], size: number, work: (chunk: T[]) => Promise<void>, progress?: (done: number) => void) {
  for (let i = 0; i < items.length; i += size) {
    await work(items.slice(i, i + size));
    progress?.(Math.min(items.length, i + size));
  }
}
