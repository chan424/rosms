import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-rosms', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 } });
const G = (email) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const P = (u) => ({ email: `${u}@rosms.local`, firebase: { sign_in_provider: 'password' } });

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'modules/cse'), { owners: ['hodcse@rguktong.ac.in'] });
  await setDoc(doc(db, 'modules/central'), { owners: [] });
  await setDoc(doc(db, 'modules/library'), { owners: ['hodlib@rguktong.ac.in'] });
  await setDoc(doc(db, 'modules/outpass'), { owners: [] });
  await setDoc(doc(db, 'users/hodcseStaff'), { email: 'hod.cse@rosms.local', role: 'hod', modules: ['cse'], disabled: false, mustChangePassword: true });
  await setDoc(doc(db, 'users/central1'), { email: 'coord.central@rosms.local', role: 'coordinator', modules: ['central'], disabled: false, mustChangePassword: false });
  await setDoc(doc(db, 'users/warden1'), { email: 'warden01@rosms.local', role: 'warden', modules: ['outpass'], disabled: false, mustChangePassword: false });
  await setDoc(doc(db, 'users/hodcseG'), { email: 'hodcse@rguktong.ac.in', role: 'faculty', modules: [], disabled: false, mustChangePassword: false });
  await setDoc(doc(db, 'users/stu1'), { email: 'o234747@rguktong.ac.in', role: 'student', modules: [], disabled: false, mustChangePassword: false });
  await setDoc(doc(db, 'users/dis'), { email: 'staff05@rosms.local', role: 'staff', modules: ['cse'], disabled: true, mustChangePassword: false });
  await setDoc(doc(db, 'stock/cse/items/PEN'), { code: 'PEN', name: 'Pen', unit: 'Nos', quantity: 10, minLevel: 1 });
  await setDoc(doc(db, 'library_books/A1'), { accessionNo: 'A1', title: 'X', copies: 1, available: 1 });
  await setDoc(doc(db, 'outpasses/op1'), { studentEmail: 'o234747@rguktong.ac.in', status: 'out', issuedAt: Timestamp.now() });
  await setDoc(doc(db, 'outpasses/op2'), { studentEmail: 'o111111@rguktong.ac.in', status: 'out', issuedAt: Timestamp.now() });
});

let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '-', e.message.split('\n')[0]); } }
const ctx = (uid, tok) => env.authenticatedContext(uid, tok).firestore();

const admin = ctx('ao', G('ao@rguktong.ac.in'));
await t('superadmin self-create superadmin profile', assertSucceeds(setDoc(doc(admin, 'users/ao'), { email: 'ao@rguktong.ac.in', role: 'superadmin', modules: [], disabled: false, mustChangePassword: false })));
await t('superadmin lists users', assertSucceeds(getDocs(collection(admin, 'users'))));
await t('superadmin reads cse items', assertSucceeds(getDocs(collection(admin, 'stock/cse/items'))));
await t('superadmin creates staff profile', assertSucceeds(setDoc(doc(admin, 'users/newstaff'), { email: 'staff31@rosms.local', role: 'staff', modules: [], disabled: false, mustChangePassword: true })));
await t('superadmin cannot make staff superadmin', assertFails(setDoc(doc(admin, 'users/x2'), { email: 'staff32@rosms.local', role: 'superadmin', modules: [], disabled: false, mustChangePassword: true })));

const gmail = ctx('g1', G('someone@gmail.com'));
await t('gmail cannot create profile', assertFails(setDoc(doc(gmail, 'users/g1'), { email: 'someone@gmail.com', role: 'student', modules: [], disabled: false, mustChangePassword: false })));
await t('gmail cannot read books', assertFails(getDoc(doc(gmail, 'library_books/A1'))));
await t('gmail cannot read modules', assertFails(getDoc(doc(gmail, 'modules/cse'))));

const fakeInst = ctx('f1', { email: 'evil@rguktong.ac.in', email_verified: true, firebase: { sign_in_provider: 'password' } });
await t('password-provider institute email rejected', assertFails(setDoc(doc(fakeInst, 'users/f1'), { email: 'evil@rguktong.ac.in', role: 'student', modules: [], disabled: false, mustChangePassword: false })));

