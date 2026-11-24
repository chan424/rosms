#!/usr/bin/env node
/**
 * ROSMS seed script — creates staff username logins, their role documents,
 * the module owner documents and default library settings.
 *
 * Usage (run on YOUR computer, never commit the CSV or the key):
 *   cd scripts && npm install
 *   node seed-users.mjs --key ./serviceAccount.json --csv ./users.csv [--dry-run] [--reset-passwords] [--reset-owners]
 *   then: node seed-hospital-stock.mjs --key ./serviceAccount.json   (hospital opening stock)
 *
 * CSV columns: Role,Username,Module,Assigned to,Password
 *   - Existing accounts keep their current password unless --reset-passwords is given.
 *   - New accounts (and reset ones) must change password at first login.
 *   - Passwords are never printed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { arg, initAdmin, parseCsv, usernameToEmail } from './lib.mjs';

// Keep in sync with src/config/modules.ts
const OWNER_LOGIN_MODULE = {
  'hod.library': 'library', 'coord.hospital': 'hospital', 'coord.central': 'central',
  'hod.cse': 'cse', 'hod.ece': 'ece', 'hod.eee': 'eee', 'hod.me': 'me', 'hod.ce': 'ce',
  'coord.civilworks': 'civilworks', 'coord.electricalworks': 'electricalworks', 'coord.mechworks': 'mechworks',
  'coord.itinfra': 'itinfra', 'coord.fo': 'fo', 'coord.dsw': 'dsw', 'coord.ebs': 'ebs', 'coord.outpass': 'outpass',
};
const D = '@rguktong.ac.in';
const MODULES = {
  library: ['Library Management', ['hodlib' + D]],
  hospital: ['Hospital Stock', []],
  central: ['Central Stock', []],
  cse: ['CSE Stock Management', ['hodcse' + D]],
  ece: ['ECE Stock Management', ['hodece' + D]],
  eee: ['EEE Stock Management', ['hodeee' + D]],
  me: ['ME Stock Management', ['hodmech' + D]],
  ce: ['CE Stock Management', ['hodcivil' + D]],
  civilworks: ['Civil Works Stock Management', ['cw_coord' + D]],
  electricalworks: ['Electrical Works Stock Management', ['ew_coord' + D]],
  mechworks: ['Mechanical Works Stock Management', ['mw_coord' + D]],
  itinfra: ['IT Infra Stock Management', ['itinfra' + D]],
  fo: ['FO Stock Management', ['fo' + D]],
  dsw: ['DSW Stock Management', ['dsw' + D]],
  ebs: ['EBS Stock Management', ['ebs' + D]],
  outpass: ['Student Campus Status & Outpass', []],
};

const roleOf = (r, username) => {
  const s = r.toLowerCase();
  if (s.startsWith('warden')) return 'warden';
  if (s.startsWith('caretaker')) return 'caretaker';
  if (s.startsWith('doctor')) return 'doctor';
  if (s.startsWith('medicine') || s.startsWith('pharmac')) return 'medassistant';
  if (s.startsWith('hod')) return 'hod';
  if (s.startsWith('coord')) return 'coordinator';
  if (username.startsWith('hod.')) return 'hod';
  if (username.startsWith('coord.')) return 'coordinator';
  return 'staff';
};

const csvPath = arg('csv', './users.csv');
const dry = !!arg('dry-run', false);
const resetPw = !!arg('reset-passwords', false);
const resetOwners = !!arg('reset-owners', false);

if (!existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}\nExpected columns: Role,Username,Module,Assigned to,Password`);
  process.exit(1);
}
const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const project = initAdmin();
const auth = getAuth();
const db = getFirestore();
console.log(`Project: ${project}${dry ? '  (DRY RUN — no changes)' : ''}`);
console.log(`Rows in CSV: ${rows.length}`);

const stats = { created: 0, updated: 0, passwordReset: 0, skipped: 0, errors: 0 };

for (const r of rows) {
  const username = (r.Username || '').trim().toLowerCase();
  const password = r.Password || '';
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) { console.warn(`  skip: invalid username "${r.Username}"`); stats.skipped++; continue; }
  const email = usernameToEmail(username);
  const role = roleOf(r.Role || '', username);
  const modules = OWNER_LOGIN_MODULE[username] ? [OWNER_LOGIN_MODULE[username]]
    : role === 'warden' || role === 'caretaker' ? ['outpass']
    : role === 'doctor' || role === 'medassistant' || username.startsWith('hosp.') ? ['hospital'] : [];
  const assigned = (r['Assigned to'] || '').trim();
  const assignedTo = /^\(.*\)$/.test(assigned) ? '' : assigned;

  try {
    let user = null;
    try { user = await auth.getUserByEmail(email); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
    let isNew = false;
    if (!user) {
      if (password.length < 8) { console.warn(`  skip ${username}: password missing/too short in CSV`); stats.skipped++; continue; }
      if (!dry) user = await auth.createUser({ email, password, displayName: username, emailVerified: false, disabled: false });
      isNew = true;
      stats.created++;
    } else if (resetPw && password.length >= 8) {
      if (!dry) await auth.updateUser(user.uid, { password });
      stats.passwordReset++;
    } else stats.updated++;

    if (!dry) {
      const ref = db.collection('users').doc(user.uid);
      const snap = await ref.get();
      const base = { email, username, role, assignedTo, updatedAt: FieldValue.serverTimestamp() };
      if (!snap.exists) {
        await ref.set({ ...base, modules, disabled: false, mustChangePassword: true, createdAt: FieldValue.serverTimestamp() });
      } else {
        // Keep admin-made module assignments; only add the default module.
        const cur = snap.data();
        const merged = Array.from(new Set([...(cur.modules || []), ...modules]));
        await ref.set({ ...base, modules: merged, ...(isNew || (resetPw && password.length >= 8) ? { mustChangePassword: true } : {}) }, { merge: true });
      }
    }
    console.log(`  ${isNew ? 'created' : 'ok     '} ${username.padEnd(24)} ${role.padEnd(12)} ${modules.join(',')}`);
  } catch (e) {
    stats.errors++;
    console.error(`  ERROR ${username}: ${e.message}`);
  }
}

// Module owner documents
for (const [id, [name, owners]] of Object.entries(MODULES)) {
  const ref = db.collection('modules').doc(id);
  if (dry) { console.log(`  module ${id}: owners ${owners.join(', ') || '(assign in app)'}`); continue; }
  const snap = await ref.get();
  if (!snap.exists || resetOwners) await ref.set({ name, owners, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  else await ref.set({ name }, { merge: true });
}
// Default library rules
if (!dry) {
  const s = db.collection('library_settings').doc('config');
  if (!(await s.get()).exists) {
    await s.set({ loanDaysStudent: 14, loanDaysFaculty: 30, loanDaysStaff: 30, maxBooksStudent: 3, maxBooksFaculty: 10, maxBooksStaff: 5, finePerDay: 1, maxRenewals: 2 });
  }
}

console.log('\nSummary:', stats);
console.log('Done. Hand each person their username and password privately; they must change it at first login.');
