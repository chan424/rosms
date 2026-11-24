// Parser for the college hospital medicine stock sheet. Keep in sync with scripts/medicine-sheet.mjs
export interface MedicineRow { code: string; name: string; category: string; qty: number; unit: string }

const CATEGORY_PREFIX: [RegExp, string][] = [
  [/tablet|capsule/i, 'TAB'],
  [/ointment|drop|syrup|lotion|cream/i, 'OSD'],
  [/injection|surgical/i, 'INJ'],
];

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s*,\s*/g, ', ').replace(/\s*&\s*/g, ' & ');

export function parseQty(v: unknown): { qty: number; unit: string | null } {
  if (typeof v === 'number') return { qty: Math.max(0, v), unit: null };
  const s = String(v ?? '').trim().toLowerCase();
  if (!s || /^ni+l+$/.test(s) || s === 'nil' || s === '-') return { qty: 0, unit: null };
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/);
  if (!m) return { qty: 0, unit: null };
  return { qty: Number(m[1]), unit: m[2] ? titleCase(m[2].replace(/es$|s$/, '')) : null };
}

export function parseMedicineRows(rows: unknown[][]): MedicineRow[] {
  const out: MedicineRow[] = [];
  let category = 'General';
  let prefix = 'MED';
  const counters: Record<string, number> = {};
  for (const raw of rows) {
    const r = raw.map((c) => (typeof c === 'string' ? c.trim() : c));
    const cells = r.filter((c) => c !== '' && c !== null && c !== undefined);
    if (!cells.length) continue;
    if (r.some((c) => typeof c === 'string' && /^indent$/i.test(c))) continue;
    const first = r[0];
    const name = typeof r[1] === 'string' ? r[1] : String(r[1] ?? '');
    if ((typeof first === 'number' || /^\d+$/.test(String(first))) && name.trim()) {
      const { qty, unit } = parseQty(r[2]);
      counters[prefix] = (counters[prefix] || 0) + 1;
      out.push({ code: `${prefix}-${String(counters[prefix]).padStart(3, '0')}`, name: name.replace(/\s+/g, ' ').trim(), category, qty, unit: unit || (prefix === 'TAB' ? 'Tablet' : 'Nos') });
      continue;
    }
    const text = cells.find((c) => typeof c === 'string' && /[a-z]/i.test(c)) as string | undefined;
    if (text && cells.length <= 2) {
      category = titleCase(text);
      prefix = CATEGORY_PREFIX.find(([re]) => re.test(text))?.[1] ?? (text.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'MED');
    }
  }
  return out;
}

/** Reads every sheet of a workbook as rows of cells. */
export async function readWorkbookRows(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer());
  return wb.SheetNames.flatMap((n) => (wb.Sheets[n] ? XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '' }) : []));
}
