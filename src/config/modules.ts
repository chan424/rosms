/**
 * Module registry. Adding a new stock module = add one entry here, then
 * create the matching `modules/{id}` document (the seed script does this).
 */
export type ModuleKind = 'library' | 'stock' | 'outpass';

export interface ModuleDef {
  id: string;
  name: string;
  short: string;
  kind: ModuleKind;
  group: 'Core' | 'Departments' | 'Engineering Works' | 'Administration' | 'Students';
  /** Default owner emails (HoD / coordinator role inboxes). Admins can change in-app. */
  defaultOwners: string[];
  /** Staff username that acts as this module's HoD/coordinator login. */
  ownerUsername?: string;
  /** Stock modules with batch numbers and expiry dates (e.g. medicines). */
  batches?: boolean;
  /** Central Stores: other stock modules transfer to/from this one. */
  central?: boolean;
  color: string;
  description: string;
}

const D = '@rguktong.ac.in';

export const MODULES: ModuleDef[] = [
  { id: 'library', name: 'Library Management', short: 'Library', kind: 'library', group: 'Core', defaultOwners: ['hodlib' + D], ownerUsername: 'hod.library', color: '#34506B', description: 'Catalogue, members, issue/return, fines and reservations.' },
  { id: 'hospital', name: 'Hospital Stock & Dispensary', short: 'Hospital', kind: 'stock', group: 'Core', defaultOwners: [], ownerUsername: 'coord.hospital', batches: true, color: '#B42318', description: 'Medicines: receive with batch/expiry, issue to students and staff, alerts and daily register.' },
  { id: 'central', name: 'Central Stock', short: 'Central Stores', kind: 'stock', group: 'Core', defaultOwners: [], ownerUsername: 'coord.central', central: true, color: '#6B3A5B', description: 'Central stores: receipts, issues and transfers to departments.' },
  { id: 'cse', name: 'CSE Stock Management', short: 'CSE', kind: 'stock', group: 'Departments', defaultOwners: ['hodcse' + D], ownerUsername: 'hod.cse', color: '#2F5D73', description: 'Computer Science & Engineering department stock.' },
  { id: 'ece', name: 'ECE Stock Management', short: 'ECE', kind: 'stock', group: 'Departments', defaultOwners: ['hodece' + D], ownerUsername: 'hod.ece', color: '#2E6E6A', description: 'Electronics & Communication Engineering department stock.' },
  { id: 'eee', name: 'EEE Stock Management', short: 'EEE', kind: 'stock', group: 'Departments', defaultOwners: ['hodeee' + D], ownerUsername: 'hod.eee', color: '#A66315', description: 'Electrical & Electronics Engineering department stock.' },
  { id: 'me', name: 'ME Stock Management', short: 'ME', kind: 'stock', group: 'Departments', defaultOwners: ['hodmech' + D], ownerUsername: 'hod.me', color: '#6B4A35', description: 'Mechanical Engineering department stock.' },
  { id: 'ce', name: 'CE Stock Management', short: 'CE', kind: 'stock', group: 'Departments', defaultOwners: ['hodcivil' + D], ownerUsername: 'hod.ce', color: '#5B6E2F', description: 'Civil Engineering department stock.' },
  { id: 'civilworks', name: 'Civil Works Stock Management', short: 'Civil Works', kind: 'stock', group: 'Engineering Works', defaultOwners: ['cw_coord' + D], ownerUsername: 'coord.civilworks', color: '#7A5C44', description: 'Campus maintenance & civil works materials.' },
  { id: 'electricalworks', name: 'Electrical Works Stock Management', short: 'Electrical Works', kind: 'stock', group: 'Engineering Works', defaultOwners: ['ew_coord' + D], ownerUsername: 'coord.electricalworks', color: '#B5571E', description: 'Electrical maintenance materials and spares.' },
  { id: 'mechworks', name: 'Mechanical Works Stock Management', short: 'Mechanical Works', kind: 'stock', group: 'Engineering Works', defaultOwners: ['mw_coord' + D], ownerUsername: 'coord.mechworks', color: '#4F5B5E', description: 'Mechanical maintenance materials and spares.' },
  { id: 'itinfra', name: 'IT Infra Stock Management', short: 'IT Infra', kind: 'stock', group: 'Engineering Works', defaultOwners: ['itinfra' + D], ownerUsername: 'coord.itinfra', color: '#3B3F6B', description: 'Network, computers, peripherals and IT spares.' },
  { id: 'fo', name: 'FO Stock Management', short: 'FO', kind: 'stock', group: 'Administration', defaultOwners: ['fo' + D], ownerUsername: 'coord.fo', color: '#1F6B48', description: 'Finance Office stock and stationery.' },
  { id: 'dsw', name: 'DSW Stock Management', short: 'DSW', kind: 'stock', group: 'Administration', defaultOwners: ['dsw' + D], ownerUsername: 'coord.dsw', color: '#8E2F4D', description: 'Dean Student Welfare stock (hostels, sports, welfare).' },
  { id: 'ebs', name: 'EBS Stock Management', short: 'EBS', kind: 'stock', group: 'Administration', defaultOwners: ['ebs' + D], ownerUsername: 'coord.ebs', color: '#57406E', description: 'Establishment section stock.' },
  { id: 'outpass', name: 'Student Campus Status & Outpass', short: 'Outpass', kind: 'outpass', group: 'Students', defaultOwners: [], ownerUsername: 'coord.outpass', color: '#2D5F55', description: 'In/out campus status, outpasses issued by wardens and caretakers.' },
];

export const MODULE_MAP: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const STOCK_MODULES = MODULES.filter((m) => m.kind === 'stock');
export const getModule = (id?: string) => (id ? MODULE_MAP[id] : undefined);
