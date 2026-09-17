import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STEPS, pickPm2Process } from '@/server/engine/update';

/* ═══════════════════════════════════════════════════════════════════════════
   Updating from the admin panel
   ───────────────────────────────────────────────────────────────────────────
   Two of these steps have taken a live site down, so what they decide is
   pinned here rather than left to the shell.

   **Reload.** The step ran `pm2 reload engine` — a name it assumed. On a
   server whose process was called something else, the reload failed, the
   failure was caught, and the step reported "Built and ready". The new build
   sat on disk while the old process went on serving from memory. The name is
   now found from the working directory, which also means a server hosting two
   sites under one pm2 cannot have the wrong one reloaded.

   **Migrate.** The step swallowed every error from the migrator and rebuilt
   anyway, which can leave new code against an old schema. It now baselines
   first and lets either failure stop the update.
   ═══════════════════════════════════════════════════════════════════════════ */

const source = readFileSync(fileURLToPath(new URL('../src/server/engine/update.ts', import.meta.url)), 'utf8');

const HERE = '/var/www/xeriglux/engine';
const entry = (name: string, cwd: string) => ({ name, pm2_env: { pm_cwd: cwd } });

describe('finding the process to reload', () => {
  it('finds the site running from this directory, whatever it is called', () => {
    const list = [entry('gameguardz', '/var/www/gameguardz/engine'), entry('xeriglux', HERE)];
    expect(pickPm2Process(list, HERE)).toBe('xeriglux');
  });

  /* The case that broke a real site: two sites under one pm2, and neither
     called "engine". Reloading the wrong one would restart somebody else's
     site and still leave this one stale. */
  it('never reaches for another site on the same server', () => {
    const list = [entry('gameguardz', '/var/www/gameguardz/engine')];
    expect(pickPm2Process(list, HERE)).toBeNull();
  });

  it('does not assume a process called "engine" is the right one', () => {
    const list = [entry('engine', '/var/www/somewhere-else/engine')];
    expect(pickPm2Process(list, HERE)).toBeNull();
  });

  it('says nothing rather than guessing when pm2 has nothing to say', () => {
    expect(pickPm2Process([], HERE)).toBeNull();
    expect(pickPm2Process(null as never, HERE)).toBeNull();
    expect(pickPm2Process([{}, { pm2_env: {} }], HERE)).toBeNull();
  });

  /* An index is not stable across restarts, so an entry with no usable name
     is skipped rather than reloaded positionally. */
  it('skips an entry with no name even when the directory matches', () => {
    expect(pickPm2Process([{ pm2_env: { pm_cwd: HERE } }], HERE)).toBeNull();
    expect(pickPm2Process([entry('', HERE)], HERE)).toBeNull();
  });
});

describe('the steps, in order', () => {
  it('migrates before it builds, and builds before it reloads', () => {
    const order = STEPS as readonly string[];
    expect(order.indexOf('migrate')).toBeLessThan(order.indexOf('build'));
    expect(order.indexOf('build')).toBeLessThan(order.indexOf('reload'));
    // And a backup is taken before anything is touched.
    expect(order.indexOf('backup')).toBeLessThan(order.indexOf('checkout'));
  });

  /* A database built with `push` has no journal, so the migrator refuses to
     run until baseline records what is verifiably already there. Getting
     these the wrong way round is the difference between an update that works
     and one that leaves new code on an old schema. */
  it('baselines before it migrates', () => {
    const migrate = source.slice(source.indexOf("case 'migrate'"), source.indexOf("case 'build'"));
    expect(migrate).toContain('baseline-migrations.mjs');
    expect(migrate.indexOf('baseline-migrations.mjs')).toBeLessThan(migrate.indexOf("'drizzle-kit', 'migrate'"));
  });

  /* The bug itself: `.catch(() => undefined)` around the migrator meant a
     database that could not be brought up to date was not a reason to stop. */
  it('does not swallow a failed migration', () => {
    const migrate = source.slice(source.indexOf("case 'migrate'"), source.indexOf("case 'build'"));
    expect(migrate).not.toMatch(/\.catch\s*\(/);
  });

  it('never hardcodes a process name', () => {
    expect(source).not.toMatch(/'reload',\s*'engine'/);
  });
});
