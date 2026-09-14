import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   Nobody registers themselves
   ───────────────────────────────────────────────────────────────────────────
   An account can come into existence in exactly two places that are reachable
   over HTTP:

     • the installer, and only while the site is not installed;
     • the admin panel, and only for somebody holding `users:write`, which is
       an administrator.

   (A third, `server/db/seed.ts`, is a script somebody runs on the machine. It
   is not a route and cannot be reached from outside.)

   There is no sign-up page and no registration endpoint, and this test is here
   so that stays true. A rule enforced by a test survives the person who wrote
   it down; a rule in a document does not.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = path.join(process.cwd(), 'src', 'app', 'api');

/** Every file under src/app/api, recursively. */
function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const files = routeFiles(API);
const relative = (file: string) => path.relative(API, file).split(path.sep).join('/');

describe('account creation', () => {
  it('happens in exactly two routes, and they are the ones we think', () => {
    const creators = files
      .filter((file) => /\.insert\(\s*users\s*\)/.test(readFileSync(file, 'utf8')))
      .map(relative)
      .sort();

    expect(creators).toEqual(['admin/users/route.ts', 'install/route.ts']);
  });

  it('has no registration endpoint of any spelling', () => {
    const named = files
      .map(relative)
      .filter((file) => /regist|signup|sign-up|sign_up|\bjoin\b|create-account/i.test(file));

    expect(named).toEqual([]);
  });

  it('keeps the admin route behind users:write', () => {
    const body = readFileSync(path.join(API, 'admin', 'users', 'route.ts'), 'utf8');
    // The POST handler must ask for the permission, not merely for a session.
    expect(body).toMatch(/requireUser\(\s*request\s*,\s*'users:write'\s*\)/);
  });

  it('keeps the installer behind the not-installed gate', () => {
    const body = readFileSync(path.join(API, 'install', 'route.ts'), 'utf8');
    expect(body).toMatch(/getInstallState\(\)/);
    expect(body).toMatch(/state\.installed/);
    // And it re-checks inside the transaction, so two calls cannot both win.
    expect(body).toMatch(/count\(\*\)/);
  });
});

describe('users:write', () => {
  it('belongs to the administrator alone', () => {
    // Read as text rather than imported: rbac.ts is server-only, and the point
    // is the declaration itself, not what a running app resolves it to.
    const rbac = readFileSync(path.join(process.cwd(), 'src', 'server', 'auth', 'rbac.ts'), 'utf8');

    for (const permission of ['users:read', 'users:write', 'users:delete']) {
      const line = new RegExp(`'${permission}':\\s*\\[([^\\]]*)\\]`).exec(rbac);
      expect(line, `${permission} is missing from PERMISSIONS`).not.toBeNull();
      expect(line![1]!.replace(/['\s]/g, '').split(',').filter(Boolean)).toEqual(['admin']);
    }
  });
});
