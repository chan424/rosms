// Parses the college hospital medicine stock sheet (section header rows such as
// "TABLETS", then "S No | Indent | Quantity" rows; "Nill" = 0). Keep in sync with
// src/modules/stock/medicineSheet.ts
export const CATEGORY_PREFIX = [
  [/tablet|capsule/i, 'TAB'],
  [/ointment|drop|syrup|lotion|cream/i, 'OSD'],
  [/injection|surgical/i, 'INJ'],
];

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s*,\s*/g, ', ').replace(/\s*&\s*/g, ' & ');

export function parseQty(v) {
  if (typeof v === 'number') return { qty: Math.max(0, v), unit: null };
  const s = String(v ?? '').trim().toLowerCase();
  if (!s || /^ni+l+$/.test(s) || s === 'nil' || s === '-') return { qty: 0, unit: null };
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?/);
  if (!m) return { qty: 0, unit: null };
  const unit = m[2] ? titleCase(m[2].replace(/es$|s$/, '')) : null;
  return { qty: Number(m[1]), unit };
}

/** rows: array of arrays (one per sheet row). Returns [{code, name, category, qty, unit}] */
export function parseMedicineRows(rows) {
  const out = [];
  let category = 'General';
  let prefix = 'MED';
  const counters = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map((c) => (typeof c === 'string' ? c.trim() : c));
    const cells = r.filter((c) => c !== '' && c !== null && c !== undefined);
    if (!cells.length) continue;
    const isHeaderRow = r.some((c) => typeof c === 'string' && /^indent$/i.test(c));
    if (isHeaderRow) continue;
    const first = r[0];
    const name = typeof r[1] === 'string' ? r[1] : String(r[1] ?? '');
    if ((typeof first === 'number' || /^\d+$/.test(String(first))) && name.trim()) {
      const { qty, unit } = parseQty(r[2]);
      counters[prefix] = (counters[prefix] || 0) + 1;
      out.push({ code: `${prefix}-${String(counters[prefix]).padStart(3, '0')}`, name: name.replace(/\s+/g, ' ').trim(), category, qty, unit: unit || (prefix === 'TAB' ? 'Tablet' : 'Nos') });
      continue;
    }
    // A row with a single text cell (and the next non-empty row being a header) is a section title.
    const text = cells.find((c) => typeof c === 'string' && /[a-z]/i.test(c));
    if (text && cells.length <= 2) {
      category = titleCase(text);
      prefix = (CATEGORY_PREFIX.find(([re]) => re.test(text)) || [null, text.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'MED'])[1];
    }
  }
  return out;
}
