import type { Timestamp } from 'firebase/firestore';
import type { Role } from '../config/roles';

export type TS = Timestamp | null | undefined;

export interface UserProfile {
  id: string; // uid
  email: string;
  displayName?: string;
  username?: string; // staff logins only
  role: Role;
  modules: string[]; // modules this user may view + modify
  assignedTo?: string; // real person a shared staff login is handed to
  disabled?: boolean;
  mustChangePassword?: boolean;
  createdAt?: TS;
  lastLoginAt?: TS;
}

export interface ModuleDoc {
  id: string;
  name?: string;
  owners: string[]; // lowercase institute emails with owner rights
  updatedAt?: TS;
}

export interface AuditEntry {
  id: string;
  at: TS;
  uid: string;
  email: string;
  module: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}
