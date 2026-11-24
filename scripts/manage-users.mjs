#!/usr/bin/env node
/**
 * ROSMS user maintenance (things the free Firebase plan cannot do from the browser).
 *
 *   node manage-users.mjs --key ./serviceAccount.json reset   <username>   # new random temp password, printed once
 *   node manage-users.mjs --key ./serviceAccount.json disable <username>
 *   node manage-users.mjs --key ./serviceAccount.json enable  <username>
 *   node manage-users.mjs --key ./serviceAccount.json delete  <username>
 *   node manage-users.mjs --key ./serviceAccount.json list
 */
import { randomInt } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initAdmin, usernameToEmail } from './lib.mjs';

const args = process.argv.slice(2).filter((a, i, all) => a !== '--key' && all[i - 1] !== '--key');
const [cmd, username] = args;
initAdmin();
const auth = getAuth();
const db = getFirestore();

const genPassword = (n = 12) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
  let p = '';
  for (let i = 0; i < n; i++) p += chars[randomInt(chars.length)];
  return /\d/.test(p) ? p : p.slice(0, -1) + '7';
};

if (cmd === 'list') {
  const snap = await db.collection('users').get();
  snap.docs.map((d) => d.data()).sort((a, b) => a.email.localeCompare(b.email))
    .forEach((u) => console.log(`${(u.username || u.email).padEnd(36)} ${String(u.role).padEnd(12)} ${(u.modules || []).join(',').padEnd(30)} ${u.disabled ? 'DISABLED' : ''} ${u.mustChangePassword ? '(first login pending)' : ''}`));
  process.exit(0);
}
if (!cmd || !username) {
  console.error('Usage: node manage-users.mjs --key <sa.json> <reset|disable|enable|delete|list> <username>');
  process.exit(1);
}
const user = await auth.getUserByEmail(usernameToEmail(username));
const ref = db.collection('users').doc(user.uid);

if (cmd === 'reset') {
  const pw = genPassword();
  await auth.updateUser(user.uid, { password: pw, disabled: false });
  await ref.set({ mustChangePassword: true, disabled: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await auth.revokeRefreshTokens(user.uid);
  console.log(`New temporary password for ${username}: ${pw}\n(Shown once. The user must change it at next login.)`);
} else if (cmd === 'disable' || cmd === 'enable') {
  const disabled = cmd === 'disable';
  await auth.updateUser(user.uid, { disabled });
  await ref.set({ disabled, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (disabled) await auth.revokeRefreshTokens(user.uid);
  console.log(`${username} ${disabled ? 'disabled' : 'enabled'}.`);
} else if (cmd === 'delete') {
  await auth.deleteUser(user.uid);
  await ref.delete();
  console.log(`${username} deleted.`);
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
