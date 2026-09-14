import 'server-only';
import type { SessionUser } from './session';

export type Role = 'admin' | 'editor';

/**
 * Every capability the admin panel exposes. Permission is decided here and
 * enforced server-side on every request — the UI hides what a role cannot do,
 * but hiding is never the control.
 */
export const PERMISSIONS = {
  'dashboard:view': ['admin', 'editor'],

  'pages:read': ['admin', 'editor'],
  'pages:write': ['admin', 'editor'],
  'pages:delete': ['admin', 'editor'],
  'pages:publish': ['admin', 'editor'],

  'posts:read': ['admin', 'editor'],
  'posts:write': ['admin', 'editor'],
  'posts:delete': ['admin', 'editor'],
  'posts:publish': ['admin', 'editor'],

  'categories:read': ['admin', 'editor'],
  'categories:write': ['admin', 'editor'],
  'categories:delete': ['admin', 'editor'],

  'media:read': ['admin', 'editor'],
  'media:write': ['admin', 'editor'],
  'media:delete': ['admin', 'editor'],

  'enquiries:read': ['admin', 'editor'],
  'enquiries:write': ['admin', 'editor'],

  // Sign-up addresses are personal data: whoever handles enquiries may see
  // the list; only an administrator may export or erase it.
  'newsletter:read': ['admin', 'editor'],
  'newsletter:write': ['admin'],

  // Form answers are personal data too: the same split as the newsletter.
  'submissions:read': ['admin', 'editor'],
  'submissions:write': ['admin'],

  // Admin only — the Users section is hidden entirely from editors.
  'users:read': ['admin'],
  'users:write': ['admin'],
  'users:delete': ['admin'],

  'settings:write': ['admin'],
  // The mail server's credentials and the addresses that receive notifications.
  'email:read': ['admin'],
  'email:write': ['admin'],
  // Blocking addresses and unlocking accounts changes who can reach the site,
  // so it stays with the administrator.
  'security:read': ['admin'],
  'security:write': ['admin'],
  // Which engine this site runs, and taking a newer one.
  'updates:read': ['admin'],
  'updates:write': ['admin'],
  // A backup holds every account and every enquiry: reading the list, and
  // above all restoring one, is the administrator's alone.
  'backups:read': ['admin'],
  'backups:write': ['admin'],
  // The theme rewrites the look of every public page, so it sits with the
  // other admin-only capabilities rather than with content editing.
  'appearance:read': ['admin', 'editor'],
  'appearance:write': ['admin'],

  // Menus change every page's chrome, so they sit with the other admin-only
  // capabilities rather than with content editing.
  'navigation:read': ['admin', 'editor'],
  'navigation:write': ['admin'],

  // A popup appears over every page it targets, so it sits with the menus.
  'popups:read': ['admin', 'editor'],
  'popups:write': ['admin'],

  // History follows the content it describes: anyone who may edit a page may
  // see and restore its revisions, subject to the same ownership check.
  'revisions:read': ['admin', 'editor'],
  'revisions:restore': ['admin', 'editor'],

  // A redirect can send every visitor to an arbitrary URL, so it sits with the
  // admin-only capabilities rather than with content editing.
  'redirects:read': ['admin', 'editor'],
  'redirects:write': ['admin'],
  'audit:read': ['admin'],

  'profile:write': ['admin', 'editor'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: Pick<SessionUser, 'role'> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = 'ForbiddenError';
  }
}

export function assertCan(user: Pick<SessionUser, 'role'> | null | undefined, permission: Permission): void {
  if (!can(user, permission)) throw new ForbiddenError(permission);
}

/**
 * Row-level ownership. Admins may act on anything; an editor may only mutate
 * a resource they authored. Applied on top of the permission check, never
 * instead of it.
 */
export function ownsOrAdmin(
  user: Pick<SessionUser, 'id' | 'role'> | null | undefined,
  resourceAuthorId: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(resourceAuthorId) && resourceAuthorId === user.id;
}
