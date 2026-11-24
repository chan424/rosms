/** Institute Google Workspace domain. Only these Google accounts may sign in. */
export const INSTITUTE_DOMAIN = 'rguktong.ac.in';

/** Synthetic email domain for username/password staff logins (username@rosms.local). */
export const STAFF_EMAIL_DOMAIN = 'rosms.local';

/** Super admins: full access to every module and to user administration.
 *  Keep in sync with `superAdmins()` in firestore.rules. */
export const SUPER_ADMINS = [
  'ao@rguktong.ac.in',
  'director@rguktong.ac.in',
  'ncs@rguktong.ac.in',
  'da@rguktong.ac.in',
];

export type Role =
  | 'superadmin'
  | 'hod'
  | 'coordinator'
  | 'staff'
  | 'warden'
  | 'caretaker'
  | 'doctor'
  | 'medassistant'
  | 'faculty'
  | 'student';

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  hod: 'Head of Department',
  coordinator: 'Coordinator',
  staff: 'Staff',
  warden: 'Warden',
  caretaker: 'Caretaker',
  doctor: 'Doctor',
  medassistant: 'Medicine Assistant',
  faculty: 'Faculty / Employee',
  student: 'Student',
};

/** Roles that may issue outpasses and mark students back in campus. */
export const OUTPASS_ROLES: Role[] = ['warden', 'caretaker'];

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;

export const emailToUsername = (email: string) =>
  email.endsWith('@' + STAFF_EMAIL_DOMAIN) ? email.split('@')[0] : email;

export const isInstituteEmail = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith('@' + INSTITUTE_DOMAIN);

export const isStaffEmail = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith('@' + STAFF_EMAIL_DOMAIN);

/** Student IDs look like o234747@rguktong.ac.in (letter + digits). */
export const looksLikeStudent = (email: string) => /^[a-z]\d{5,}@/i.test(email);
