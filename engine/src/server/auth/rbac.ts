import 'server-only';
import type { SessionUser } from './session';

/* ═══════════════════════════════════════════════════════════════════════════
   Roles
   ───────────────────────────────────────────────────────────────────────────
   Five, in order of authority. 'admin' and 'editor' are the original two and
   keep exactly what they always had — adding the others changes no existing
   account's access.

     admin     everything, including who else has an account
     manager   an editor who also owns the site's chrome: appearance, menus,
               popups, redirects. Not users, settings, email, security,
               updates, backups or the audit log — the technical owner keeps
               those.
     editor    writes and publishes content, their own only (ownsOrAdmin)
     author    writes and deletes their own drafts, and cannot publish
               anything. The most-asked-for split in any CMS: somebody who
               writes without being able to put it on the live site.
     reviewer  reads content and enquiries, changes nothing but their own
               profile. For a client who wants to see the site and handle
               enquiries without being able to break either.

   Two things that never widen: `users:*`, because an account that can create
   accounts is an account that can promote itself; and the export/erase half of
   the newsletter and form submissions, because those are personal data.
   ═══════════════════════════════════════════════════════════════════════════ */
export type Role = 'admin' | 'manager' | 'editor' | 'author' | 'reviewer';

/**
 * Every capability the admin panel exposes. Permission is decided here and
 * enforced server-side on every request — the UI hides what a role cannot do,
 * but hiding is never the control.
 */
export const PERMISSIONS = {
  'dashboard:view': ['admin', 'manager', 'editor', 'author', 'reviewer'],

  'pages:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'pages:write': ['admin', 'manager', 'editor', 'author'],
  'pages:delete': ['admin', 'manager', 'editor', 'author'],
  // An author writes; an author does not decide what the public sees.
  'pages:publish': ['admin', 'manager', 'editor'],

  'posts:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'posts:write': ['admin', 'manager', 'editor', 'author'],
  'posts:delete': ['admin', 'manager', 'editor', 'author'],
  'posts:publish': ['admin', 'manager', 'editor'],

  'categories:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  // A category is site-wide furniture, not one person's content.
  'categories:write': ['admin', 'manager', 'editor'],
  'categories:delete': ['admin', 'manager', 'editor'],

  'media:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'media:write': ['admin', 'manager', 'editor', 'author'],
  // Deleting a file can empty an image on a page somebody else wrote.
  'media:delete': ['admin', 'manager', 'editor'],

  'enquiries:read': ['admin', 'manager', 'editor', 'reviewer'],
  'enquiries:write': ['admin', 'manager', 'editor', 'reviewer'],

  // Sign-up addresses are personal data: whoever handles enquiries may see
  // the list; only an administrator may export or erase it.
  'newsletter:read': ['admin', 'manager', 'editor', 'reviewer'],
  'newsletter:write': ['admin'],

  // Form answers are personal data too: the same split as the newsletter.
  'submissions:read': ['admin', 'manager', 'editor', 'reviewer'],
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
  'appearance:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'appearance:write': ['admin', 'manager'],

  // Menus change every page's chrome, so they stay with whoever owns the
  // site's look rather than with content editing.
  'navigation:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'navigation:write': ['admin', 'manager'],

  // A popup appears over every page it targets, so it sits with the menus.
  'popups:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'popups:write': ['admin', 'manager'],

  // History follows the content it describes: anyone who may edit a page may
  // see and restore its revisions, subject to the same ownership check.
  'revisions:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'revisions:restore': ['admin', 'manager', 'editor', 'author'],

  // A redirect can send every visitor to an arbitrary URL, so it stays with
  // the roles that own the site rather than with content editing.
  'redirects:read': ['admin', 'manager', 'editor', 'author', 'reviewer'],
  'redirects:write': ['admin', 'manager'],
  'audit:read': ['admin'],

  'profile:write': ['admin', 'manager', 'editor', 'author', 'reviewer'],
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
 * Row-level ownership. Applied on top of the permission check, never instead
 * of it.
 *
 * An administrator or a manager may act on anything — a manager runs the site
 * day to day and cannot do that while locked out of other people's drafts.
 * Everyone else may only mutate what they authored.
 */
export function ownsOrAdmin(
  user: Pick<SessionUser, 'id' | 'role'> | null | undefined,
  resourceAuthorId: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'manager') return true;
  return Boolean(resourceAuthorId) && resourceAuthorId === user.id;
}
