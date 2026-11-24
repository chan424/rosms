import { MODULES, type ModuleDef } from '../config/modules';
import { OUTPASS_ROLES, SUPER_ADMINS } from '../config/roles';
import type { ModuleDoc, UserProfile } from './types';

export interface AccessContext {
  profile: UserProfile | null;
  moduleDocs: Record<string, ModuleDoc>;
}

export const isSuperAdmin = (p: UserProfile | null) =>
  !!p && p.role === 'superadmin' && SUPER_ADMINS.includes(p.email.toLowerCase());

export const isOwner = (ctx: AccessContext, moduleId: string) =>
  !!ctx.profile && (ctx.moduleDocs[moduleId]?.owners ?? []).includes(ctx.profile.email.toLowerCase());

/** View + modify data of a module (mirrors canEdit() in firestore.rules). */
export const canAccess = (ctx: AccessContext, moduleId: string) => {
  const p = ctx.profile;
  if (!p || p.disabled || p.mustChangePassword) return false;
  if (isSuperAdmin(p) || isOwner(ctx, moduleId)) return true;
  if ((p.modules ?? []).includes(moduleId)) return true;
  return moduleId === 'outpass' && OUTPASS_ROLES.includes(p.role);
};

/** Manage a module: settings, audit log (mirrors canManage() in firestore.rules). */
export const canManage = (ctx: AccessContext, moduleId: string) => {
  const p = ctx.profile;
  if (!p || p.disabled) return false;
  if (isSuperAdmin(p) || isOwner(ctx, moduleId)) return true;
  return (p.role === 'hod' || p.role === 'coordinator') && (p.modules ?? []).includes(moduleId);
};

export const accessibleModules = (ctx: AccessContext): ModuleDef[] =>
  MODULES.filter((m) => canAccess(ctx, m.id));
