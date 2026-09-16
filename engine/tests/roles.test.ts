import { describe, expect, it } from 'vitest';
import { ROLES, ROLE_CHOICES, isRole, roleLabel, type Role } from '@/lib/roles';
import { userRole } from '@/server/db/schema';
import { PERMISSIONS, can, ownsOrAdmin } from '@/server/auth/rbac';

/* ═══════════════════════════════════════════════════════════════════════════
   Roles
   ───────────────────────────────────────────────────────────────────────────
   `lib/roles.ts` is the single list, with one copy left on purpose: the
   Postgres enum in schema.ts, which drizzle-kit reads with its own loader.
   The first test here is what stops those two drifting.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the list and the database enum', () => {
  it('hold exactly the same roles, in the same order', () => {
    // Order matters: it is the enum's sort order in Postgres, and the
    // migration placed 'manager' BEFORE 'editor' deliberately.
    expect(userRole.enumValues).toEqual([...ROLES]);
  });

  it('covers every role in the picker, and the picker invents none', () => {
    expect([...ROLE_CHOICES.map((c) => c.value)].sort()).toEqual([...ROLES].sort());
  });

  it('offers the safe choice first and the dangerous one last', () => {
    expect(ROLE_CHOICES.at(0)?.value).toBe('reviewer');
    expect(ROLE_CHOICES.at(-1)?.value).toBe('admin');
  });

  it('gives every role a label and a hint worth reading', () => {
    for (const choice of ROLE_CHOICES) {
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.hint.length).toBeGreaterThan(10);
    }
    expect(roleLabel('admin')).toBe('Administrator');
  });
});

describe('isRole', () => {
  it('accepts every real role', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
  });

  it('refuses anything else, including the shapes an attacker would try', () => {
    for (const value of ['superuser', 'Admin', '', null, undefined, 0, {}, ['admin']]) {
      expect(isRole(value)).toBe(false);
    }
  });
});

describe('every permission', () => {
  it('is granted only to roles that exist', () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      for (const role of roles as readonly string[]) {
        expect(ROLES, `${permission} grants unknown role "${role}"`).toContain(role);
      }
    }
  });

  it('is held by the administrator', () => {
    // An administrator locked out of something would have nobody to unlock it.
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can({ role: 'admin' }, permission), `admin lacks ${permission}`).toBe(true);
    }
  });
});

describe('the boundaries that must not move', () => {
  const only = (permission: keyof typeof PERMISSIONS) =>
    ROLES.filter((role) => can({ role }, permission));

  it('keeps accounts with the administrator alone', () => {
    // An account that can create accounts is an account that can promote
    // itself, so this never widens.
    expect(only('users:read')).toEqual(['admin']);
    expect(only('users:write')).toEqual(['admin']);
    expect(only('users:delete')).toEqual(['admin']);
  });

  it('keeps personal data export and erasure with the administrator', () => {
    expect(only('newsletter:write')).toEqual(['admin']);
    expect(only('submissions:write')).toEqual(['admin']);
    // A job application is a named person's CV, phone number and covering
    // letter. It follows these two, not the job advert it answers.
    expect(only('applications:write')).toEqual(['admin']);
  });

  /* An author writes a job advert and cannot publish it — the same split as
     pages and posts, and the reason `jobs:publish` exists separately. */
  it('does not let an author put a role on the careers page', () => {
    expect(can({ role: 'author' }, 'jobs:write')).toBe(true);
    expect(can({ role: 'author' }, 'jobs:publish')).toBe(false);
    expect(can({ role: 'reviewer' }, 'jobs:write')).toBe(false);
  });

  it('keeps the audit log, security, backups, updates and settings admin-only', () => {
    for (const permission of [
      'audit:read',
      'security:read',
      'security:write',
      'backups:read',
      'backups:write',
      'transfer:read',
      'transfer:write',
      'updates:read',
      'updates:write',
      'settings:write',
      'email:read',
      'email:write',
    ] as const) {
      expect(only(permission), permission).toEqual(['admin']);
    }
  });

  it('does not let an author publish anything', () => {
    expect(can({ role: 'author' }, 'pages:write')).toBe(true);
    expect(can({ role: 'author' }, 'posts:write')).toBe(true);
    expect(can({ role: 'author' }, 'pages:publish')).toBe(false);
    expect(can({ role: 'author' }, 'posts:publish')).toBe(false);
  });

  it('does not let a reviewer change any content', () => {
    for (const permission of [
      'pages:write',
      'pages:delete',
      'posts:write',
      'posts:delete',
      'media:write',
      'categories:write',
    ] as const) {
      expect(can({ role: 'reviewer' }, permission), permission).toBe(false);
    }
    // It may still read, and still handle enquiries — that is the point of it.
    expect(can({ role: 'reviewer' }, 'pages:read')).toBe(true);
    expect(can({ role: 'reviewer' }, 'enquiries:write')).toBe(true);
    expect(can({ role: 'reviewer' }, 'profile:write')).toBe(true);
  });

  it('gives a manager the site’s chrome but not its administration', () => {
    for (const permission of ['appearance:write', 'navigation:write', 'popups:write', 'redirects:write'] as const) {
      expect(can({ role: 'manager' }, permission), permission).toBe(true);
    }
    for (const permission of ['users:write', 'security:write', 'backups:write', 'settings:write'] as const) {
      expect(can({ role: 'manager' }, permission), permission).toBe(false);
    }
  });

  it('leaves the two original roles exactly as they were', () => {
    // Adding roles must not have shifted anybody's access. An editor writes
    // and publishes; neither touches accounts or the site's administration.
    for (const permission of ['pages:write', 'pages:publish', 'posts:publish', 'media:delete'] as const) {
      expect(can({ role: 'editor' }, permission), permission).toBe(true);
    }
    for (const permission of ['users:write', 'appearance:write', 'audit:read'] as const) {
      expect(can({ role: 'editor' }, permission), permission).toBe(false);
    }
  });

  it('refuses everything to nobody at all', () => {
    for (const permission of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(can(null, permission), permission).toBe(false);
      expect(can(undefined, permission), permission).toBe(false);
    }
  });
});

describe('ownsOrAdmin', () => {
  const mine = 'user-1';

  it('lets an admin and a manager act on anything', () => {
    for (const role of ['admin', 'manager'] as Role[]) {
      expect(ownsOrAdmin({ id: mine, role }, 'someone-else')).toBe(true);
      expect(ownsOrAdmin({ id: mine, role }, null)).toBe(true);
    }
  });

  it('limits everybody else to what they authored', () => {
    for (const role of ['editor', 'author', 'reviewer'] as Role[]) {
      expect(ownsOrAdmin({ id: mine, role }, mine)).toBe(true);
      expect(ownsOrAdmin({ id: mine, role }, 'someone-else')).toBe(false);
      // An unowned row is nobody's, not everybody's.
      expect(ownsOrAdmin({ id: mine, role }, null)).toBe(false);
    }
  });

  it('refuses nobody at all', () => {
    expect(ownsOrAdmin(null, mine)).toBe(false);
  });
});
