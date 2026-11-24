// Shared helpers for ROSMS admin scripts.
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';

export const STAFF_DOMAIN = 'rosms.local';
export const usernameToEmail = (u) => `${u.trim().toLowerCase()}@${STAFF_DOMAIN}`;

/** Minimal RFC-4180 CSV parser (handles quotes and commas inside quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/** Initialise firebase-admin with --key <service-account.json> or GOOGLE_APPLICATION_CREDENTIALS. */
export function initAdmin() {
  const key = arg('key') || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (key && key !== true && existsSync(key)) {
    const sa = JSON.parse(readFileSync(key, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
    return sa.project_id;
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const projectId = arg('project') || 'demo-rosms';
    initializeApp({ projectId });
    return projectId;
  }
  initializeApp({ credential: applicationDefault() });
  return '(application default)';
}