const newStu = ctx('s2', G('o999999@rguktong.ac.in'));
await t('student self-register', assertSucceeds(setDoc(doc(newStu, 'users/s2'), { email: 'o999999@rguktong.ac.in', role: 'student', modules: [], disabled: false, mustChangePassword: false })));
const newStu3 = ctx('s3', G('o888888@rguktong.ac.in'));
await t('student cannot self-assign modules', assertFails(setDoc(doc(newStu3, 'users/s3'), { email: 'o888888@rguktong.ac.in', role: 'student', modules: ['cse'], disabled: false, mustChangePassword: false })));
await t('student cannot self-register as hod', assertFails(setDoc(doc(newStu3, 'users/s3'), { email: 'o888888@rguktong.ac.in', role: 'hod', modules: [], disabled: false, mustChangePassword: false })));

const rogue = ctx('r1', P('rogue'));
await t('unprovisioned staff cannot read books', assertFails(getDoc(doc(rogue, 'library_books/A1'))));
await t('unprovisioned staff cannot create own profile', assertFails(setDoc(doc(rogue, 'users/r1'), { email: 'rogue@rosms.local', role: 'staff', modules: [], disabled: false, mustChangePassword: false })));

const hodStaff = ctx('hodcseStaff', P('hod.cse'));
await t('mustChangePassword blocks data', assertFails(getDocs(collection(hodStaff, 'stock/cse/items'))));
await t('self cannot change role', assertFails(updateDoc(doc(hodStaff, 'users/hodcseStaff'), { role: 'superadmin' })));
await t('self clears mustChangePassword', assertSucceeds(updateDoc(doc(hodStaff, 'users/hodcseStaff'), { mustChangePassword: false })));
await t('self cannot add modules', assertFails(updateDoc(doc(hodStaff, 'users/hodcseStaff'), { modules: ['cse', 'ece'] })));
await t('hod.cse reads cse items', assertSucceeds(getDocs(collection(hodStaff, 'stock/cse/items'))));
await t('hod.cse cannot read ece items', assertFails(getDocs(collection(hodStaff, 'stock/ece/items'))));
await t('hod.cse cannot read library members', assertFails(getDocs(collection(hodStaff, 'library_members'))));
await t('hod.cse cannot set negative qty', assertFails(updateDoc(doc(hodStaff, 'stock/cse/items/PEN'), { quantity: -1 })));
await t('hod.cse txn append', assertSucceeds(addDoc(collection(hodStaff, 'stock/cse/txns'), { type: 'in', qty: 1, by: 'hod.cse@rosms.local', at: serverTimestamp() })));
await t('hod.cse creates transfer to central', assertSucceeds(setDoc(doc(hodStaff, 'transfers/t1'), { fromModule: 'cse', toModule: 'central', itemId: 'PEN', qty: 1, status: 'pending', requestedBy: 'hod.cse@rosms.local', createdAt: serverTimestamp() })));
await t('hod.cse queries outgoing transfers', assertSucceeds(getDocs(query(collection(hodStaff, 'transfers'), where('fromModule', '==', 'cse'), orderBy('createdAt', 'desc')))));
await t('hod.cse cannot accept own outgoing', assertFails(updateDoc(doc(hodStaff, 'transfers/t1'), { status: 'accepted' })));
await t('hod.cse reads cse audit', assertSucceeds(getDocs(query(collection(hodStaff, 'audit'), where('module', '==', 'cse')))));
await t('hod.cse cannot read ece audit', assertFails(getDocs(query(collection(hodStaff, 'audit'), where('module', '==', 'ece')))));

const central = ctx('central1', P('coord.central'));
await t('central queries incoming transfers', assertSucceeds(getDocs(query(collection(central, 'transfers'), where('toModule', '==', 'central'), orderBy('createdAt', 'desc')))));
await t('central accepts transfer', assertSucceeds(updateDoc(doc(central, 'transfers/t1'), { status: 'accepted', decidedBy: 'coord.central@rosms.local' })));
await t('central creates item via transfer', assertSucceeds(setDoc(doc(central, 'stock/central/items/PEN'), { code: 'PEN', name: 'Pen', unit: 'Nos', quantity: 1, minLevel: 0 })));

