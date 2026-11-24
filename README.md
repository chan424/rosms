# ROSMS — RGUKT Ongole Smart Management System

**One campus, one system.**

ROSMS is a web application for Rajiv Gandhi University of Knowledge Technologies, Ongole. It brings the library, the
hospital, central stores, department and engineering-works stock, and the student in/out (outpass) register into one
secure place.

- **Frontend:** React 18 + TypeScript + Vite + Material UI, hosted free on **GitHub Pages**
- **Backend:** **Firebase** Authentication + Cloud Firestore (works on the free *Spark* plan)
- **Security:** enforced on the server by [`firestore.rules`](firestore.rules) (covered by 53 automated rule tests in [`tests/`](tests))

---

## Modules

| # | Module | Status |
|---|--------|--------|
| 1 | **Library Management**: catalogue (accession no., title, author, ISBN, category, copies, rack), members, issue/return, due dates, renewals, fines, reservations with queue, overdue list, history, dashboard, Excel bulk upload (add/update), Excel/PDF export, circulation rules | ✅ Complete |
| 2 | **Hospital Stock & Dispensary**: opening stock loaded from the college medicine sheet (111 items: Tablets / Ointments, Drops & Syrups / Injections & Surgical Items). **Issue medicines** to a student (ID like `O234747`), staff, faculty or other: several medicines per visit, quantity, optional complaint/diagnosis, automatic date/time and issued-by. **Receive** new stock with quantity, batch, expiry, supplier and indent/invoice ref, and received-on date. First-expiry-first-out batches, write-offs for expired or damaged stock, per-medicine history, **daily issue register**, **search by student ID** to see everything given to them, out-of-stock / low-stock / expiry alerts, Excel/PDF export, and in-app import of the stock sheet | ✅ Complete |
| 3 | **Central Stock**: Central Stores. Departments transfer to and from it | ✅ Working |
| 4 | **Department & office stock**: CSE, ECE, EEE, ME, CE, Civil Works, Electrical Works, Mechanical Works, IT Infra, FO, DSW, EBS. All share one stock engine: items, stock in/out, physical-count adjustment, append-only ledger, transfers with accept/reject, low-stock alerts, import/export | ✅ Working |
| 5 | **Student Campus Status & Outpass**: in/out status, issue outpass (issued by, issued at, reason, type, destination, expected return), mark returned (actual return, **late flag**), cancel, status board, register, student import. Students see their own records | ✅ Working |
| — | Cross-cutting: role-based access, admin panel, module owners, append-only **audit log**, dashboards, responsive mobile UI | ✅ |

Modules come from a registry ([`src/config/modules.ts`](src/config/modules.ts)). To add another stock module, add one
entry there, add its id to `stockModules()` in `firestore.rules`, and add it to the seed script.

## Bulk upload from Excel (every module)

Every data screen has **manual entry** (Add / Edit forms) and a **Bulk upload (Excel)** button. Only people who can
open that module see it, and the Firestore rules enforce the same limit on the server.

1. **Download Excel template**: a `Data` sheet with the header row, and an `Instructions` sheet listing every column,
   whether it is required, the allowed values, and sample rows.
2. **Upload** the filled `.xlsx` / `.xls` / `.csv` (or drag it in), or **paste** rows copied from Excel or Google Sheets.
   Columns can be in any order, and common header spellings are recognised (`Acc No`, `Qty`, `Rate`, `Roll No`…).
3. **Preview**: each row is marked *New*, *Update*, *Skip* or *Error* with the reason (missing required value, bad
   number or date, duplicate row, unknown item code, not enough stock…). Pick the mode: *add new and update existing*,
   *add new only*, or *update existing only*. Rows with errors are never written, and **Download error rows** gives
   them back as a sheet you can fix and re-upload.
4. **Import**: rows are written in batches with a progress bar, and each upload is recorded in the audit log.

When a row updates an existing record, blank cells keep the current value. Dates can be `YYYY-MM-DD`, `DD-MM-YYYY`,
`DD/MM/YYYY`, `31-Mar-2027` or `Mar 2027` (expiry style, meaning the last day of that month).

| Screen | Matched on | Columns (**required**) |
|---|---|---|
| Library → Catalogue | Accession No | **Accession No, Title**, Author, ISBN, Category, Publisher, Edition, Year, Rack, Copies, Price |
| Library → Members | Member ID | **Member ID, Name**, Type (student/faculty/staff), Email (@rguktong.ac.in), Department, Year, Phone, Active (Yes/No) |
| Any stock module → Items: add new / update | Item Code | **Item Code, Item Name**, Unit, Category, Location, Min Level, Unit Price, Quantity, Description |
| Hospital → Medicines: add new / update | Item Code | **Item Code, Medicine Name**, Unit, Category, Location, Min Level, Unit Price, Quantity, Batch No, Expiry, Description |
| Any stock module → Stock in / out | (each row is a movement) | **Item Code, Movement (IN/OUT), Quantity**, Date, Reference, Supplier / Issued To, Remarks |
| Hospital → Stock in / out | (each row is a movement) | as above + Batch No, Expiry, Patient Type, Patient ID, Patient Name, Complaint |
| Outpass → Students | institute email (from ID No) | **Name**, plus **ID No or Email**, Gender, Year, Branch, Hostel, Room, Phone, Parent Phone |

