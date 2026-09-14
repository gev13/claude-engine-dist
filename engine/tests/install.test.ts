import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* The installer creates an administrator with no authentication, so its access
   control is entirely "this site is not installed yet". These tests assert the
   properties that makes safe, by reading the source — the behaviour depends on
   a database, but the shape of the guard should not be able to drift. */

const status = readFileSync('src/server/install/status.ts', 'utf8');
const route = readFileSync('src/app/api/install/route.ts', 'utf8');

describe('install gate', () => {
  it('treats both a marker row and an existing user as "installed"', () => {
    // Either fact alone closes the gate, so deleting one does not reopen it.
    expect(status).toContain('Boolean(marker) || n > 0');
  });

  it('re-checks inside the transaction that writes the account', () => {
    // Two requests can both pass a check made before either writes.
    expect(route).toContain('db.transaction');
    expect(route).toMatch(/transaction[\s\S]*count\(\*\)[\s\S]*ALREADY_INSTALLED/);
  });

  it('rate limits the endpoint', () => {
    expect(route).toContain('rateLimit(');
    expect(route).toContain('install:');
  });

  it('holds the first password to the same policy as every later one', () => {
    expect(route).toContain('checkPasswordPolicy');
  });

  it('writes the completion marker in the same transaction as the account', () => {
    const tx = route.slice(route.indexOf('db.transaction'), route.indexOf('return row!.id'));
    expect(tx).toContain('INSTALL_SETTING_KEY');
    expect(tx).toContain('insert(users)');
  });

  it('records the installation in the audit log', () => {
    expect(route).toContain("action: 'site.install'");
  });

  it('refuses to run when the schema is missing rather than half-installing', () => {
    expect(route).toContain('state.schemaReady');
  });
});

describe('install gate on the pages that matter', () => {
  const gated = [
    'src/app/admin/(panel)/layout.tsx',
    'src/app/admin/login/page.tsx',
    'src/app/(site)/layout.tsx',
    'src/app/install/page.tsx',
  ];

  it('every entry point checks the install state', () => {
    for (const file of gated) {
      expect(readFileSync(file, 'utf8'), file).toContain('isInstalled');
    }
  });

  it('the installer itself refuses to render once installed', () => {
    const page = readFileSync('src/app/install/page.tsx', 'utf8');
    expect(page).toContain("if (await isInstalled()) redirect('/admin')");
  });
});
