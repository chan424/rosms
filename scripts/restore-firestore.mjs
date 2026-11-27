#!/usr/bin/env node
/**
 * Restores a backup made by backup-firestore.mjs into a Firestore database.
 *
 *   cd scripts && npm install
 *   node restore-firestore.mjs --key ./serviceAccount.json --file ./firestore-YYYY-MM-DD.json            # preview only
 *   node restore-firestore.mjs --key ./serviceAccount.json --file ./firestore-YYYY-MM-DD.json --apply    # write
 *
 * Options:
 *   --only users,stock    restore only these top-level collections (comma separated)
 *   --apply               actually write (without it nothing is changed)
 * Every document in the file is written back with its exact path and data (overwriting the current version).
 * Documents created AFTER the backup are left untouched.
 */
import { readFileSync } from 'node:fs';
import { getFirestore, Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { arg, initAdmin } from './lib.mjs';

const file = arg('file');
if (!file || file === true) { console.error('Pass --file <firestore-backup.json>'); process.exit(1); }
const apply = !!arg('apply', false);
const only = typeof arg('only') === 'string' ? arg('only').split(',').map((s) => s.trim()).filter(Boolean) : null;

const projectId = initAdmin();
const db = getFirestore();

function decode(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(decode);
  if (typeof v === 'object') {
    switch (v.__type) {
      case 'timestamp': return new Timestamp(v.seconds, v.nanoseconds);
      case 'geopoint': return new GeoPoint(v.latitude, v.longitude);
      case 'ref': return db.doc(v.path);
      case 'bytes': return Buffer.from(v.base64, 'base64');
      default: return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
    }
  }
  return v;
}

const dump = JSON.parse(readFileSync(file, 'utf8'));
if (dump.format !== 'rosms-firestore-backup/1') { console.error('Not a ROSMS backup file.'); process.exit(1); }
const docs = dump.docs.filter((d) => !only || only.includes(d.path.split('/')[0]));
console.log(`Backup from project ${dump.projectId}, taken ${dump.exportedAt}: ${dump.documentCount} documents.`);
console.log(`Target project: ${projectId}. Documents to restore: ${docs.length}${only ? ` (only ${only.join(', ')})` : ''}.`);
if (!apply) { console.log('\nPreview only. Re-run with --apply to write.'); process.exit(0); }

const writer = db.bulkWriter();
let done = 0;
for (const d of docs) {
  writer.set(db.doc(d.path), decode(d.data)).then(() => { done++; if (done % 500 === 0) console.log(`  ${done} / ${docs.length}`); });
}
await writer.close();
console.log(`Restored ${done} documents.`);
process.exit(0);
