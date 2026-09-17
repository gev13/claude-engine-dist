import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STEPS, pickPm2Process, reconcile, type RunState } from '@/server/engine/update';
import { ENGINE_VERSION } from '@/lib/version';

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

/* ═══════════════════════════════════════════════════════════════════════════
   The run that could never record its own success
   ───────────────────────────────────────────────────────────────────────────
   `pm2 reload` restarts the process running the update, so the two writes
   that mark a run finished never happen. A real site was left showing seven
   green steps and a spinner on `reload` for ever — and `preflight` refuses
   while a run says "running", so the panel could never update that site
   again, with no button offered to clear it.

   The update had in fact succeeded. `reconcile` settles it on read, from
   evidence rather than optimism: the process answering is the one pm2 just
   started, so its own ENGINE_VERSION is what the reload actually achieved.
   ═══════════════════════════════════════════════════════════════════════════ */

const running = (over: Partial<RunState> = {}): RunState => ({
  status: 'running',
  target: ENGINE_VERSION,
  step: 'reload',
  log: [{ step: 'build', ok: true, detail: 'Rebuilt the site.' }],
  ...over,
});

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

describe('a run interrupted by its own reload', () => {
  it('is read as done once this process is running the version it was taking', () => {
    const out = reconcile(running(), minutesAgo(1));
    expect(out.status).toBe('done');
    expect(out.step).toBeUndefined();
    // And it says why, rather than silently appearing to have finished.
    expect(out.log.at(-1)!.detail).toContain(ENGINE_VERSION);
    expect(out.log.at(-1)!.ok).toBe(true);
  });

  /* The whole point: `preflight` refuses while a run is "running", so a row
     that can never close locks the site out of every later update. */
  it('stops blocking the next update', () => {
    expect(reconcile(running(), minutesAgo(1)).status).not.toBe('running');
  });

  it('is left alone while the reload is still in flight', () => {
    // The old process is still serving, so its version is not the target yet.
    const out = reconcile(running({ target: '99.0.0' }), minutesAgo(1));
    expect(out.status).toBe('running');
  });

  it('never touches a run that already finished', () => {
    for (const status of ['idle', 'done', 'failed'] as const) {
      const state = { ...running(), status };
      expect(reconcile(state, minutesAgo(999)).status).toBe(status);
    }
  });
});

describe('a run whose process went away', () => {
  /* A reboot during `npm ci`, or the build killed for memory: no version to
     compare against, and the only evidence is silence. */
  it('is presumed dead after long enough, so it stops refusing later updates', () => {
    const out = reconcile(running({ step: 'install', target: '99.0.0' }), minutesAgo(90));
    expect(out.status).toBe('failed');
    expect(out.error).toContain('install');
  });

  it('is patient enough for a slow build, which writes nothing for twenty minutes', () => {
    const out = reconcile(running({ step: 'build', target: '99.0.0' }), minutesAgo(25));
    expect(out.status).toBe('running');
  });

  it('keeps the log, so the screen still says how far it got', () => {
    const out = reconcile(running({ step: 'install', target: '99.0.0' }), minutesAgo(90));
    expect(out.log).toHaveLength(1);
  });
});

describe('reconciling is a read, not a write', () => {
  it('never mutates the stored state', () => {
    const state = running();
    const before = JSON.stringify(state);
    reconcile(state, minutesAgo(1));
    // A restart must not be able to rewrite history.
    expect(JSON.stringify(state)).toBe(before);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Where a release comes from, and proving it is the one it claims
   ───────────────────────────────────────────────────────────────────────────
   The updater assumed `origin` carried the release tags. That is true for a
   site cloned from the distribution and false for one living in its own
   repository, where it failed with `pathspec 'v2.1.0' did not match any
   file(s) known to git` — a message about git rather than about the site.

   Worse was the workaround. Fetching the engine's tags writes them into the
   site's own tag namespace, so `v2.1.0` could mean the engine's commit *or*
   the site's merge of it — different trees, and checking out the wrong one
   silently drops the site's own deployment settings while reporting success.

   These pin both halves: fetch one ref rather than every tag, and read the
   version out of the commit before checking it out.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('fetching a release', () => {
  it('never writes the remote’s tags into this checkout', () => {
    const fetchStep = source.slice(source.indexOf("case 'fetch'"), source.indexOf("case 'checkout'"));
    expect(fetchStep).not.toContain("'--tags'");
    // One ref, by its full path, so nothing is guessed at.
    expect(fetchStep).toContain('refs/tags/');
  });

  it('takes the remote from configuration rather than assuming origin', () => {
    const fetchStep = source.slice(source.indexOf("case 'fetch'"), source.indexOf("case 'checkout'"));
    expect(fetchStep).toContain('ENGINE_RELEASE_REMOTE');
  });

  /* The old message named a pathspec. The new one names the thing to fix. */
  it('explains a missing tag in terms of the site, not of git', () => {
    const fetchStep = source.slice(source.indexOf("case 'fetch'"), source.indexOf("case 'checkout'"));
    expect(fetchStep).toMatch(/merged and tagged there first/);
  });
});

describe('proving the tag before checking it out', () => {
  const checkoutStep = source.slice(source.indexOf("case 'checkout'"), source.indexOf("case 'install'"));

  it('reads the version out of the commit itself', () => {
    expect(checkoutStep).toContain('FETCH_HEAD:engine/package.json');
  });

  it('refuses when the tree is not the version the tag claims', () => {
    expect(checkoutStep).toMatch(/points at a tree whose version is/);
    // Said explicitly, because the operator's next question is "what broke?"
    expect(checkoutStep).toContain('Nothing has been changed');
  });

  /* The comparison has to happen before the working tree moves, or the
     "nothing has been changed" promise is a lie. */
  it('checks the version before it checks anything out', () => {
    // Against the git command, not the `case` label that opens the block.
    expect(checkoutStep.indexOf('engine/package.json')).toBeLessThan(checkoutStep.indexOf("git(['checkout'"));
  });

  it('checks out the fetched commit, not a local tag of the same name', () => {
    expect(checkoutStep).toContain("'FETCH_HEAD'");
  });

  /* The failure that took a site's deployment settings: a release checked out
     over commits only that site had. Whoever owns the site decides how a
     release combines with their own work — that is a merge, and a merge
     belongs where somebody can resolve a conflict, not on a production server
     part-way through an update. */
  it('refuses to check out a release that would discard the site’s own commits', () => {
    expect(checkoutStep).toContain('FETCH_HEAD..HEAD');
    expect(checkoutStep).toMatch(/would discard them/);
    expect(checkoutStep).toContain('Nothing has been changed');
  });

  it('counts those commits before moving the working tree', () => {
    expect(checkoutStep.indexOf('FETCH_HEAD..HEAD')).toBeLessThan(checkoutStep.indexOf("git(['checkout'"));
  });
});
