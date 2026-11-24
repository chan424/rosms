#!/usr/bin/env node
/**
 * Loads the college hospital's current medicine stock into ROSMS as OPENING STOCK.
 *
 *   cd scripts && npm install
 *   node seed-hospital-stock.mjs --key ./serviceAccount.json                      # uses data/hospital-opening-stock.json
 *   node seed-hospital-stock.mjs --key ./serviceAccount.json --xlsx ./medicine-stock.xlsx
 *   add --dry-run to preview, --force to overwrite quantities of items that already exist
 *
 * Each medicine becomes stock/hospital/items/{code} with category, name, unit and quantity
 * (held in an "OPENING" batch with no expiry), plus an "in" ledger entry "Opening stock".
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { arg, initAdmin } from './lib.mjs';
import { parseMedicineRows } from './medicine-sheet.mjs';

const dry = !!arg('dry-run', false);
const force = !!arg('force', false);
const xlsxPath = arg('xlsx');
const jsonPath = arg('json', new URL('./data/hospital-opening-stock.json', import.meta.url).pathname);

let items;
if (xlsxPath && xlsxPath !== true) {
  const require = createRequire(import.meta.url);
  let XLSX;
  try { XLSX = require('xlsx'); } catch { console.error('Install xlsx first: npm install xlsx'); process.exit(1); }
  const wb = XLSX.readFile(xlsxPath);
  items = wb.SheetNames.flatMap((n) => (wb.Sheets[n] ? parseMedicineRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })) : []));
} else {
  if (!existsSync(jsonPath)) { console.error(`Not found: ${jsonPath}`); process.exit(1); }
  items = JSON.parse(readFileSync(jsonPath, 'utf8')).items;
}

const project = initAdmin();
const db = getFirestore();
console.log(`Project: ${project}${dry ? '  (DRY RUN)' : ''} — ${items.length} medicines/items`);

const col = db.collection('stock/hospital/items');
const txns = db.collection('stock/hospital/txns');
let created = 0, updated = 0, skipped = 0;
let batch = db.batch(), ops = 0;
const flush = async () => { if (ops && !dry) await batch.commit(); batch = db.batch(); ops = 0; };

for (const it of items) {
  const ref = col.doc(it.code);
  const snap = dry ? { exists: false } : await ref.get();
  if (snap.exists && !force) { skipped++; continue; }
  const batches = it.qty > 0 ? [{ batchNo: 'OPENING', expiry: '', qty: it.qty }] : [];
  batch.set(ref, {
    code: it.code, name: it.name, category: it.category, unit: it.unit, quantity: it.qty, batches,
    minLevel: it.unit === 'Tablet' ? 50 : 2, location: 'Dispensary', unitPrice: 0, description: '',
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(txns.doc(), {
    type: 'in', itemId: it.code, itemCode: it.code, itemName: it.name, unit: it.unit, qty: it.qty, balanceAfter: it.qty,
    batchNo: it.qty > 0 ? 'OPENING' : '', expiry: '', reference: 'Opening stock sheet', party: 'Opening balance',
    remarks: snap.exists ? 'Opening stock (re-imported with --force)' : 'Opening stock', at: FieldValue.serverTimestamp(), by: 'seed-script',
  });
  ops += 2;
  snap.exists ? updated++ : created++;
  console.log(`  ${it.code.padEnd(8)} ${String(it.qty).padStart(6)} ${it.unit.padEnd(7)} ${it.name}`);
  if (ops >= 400) await flush();
}
await flush();
console.log(`\nCreated ${created}, overwritten ${updated}, skipped (already exist) ${skipped}.`);
