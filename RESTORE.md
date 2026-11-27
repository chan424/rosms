# Restoring ROSMS from a backup

Every night at **01:30 IST** the *Daily backup* workflow saves `rosms-backup-YYYY-MM-DD.zip`.
You can download it from GitHub (**Actions → Daily backup → pick a day → Artifacts**, kept 30 days)
or from the copy in your Google Drive.

The zip contains:

| Path | What it is |
|---|---|
| `site/` | The complete website source code at that day's commit |
| `firestore/firestore-YYYY-MM-DD.json` | The whole database: every collection and sub-collection (only when the database secrets are set) |
| `BACKUP-INFO.txt` | Date, commit and whether the database was included |
| `RESTORE.md` | This guide |

When the database is included, the zip is **AES-256 encrypted** with your `BACKUP_PASSPHRASE`.
Open it with **7-Zip** (Windows), **Keka** or **The Unarchiver** (Mac), or `7z x rosms-backup-YYYY-MM-DD.zip` (Linux).
The built-in Windows/Mac unzip cannot open AES-encrypted zips.

---

## A. The website is broken or the code was changed (about 5 minutes)

The website is rebuilt from the `main` branch on every push, so restoring the code restores the site.

**Easiest — in the browser, no tools needed**

1. Open the repository on GitHub → **Commits**. Find the last commit from before the problem.
2. Click it → **⋯ → Revert** (or browse the files at that commit and copy them back).
3. GitHub Pages redeploys automatically in 1–2 minutes (**Actions → Deploy to GitHub Pages**).

**From the backup zip** (if the repository itself was damaged or deleted)

1. Unzip the backup. Everything you need is in `site/`.
2. If the repository was deleted: create a new repository with the same name (`rosms`) on GitHub.
3. Upload the contents of `site/` (GitHub → **Add file → Upload files**, drag the folder contents in,
   including the hidden `.github` folder) and commit to `main`.
   Or with git: `cd site && git init -b main && git add . && git commit -m "Restore" && git remote add origin https://github.com/<you>/rosms.git && git push -f origin main`.
4. **Settings → Pages → Source: GitHub Actions** (only needed for a new repository).
5. Add the repository secrets again if it is a new repository: `FIREBASE_SERVICE_ACCOUNT`, `ROSMS_USERS_CSV`, `BACKUP_PASSPHRASE`.
6. Wait for **Actions → Deploy to GitHub Pages** to go green. The site is live again.

## B. Data was deleted or damaged (about 10 minutes)

You need: the backup zip, its passphrase, Node.js 20+, and a Firebase service-account key
(Firebase console → ⚙ Project settings → **Service accounts → Generate new private key**). Keep that key private
and delete it after the restore.

```bash
# 1. Unzip (enter BACKUP_PASSPHRASE when asked)
7z x rosms-backup-YYYY-MM-DD.zip -orosms-restore
cd rosms-restore/site/scripts
npm install

# 2. Preview: shows how many documents will be written, changes nothing
node restore-firestore.mjs --key /path/to/serviceAccount.json --file ../../firestore/firestore-YYYY-MM-DD.json

# 3. Restore everything
node restore-firestore.mjs --key /path/to/serviceAccount.json --file ../../firestore/firestore-YYYY-MM-DD.json --apply

#    ...or only some collections, e.g. hospital stock and outpasses
node restore-firestore.mjs --key /path/to/serviceAccount.json --file ../../firestore/firestore-YYYY-MM-DD.json --only stock,outpasses --apply
```

Each document in the backup is written back to its exact path, overwriting the current version.
Documents created after the backup are left as they are.

Then republish the security rules (they are part of the code, not the database):
**Actions → Seed Firebase → Run workflow** with only *Publish Firestore rules* ticked and *Dry run* off,
or paste `firestore.rules` into Firebase console → Firestore → **Rules → Publish**.

## C. Logins (Firebase Authentication)

Sign-in accounts are stored by Firebase Authentication, not in Firestore, so a database problem does not
remove them, and the backup never contains passwords. If staff logins ever need to be recreated, run
**Actions → Seed Firebase** with *Create / update the staff username logins* ticked (it uses the
`ROSMS_USERS_CSV` secret). Google (`@rguktong.ac.in`) users simply sign in again.

## D. Starting over in a brand-new Firebase project

1. Create the project and web app (README → *Owner setup*), and put the new web config in `src/firebaseConfig.ts`
   or the `VITE_FIREBASE_*` repository variables.
2. Update the `FIREBASE_SERVICE_ACCOUNT` secret with a key from the new project.
3. Run **Seed Firebase** (rules + logins), then restore the data with section B.

## Checks after any restore

- The site opens and the sign-in page loads.
- A super admin can sign in and sees every module.
- Spot-check hospital stock, library loans and today's outpasses against what you expect.

> Note: GitHub pauses scheduled workflows in a public repository after 60 days with no commits.
> If backups stop, open **Actions → Daily backup** and click **Enable workflow**, or make any small commit.