Stock rules that bulk upload keeps:
- **New items**: *Quantity* becomes the opening stock and is written to the ledger. For the hospital it goes into the
  given batch and expiry (blank batch = `OPENING`).
- **Existing items**: details are updated, and quantities change only through the ledger. For non-hospital modules,
  ticking *Apply Quantity of existing items as a physical count* posts an **Adjustment** for each item whose count
  differs.
- **Stock in / out** rows go through the same transactional code as the manual buttons, in sheet order. An OUT row
  can never take stock below zero, which the preview checks with running totals. Hospital OUT rows are recorded as
  patient issues, so they appear in the daily register and in the patient's history.
- The hospital's original medicine stock sheet (sections with S No / Indent / Quantity) can still be loaded with
  **Import stock sheet**.

## Who can do what

| Who | How they sign in | Access |
|-----|------------------|--------|
| **Super admins**: `ao@`, `director@`, `ncs@`, `da@rguktong.ac.in` | Google | Everything, plus Administration (users, staff logins, module owners) and the full audit log |
| **Module owners**: HoD / coordinator role inboxes (`hodcse@`, `hodece@`, `hodeee@`, `hodmech@`, `hodcivil@`, `hodlib@`, `cw_coord@`, `ew_coord@`, `mw_coord@`, `itinfra@`, `fo@`, `dsw@`, `ebs@`) | Google | View and modify **their own module only**, plus that module's settings and audit log. Admins can change owners in-app (Administration → Module owners). Central Stores, Hospital and Outpass have no owner until an admin assigns one |
| **HoD / coordinator logins**: `hod.cse`, `coord.fo`, … | Username + password | Same as the owner, for the module mapped to that login |
| **Hospital**: `hosp.doctor` (Doctor), `hosp.assistant1`, `hosp.assistant2` (Medicine Assistants), `coord.hospital` | Username + password | Hospital Stock: issue, receive, register, alerts. `coord.hospital` (or an owner email) can also import the stock sheet |
| **Wardens / caretakers**: `warden01–20`, `caretaker01–25`, `coord.outpass` | Username + password | Outpass module: issue outpasses, mark students in, register students |
| **Temporary staff**: `staff01–30` | Username + password | Only the modules an admin ticks for them |
| **Students / faculty**: any `@rguktong.ac.in` account, e.g. `o234747@rguktong.ac.in` | Google | *My ROSMS*: own campus status, own outpasses, own library loans, catalogue search |
| Anyone else (gmail.com etc.) | — | Rejected |

Staff usernames sign in to Firebase with a synthetic email `username@rosms.local`. New accounts **must change their
password at first login**. Until they do, the rules block all their data access. Admins can disable an account in-app,
and that takes effect immediately.

---

## Owner setup (one time, about 20 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** → name it `rosms` (Google Analytics is optional).
2. **Build → Firestore Database → Create database** → *Production mode* → location **asia-south1 (Mumbai)**.
3. **Build → Authentication → Get started → Sign-in method**:
   - Enable **Google** (set the support email).
   - Enable **Email/Password** (leave *Email link* off).
4. **Authentication → Settings → Authorized domains** → add:
   - `chan424.github.io`
   - your future custom domain (e.g. `rosms.rguktong.ac.in`), when you have it.
5. Leave **Authentication → Settings → User actions → Enable create (sign-up)** turned **on**. Students and faculty
   need it for their first Google sign-in. A username account that someone creates outside ROSMS has no access, because
   the rules only accept username accounts that an admin set up.

### 2. Connect the web app
1. **Project settings (⚙) → General → Your apps → Web (</>)** → register the app `rosms-web` (Firebase Hosting is not
   needed).
2. Copy the `firebaseConfig` values.
3. In GitHub: **chan424/rosms → Settings → Secrets and variables → Actions → Variables → New repository variable**,
   and add:

   | Variable | Value from firebaseConfig |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   (These are not secrets. The Firestore rules protect the data.)

### 3. Deploy the security rules and indexes
On any computer with Node.js 18+:
```bash
npm install -g firebase-tools
firebase login
git clone https://github.com/chan424/rosms.git && cd rosms
firebase use --add            # pick your project
firebase deploy --only firestore:rules,firestore:indexes
```
*(No terminal? Open Firestore → **Rules**, paste [`firestore.rules`](firestore.rules) and click **Publish**. Indexes
can also be created from the links in the browser console errors the first time a screen needs one.)*

### 4. Create the staff logins (seed script)
1. Firebase console → **Project settings → Service accounts → Generate new private key**. This downloads a JSON key.
   **Keep it private. Never commit it.**
