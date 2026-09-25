// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ADMIN_NAV } from '@/components/admin/Sidebar';
import { PERMISSIONS } from '@/server/auth/rbac';
import { ROLES, type Role } from '@/lib/roles';

/* ═══════════════════════════════════════════════════════════════════════════
   The sidebar must not offer what a role cannot do
   ───────────────────────────────────────────────────────────────────────────
   `rbac.ts` is server-only, so the sidebar cannot call `can()` — it carries a
   hand-written list of roles per item, with a comment saying it must match.
   A comment is not a mechanism, and it drifted: Appearance, Menus and Popups
   were offered to managers and then bounced them to the dashboard, while
   their own page comments claimed the API was admin-only. It was not.

   So the match is checked here instead. The map below is the one hand-written
   thing left — the permission each screen actually needs — and it is small
   enough to read in one go.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The permission that decides whether an item is *offered*.
 *
 * Not always the same as the one that lets somebody open the screen: a screen
 * with a read-only mode (Cookie notice, Email) opens on `:read` but is only
 * advertised to whoever can change it.
 */
const GATE: Record<string, keyof typeof PERMISSIONS> = {
  '/admin': 'dashboard:view',
  '/admin/pages': 'pages:read',
  '/admin/posts': 'posts:read',
  '/admin/categories': 'categories:read',
  '/admin/projects': 'projects:read',
  '/admin/saved-blocks': 'savedBlocks:write',
  '/admin/jobs': 'jobs:read',
  '/admin/media': 'media:read',
  '/admin/enquiries': 'enquiries:read',
  '/admin/newsletter': 'newsletter:read',
  '/admin/submissions': 'submissions:read',
  '/admin/applications': 'applications:read',
  // The chrome screens gate on `:write`: every role can read, and there is
  // nothing worth opening without being able to change it.
  '/admin/appearance': 'appearance:write',
  '/admin/navigation': 'navigation:write',
  '/admin/popups': 'popups:write',
  '/admin/cookies': 'popups:write',
  '/admin/permalinks': 'settings:write',
  // Not `popups:*` like the chrome above it: this row loads on every page of
  // the site, which is the reach Appearance and the theme have.
  '/admin/code': 'settings:write',
  '/admin/users': 'users:read',
  // Same reasoning as the chrome screens: nothing to read without writing.
  '/admin/redirects': 'redirects:write',
  '/admin/email': 'email:read',
  '/admin/security': 'security:read',
  '/admin/updates': 'updates:read',
  '/admin/backups': 'backups:read',
  '/admin/transfer': 'transfer:read',
  '/admin/audit': 'audit:read',
  '/admin/languages': 'settings:write',
  '/admin/translations': 'settings:write',
  '/admin/settings': 'settings:write',
  '/admin/profile': 'profile:write',
};

const items = ADMIN_NAV.flatMap((group) => group.items);
const holders = (permission: keyof typeof PERMISSIONS): Role[] =>
  ROLES.filter((role) => (PERMISSIONS[permission] as readonly Role[]).includes(role));

describe('the admin sidebar', () => {
  it('names a permission for every item it shows', () => {
    for (const item of items) expect(GATE, item.href).toHaveProperty(item.href);
  });

  /* The bug this whole file exists for: an item offered to a role that the
     screen behind it then turns away. */
  it('offers each item to exactly the roles that may use it', () => {
    for (const item of items) {
      const permitted = holders(GATE[item.href]!);
      const offered = item.roles ? ROLES.filter((role) => item.roles!.includes(role)) : ROLES;
      expect(offered, `${item.label} (${item.href})`).toEqual(permitted);
    }
  });

  it('shows a manager the three screens they own, and the cookie notice with them', () => {
    const forManager = items.filter((item) => !item.roles || item.roles.includes('manager')).map((i) => i.href);
    for (const href of ['/admin/appearance', '/admin/navigation', '/admin/popups', '/admin/cookies']) {
      expect(forManager, href).toContain(href);
    }
  });

  it('still hides the administrator-only sections from everybody else', () => {
    const forEditor = items.filter((item) => !item.roles || item.roles.includes('editor')).map((i) => i.href);
    for (const href of ['/admin/users', '/admin/security', '/admin/backups', '/admin/audit', '/admin/settings']) {
      expect(forEditor, href).not.toContain(href);
    }
  });
});