const owner = ctx('hodcseG', G('hodcse@rguktong.ac.in'));
await t('owner email edits cse item', assertSucceeds(updateDoc(doc(owner, 'stock/cse/items/PEN'), { quantity: 9 })));
await t('owner email cannot edit central', assertFails(getDocs(collection(owner, 'stock/central/items'))));

const warden = ctx('warden1', P('warden01'));
await t('warden issues outpass', assertSucceeds(setDoc(doc(warden, 'outpasses/op3'), { studentEmail: 'o234747@rguktong.ac.in', status: 'out', issuedBy: 'warden01@rosms.local', reason: 'Home', expectedReturn: Timestamp.now(), issuedAt: serverTimestamp() })));
await t('warden cannot forge issuer', assertFails(setDoc(doc(warden, 'outpasses/op4'), { studentEmail: 'o234747@rguktong.ac.in', status: 'out', issuedBy: 'ao@rguktong.ac.in', reason: 'Home', expectedReturn: Timestamp.now() })));
await t('warden marks returned', assertSucceeds(updateDoc(doc(warden, 'outpasses/op1'), { status: 'returned', late: false, actualReturn: serverTimestamp() })));
await t('warden cannot change reason', assertFails(updateDoc(doc(warden, 'outpasses/op2'), { reason: 'changed', status: 'returned' })));
await t('warden registers student', assertSucceeds(setDoc(doc(warden, 'students/o234747@rguktong.ac.in'), { name: 'S', status: 'in' })));
await t('warden cannot read library members', assertFails(getDocs(collection(warden, 'library_members'))));

const stu = ctx('stu1', G('o234747@rguktong.ac.in'));
await t('student reads own outpasses (query)', assertSucceeds(getDocs(query(collection(stu, 'outpasses'), where('studentEmail', '==', 'o234747@rguktong.ac.in')))));
await t('student cannot read others outpass', assertFails(getDoc(doc(stu, 'outpasses/op2'))));
await t('student cannot list all outpasses', assertFails(getDocs(collection(stu, 'outpasses'))));
await t('student reads own student doc', assertSucceeds(getDoc(doc(stu, 'students/o234747@rguktong.ac.in'))));
await t('student browses catalogue', assertSucceeds(getDoc(doc(stu, 'library_books/A1'))));
await t('student cannot edit catalogue', assertFails(updateDoc(doc(stu, 'library_books/A1'), { title: 'Y' })));
await t('student reads own loans (query)', assertSucceeds(getDocs(query(collection(stu, 'library_loans'), where('memberEmail', '==', 'o234747@rguktong.ac.in')))));
await t('student audit create own', assertSucceeds(addDoc(collection(stu, 'audit'), { uid: 'stu1', email: 'o234747@rguktong.ac.in', module: 'system', action: 'x', at: serverTimestamp() })));
await t('student cannot forge audit', assertFails(addDoc(collection(stu, 'audit'), { uid: 'ao', email: 'ao@rguktong.ac.in', module: 'system', action: 'x' })));
await t('student cannot read audit', assertFails(getDocs(collection(stu, 'audit'))));

const lib = ctx('lib1', G('hodlib@rguktong.ac.in'));
await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users/lib1'), { email: 'hodlib@rguktong.ac.in', role: 'faculty', modules: [], disabled: false, mustChangePassword: false }));
await t('library owner issues book (available<=copies)', assertSucceeds(updateDoc(doc(lib, 'library_books/A1'), { available: 0 })));
await t('library owner cannot exceed copies', assertFails(updateDoc(doc(lib, 'library_books/A1'), { available: 5 })));
await t('library owner writes settings', assertSucceeds(setDoc(doc(lib, 'library_settings/config'), { finePerDay: 2 })));

const dis = ctx('dis', P('staff05'));
await t('disabled user blocked', assertFails(getDocs(collection(dis, 'stock/cse/items'))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