2. Put your credentials spreadsheet (columns `Role,Username,Module,Assigned to,Password`) at `scripts/users.csv`. This
   path is git-ignored. [`scripts/users.example.csv`](scripts/users.example.csv) shows the format, and
   [`scripts/usernames.csv`](scripts/usernames.csv) lists every username without passwords.
3. Run:
   ```bash
   cd scripts
   npm install
   node seed-users.mjs --key ./serviceAccount.json --csv ./users.csv --dry-run   # preview
   node seed-users.mjs --key ./serviceAccount.json --csv ./users.csv             # create
   ```
   Then load the hospital's opening stock (111 medicines from the current stock sheet, kept as
   [`scripts/data/hospital-opening-stock.json`](scripts/data/hospital-opening-stock.json)):
   ```bash
   node seed-hospital-stock.mjs --key ./serviceAccount.json --dry-run
   node seed-hospital-stock.mjs --key ./serviceAccount.json
   # or straight from an updated sheet: --xlsx ./medicine-stock.xlsx   (add --force to overwrite existing quantities)
   ```
   Alternatively, sign in as `coord.hospital` → Hospital → *Medicines & Receive* → **Import stock sheet**.

   The user seed creates the 94 username logins with their role documents, the `modules/*` owner documents (default HoD /
   coordinator emails) and the default library rules. Re-running it is safe. Existing passwords are kept unless you pass
   `--reset-passwords`.
4. Delete the key file and `users.csv` from shared machines when you're done.

### 5. Turn on GitHub Pages
**chan424/rosms → Settings → Pages → Build and deployment → Source: GitHub Actions.**
Then go to **Actions → Deploy to GitHub Pages → Run workflow**. Every later push to `main` deploys automatically.
The app goes live at **https://chan424.github.io/rosms/**.

### 6. First sign-in
Sign in with `ao@rguktong.ac.in` (or another super admin) → **Administration**:
- **Module owners:** confirm or adjust the HoD / coordinator emails. Assign owners for Central Stock (`spc@` or
  `epc@`), Hospital and Outpass.
- **Hospital:** after the opening stock is loaded, set realistic *minimum levels* per medicine (Edit details) so
  low-stock alerts match your usage.
- **Users & staff logins:** tick modules for the temporary `staff01–30` logins and fill in *Assigned to*.

## Custom domain later
1. Add a repository variable `CUSTOM_DOMAIN` = e.g. `rosms.rguktong.ac.in`. The workflow then builds for `/` and writes
   the `CNAME` file.
2. At your DNS provider, add a `CNAME` record for `rosms` pointing to `chan424.github.io`.
3. GitHub → Settings → Pages → Custom domain → enter the domain → tick **Enforce HTTPS** once it's available.
4. Firebase → Authentication → Authorized domains → add the domain.

The app uses hash URLs (`/#/m/library`), so deep links work on Pages and on any domain without server rewrites.

## Maintenance
```bash
cd scripts
node manage-users.mjs --key ./serviceAccount.json list
node manage-users.mjs --key ./serviceAccount.json reset   warden07   # new temporary password, printed once
node manage-users.mjs --key ./serviceAccount.json disable staff12
node manage-users.mjs --key ./serviceAccount.json enable  staff12
```
Password resets need this script, because the free Spark plan has no server functions. Disabling, re-assigning and
changing modules can all be done in the app.

## Local development
```bash
npm ci
cp .env.example .env.local   # fill in the Firebase values
npm run dev                  # http://localhost:5173/rosms/
npm run build                # type-check + production build
```
Add `localhost` to Firebase authorized domains (it is there by default).

### Rule tests
```bash
cd tests && npm install && npm test   # needs Java 11+ for the Firestore emulator
```

## Data model (Firestore)
| Collection | Purpose |
|---|---|
| `users/{uid}` | role, modules[], assignedTo, disabled, mustChangePassword |
| `modules/{id}` | owners[] (institute emails) |
| `library_books`, `library_members`, `library_loans`, `library_reservations`, `library_settings/config` | Library |
| `stock/{moduleId}/items/{code}` | stock items (qty, min level, batches[] for hospital) |
| `stock/{moduleId}/txns/{id}` | append-only stock ledger |
| `transfers/{id}` | inter-module transfers (pending → accepted / rejected → returned, or cancelled) |
| `students/{email}` | student profile + in/out status |
| `outpasses/{id}` | outpass register |
| `audit/{id}` | append-only audit trail |

## Free-tier notes
The Spark plan allows 50,000 document reads and 20,000 writes per day. The library and stock screens load each
module's full list for instant search, which is ideal up to a few thousand records per module. With a very large
catalogue (tens of thousands of titles) and heavy daily use, switch the project to the *Blaze* pay-as-you-go plan. It
costs a few rupees per month at campus scale and keeps the free quota. Student and outpass screens already use
on-demand search, so they scale to the full student body.

## Roadmap
- Requisition/indent workflow (department → Central Stores) with approvals
- Printable outpass slip with QR code and gate check-in/out scanning
- Barcode scanning for library accession numbers and stock items
- Email / WhatsApp reminders for overdue books and late returns
- Asset register (non-consumables) with condemnation workflow
