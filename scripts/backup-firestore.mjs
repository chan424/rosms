#!/usr/bin/env node
/**
 * Exports the WHOLE ROSMS Firestore database (every collection and sub-collection) to one JSON file.
 * Used by .github/workflows/daily-backup.yml; can also be run by the owner on their own computer.
 *
 *   cd scripts && npm install
 *   node backup-firestore.mjs --key ./serviceAccount.json --out ./firestore-backup.json
 *
 * Special Firestore values are tagged so restore-firestore.mjs can rebuild them exactly:
 *   { "__type": "timestamp", "seconds": 1, "nanoseconds": 0 }   { "__type": "ref", "path": "users/abc" }
 *   { "__type": "geopoint", "latitude": 0, "longitude": 0 }     { "__type": "bytes", "base64": "..." }
 * The file never contains passwords: Firebase Auth accounts live outside Firestore.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { arg, initAdmin } from './lib.mjs';

const out = arg('out', 'firestore-backup.json');
const projectId = initAdmin();
const db = getFirestore();

function encode(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return { __type: 'timestamp', seconds: v.seconds, nanoseconds: v.nanoseconds };
  if (v instanceof GeoPoint) return { __type: 'geopoint', latitude: v.latitude, longitude: v.longitude };
  if (v instanceof DocumentReference) return { __type: 'ref', path: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(encode);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  return v;
}

const docs = [];
const counts = {};

async function walkCollection(col) {
  // listDocuments() also returns "missing" parents that only hold sub-collections (e.g. stock/{module}).
  const refs = await col.listDocuments();
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = refs.slice(i, i + 300);
    const snaps = chunk.length ? await db.getAll(...chunk) : [];
    for (const s of snaps) {
      if (s.exists) {
        docs.push({ path: s.ref.path, data: encode(s.data()) });
        const key = col.path.split('/').map((seg, i) => (i % 2 ? '*' : seg)).join('/');
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    for (const ref of chunk) {
      for (const sub of await ref.listCollections()) await walkCollection(sub);
    }
  }
}

const started = Date.now();
const roots = await db.listCollections();
for (const c of roots) await walkCollection(c);

const dump = {
  format: 'rosms-firestore-backup/1',
  projectId,
  exportedAt: new Date().toISOString(),
  documentCount: docs.length,
  collections: counts,
  docs,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dump));
console.log(`Exported ${docs.length} documents from ${roots.length} top-level collections in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${out}`);
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k}: ${n}`);
process.exit(0);
