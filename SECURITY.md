# ROSMS security

This repository is **public on purpose**. Anyone can read the code — and that is safe, because
nothing in the code grants access. Every read and write is checked by Google's servers.

## Why the Firebase config in the code is not a secret

`src/firebaseConfig.ts` contains the Firebase *web* config (`apiKey`, `projectId`, `appId`, …).
These values only tell the browser **which** Firebase project to talk to. Every website that uses Firebase
ships them to every visitor's browser, so hiding them would not protect anything.
([Firebase: API keys for Firebase are not secret](https://firebase.google.com/docs/projects/api-keys))

What actually protects the data:

1. **Firebase Authentication** — users must sign in with a verified `@rguktong.ac.in` Google account,
   or a staff username that an administrator created. Self-made staff accounts get no access.
2. **`firestore.rules`** — enforced on Google's servers for every request, whatever code sends it:
   - Signed-out visitors and non-`@rguktong.ac.in` accounts cannot read or write anything.
   - Users cannot change their own role, modules or disabled flag, and cannot read or edit other users.
   - HoDs/coordinators and staff can only touch the modules assigned to them; wardens and caretakers
     only the outpass register; students can only read their own outpasses, loans and campus status.
   - Stock ledgers and the audit log are append-only; "issued by / decided by / marked by" fields must be
     the signed-in user's own email, so actions cannot be forged in someone else's name.
   - Everything not explicitly allowed is denied.
3. **Rules tests** — `tests/rules.test.mjs` (91 checks) runs these rules in the Firebase emulator,
   including attempts by signed-out visitors, outside Google accounts and each role to overstep.

Cloning or modifying this code does not give anyone access to the ROSMS data: a copy of the site still has
to pass the same server-side rules, and only the owner can publish rules or change the real site.

## What must stay secret (never commit these)

| Secret | Where it lives |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` (service-account JSON, full admin access) | GitHub → Settings → Secrets and variables → Actions → **Secrets** only |
| `ROSMS_USERS_CSV` / `users.csv` / `rosms-credentials.csv` (staff passwords) | Actions secret, and the owner's private copy only |
| `BACKUP_PASSPHRASE` (encrypts the daily backup zip) | Actions secret, and the owner's password manager |
| Any `*.env.local` file | Your own computer only |

`.gitignore` already blocks `.env*`, `credentials/`, `rosms-credentials*.csv`, `scripts/users.csv` and service-account
key files. Workflows write secrets to a temporary file on the runner and delete it at the end; scripts never
print passwords, and the backup only includes the database when it can be encrypted.

## Owner checklist

- Keep GitHub two-factor authentication on for the account that owns this repository.
- Only add trusted people as repository collaborators (they can change the live site).
- Firebase console → Authentication → Settings: keep **user account creation** limited to what ROSMS uses
  (Google + Email/Password) and consider adding an **authorized domain** list of only your site's domains.
- Optionally restrict the web API key to your site's domains in Google Cloud console → APIs & Services → Credentials
  (HTTP referrers: `chan424.github.io/*`, `localhost:*`).
- If a service-account key is ever exposed, delete it in Google Cloud console → IAM → Service accounts → Keys,
  create a new one and update the secret.

## Reporting a problem

If you find a security issue, contact the ROSMS administrator (AO office, RGUKT Ongole) privately rather than
opening a public issue.
