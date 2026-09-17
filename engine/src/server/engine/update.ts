import 'server-only';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ENGINE_VERSION, isVersion } from '@/lib/version';
import { createBackup } from '@/server/engine/backup';
import { getUpdateState } from '@/server/engine/releases';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Taking an update (package 6, phase D)
   ───────────────────────────────────────────────────────────────────────────
   This runs git, npm and a build on the server, which is remote code
   execution by design — the same capability WordPress calls "update now", and
   it deserves the same suspicion. Four rules hold it in:

     1. It is off unless the operator sets ENGINE_UPDATE_ENABLED.
     2. Nothing from the request reaches a command line. The only variable is
        a version, which must match the semver pattern *and* appear in the
        feed this site already fetched; the remote is whatever the checkout
        already has.
     3. It refuses a working tree with local changes, or one pointing at a
        different remote. `git reset --hard` belongs to a deploy pipeline that
        owns the server, not to a button in a web page.
     4. A backup is taken before anything is touched.

   There is no automatic rollback. If a step fails the run stops, the backup
   stays, and the screen says which step it was — restoring is a deliberate
   act, and pretending otherwise is how sites get lost.
   ═══════════════════════════════════════════════════════════════════════════ */

const run = promisify(execFile);

export const UPDATE_RUN_KEY = 'engine.update.run';

export const STEPS = ['checks', 'backup', 'fetch', 'checkout', 'install', 'migrate', 'build', 'reload'] as const;
export type Step = (typeof STEPS)[number];

export const runStateSchema = z.object({
  status: z.enum(['idle', 'running', 'done', 'failed']).default('idle'),
  /** The version being taken, once the checks have passed. */
  target: z.string().optional(),
  fromVersion: z.string().optional(),
  step: z.enum(STEPS).optional(),
  /** One line per step, so the screen can show what happened rather than a spinner. */
  log: z.array(z.object({ step: z.string(), ok: z.boolean(), detail: z.string().max(600) })).max(40).default([]),
  backup: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  startedByEmail: z.string().optional(),
});

export type RunState = z.output<typeof runStateSchema>;

export const IDLE: RunState = runStateSchema.parse({});

/**
 * How long a run may go without writing a line before it is presumed dead.
 *
 * Longer than the longest single step, because a step writes nothing while it
 * runs: the build alone is allowed twenty minutes. This is the backstop for a
 * run whose process went away without reaching the reload — a reboot during
 * `npm ci`, an out-of-memory kill during the build — where there is no
 * version to compare against and the only evidence is silence.
 */
const PRESUMED_DEAD_MS = 45 * 60_000;

/**
 * Read a run back as what it actually was, not as what it managed to write.
 *
 * The last step restarts the process executing it. `pm2 reload` kills this
 * code mid-`await`, so the two writes that would have marked the run finished
 * never happen, and the row stays `running` at `reload` for ever: the screen
 * spins on a site that updated perfectly, and `preflight` then refuses every
 * later update because one is "already running". There is no way out of that
 * from the panel. Every pm2 deployment meets it on its first success.
 *
 * It is settled with evidence rather than optimism. The process answering now
 * is the one pm2 started, so its own `ENGINE_VERSION` says what the reload
 * did: equal to the target means the checkout and the restart both happened,
 * which is exactly what "done" claims. A reload that genuinely fails does not
 * come through here at all — the process survives, `run()` rejects, and the
 * catch block records a real failure with the reason.
 *
 * Reconciled on read, never written back. A restart must not be able to
 * rewrite history, and the next `save` from a live run would overwrite this
 * anyway.
 */
export function reconcile(state: RunState, updatedAt: Date | null): RunState {
  if (state.status !== 'running') return state;

  if (state.step === 'reload' && state.target && ENGINE_VERSION === state.target) {
    return {
      ...state,
      status: 'done',
      step: undefined,
      finishedAt: updatedAt ? updatedAt.toISOString() : new Date().toISOString(),
      log: [
        ...state.log,
        {
          step: 'reload',
          ok: true,
          detail: `Reloaded — this site is running ${ENGINE_VERSION}. The restart ended the run before it could record itself.`,
        },
      ],
    };
  }

  const silentFor = updatedAt ? Date.now() - updatedAt.getTime() : 0;
  if (silentFor > PRESUMED_DEAD_MS) {
    return {
      ...state,
      status: 'failed',
      error: `Nothing has been heard from this update since ${state.step ?? 'it started'}. The process it was running in has gone. Check the site, then clear this record.`,
    };
  }

  return state;
}

export async function getRunState(): Promise<RunState> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, UPDATE_RUN_KEY)).limit(1);
    if (!row) return IDLE;
    const parsed = runStateSchema.safeParse(row.value);
    return parsed.success ? reconcile(parsed.data, row.updatedAt ?? null) : IDLE;
  } catch {
    return IDLE;
  }
}

async function save(state: RunState): Promise<RunState> {
  await db
    .insert(settings)
    .values({ key: UPDATE_RUN_KEY, value: state })
    .onConflictDoUpdate({ target: settings.key, set: { value: state, updatedAt: new Date() } });
  return state;
}

/** The kit root: this file lives in engine/src/server/engine, the checkout is two levels above. */
function repoRoot(): string {
  return path.resolve(process.cwd(), '..');
}

function appDir(): string {
  return process.cwd();
}

/**
 * The pm2 process serving *this* directory, or null.
 *
 * Matched on the working directory rather than the name, because the name is
 * whatever whoever installed it chose. A server running several sites under
 * pm2 must not have the wrong one reloaded.
 */
export type Pm2Entry = { name?: string; pm2_env?: { pm_cwd?: string } };

/**
 * Which of pm2's processes is this directory, given its `jlist` output.
 *
 * Pure and exported, because it is the decision that took a site down: this
 * step used to assume the name was "engine". The rest of the step is shelling
 * out, which a test cannot see — this is the part worth pinning.
 *
 * A server running several sites under one pm2 is the case that matters. The
 * match is on the working directory and never on the name, so the wrong site
 * cannot be reloaded; and an entry with no usable name is skipped rather than
 * reloaded by index, because an index is not stable across restarts.
 */
export function pickPm2Process(list: Pm2Entry[], cwd: string): string | null {
  if (!Array.isArray(list)) return null;
  const match = list.find(
    (entry) => entry?.pm2_env?.pm_cwd === cwd && typeof entry.name === 'string' && entry.name !== '',
  );
  return match?.name ?? null;
}

async function pm2ProcessName(): Promise<string | null> {
  try {
    const { stdout } = await run('pm2', ['jlist'], { cwd: appDir(), timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    return pickPm2Process(JSON.parse(stdout) as Pm2Entry[], appDir());
  } catch {
    // pm2 absent, or its output not what we expect. Either way: do not guess.
    return null;
  }
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: repoRoot(), timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

export type Refusal = { ok: false; reason: string };
export type Ready = { ok: true; target: string; remote: string };

/**
 * Everything that must be true before a single command runs. Returns the
 * reason in the words an administrator needs, not a stack trace.
 */
export async function preflight(target: string): Promise<Ready | Refusal> {
  if (!env.ENGINE_UPDATE_ENABLED) {
    return { ok: false, reason: 'Updating from the panel is switched off on this deployment.' };
  }
  if (!isVersion(target)) {
    return { ok: false, reason: 'That is not a version number.' };
  }

  // The version must be one this site has actually seen in the feed. A caller
  // cannot invent a tag and have it checked out.
  const state = await getUpdateState();
  const known = state.pending.some((release) => release.version === target) || state.latestVersion === target;
  if (!known) return { ok: false, reason: 'That version is not in the release list this site last read.' };

  const running = await getRunState();
  if (running.status === 'running') return { ok: false, reason: 'An update is already running.' };

  try {
    const inside = await git(['rev-parse', '--is-inside-work-tree']);
    if (inside !== 'true') return { ok: false, reason: 'This site is not a git checkout, so it cannot update itself.' };
  } catch {
    return { ok: false, reason: 'git is not available on this server.' };
  }

  const dirty = await git(['status', '--porcelain']);
  if (dirty) {
    return {
      ok: false,
      reason: 'This site has local changes. Commit or undo them first — an update will not overwrite your work.',
    };
  }

  let remote = '';
  try {
    remote = await git(['remote', 'get-url', 'origin']);
  } catch {
    return { ok: false, reason: 'This checkout has no origin to fetch from.' };
  }

  return { ok: true, target, remote };
}

type StepResult = { detail: string };

/** Each step, in order. Nothing here interpolates anything from a request. */
async function runStep(step: Step, target: string): Promise<StepResult> {
  switch (step) {
    case 'fetch':
      await git(['fetch', '--tags', '--prune', 'origin']);
      return { detail: 'Fetched tags from origin.' };

    case 'checkout': {
      // The tag is built from a validated semver, never from free text.
      const tag = `v${target}`;
      await git(['checkout', '--quiet', tag]);
      return { detail: `Checked out ${tag}.` };
    }

    case 'install':
      await run('npm', ['ci', '--omit=dev', '--include=dev'], { cwd: appDir(), timeout: 15 * 60_000, maxBuffer: 8 * 1024 * 1024 });
      return { detail: 'Installed dependencies.' };

    case 'migrate': {
      /* Baseline first, then migrate, and let either one fail loudly.
         
         This step used to swallow every error from the migrator, on the
         theory that a site built with `push` has no journal and the migrator
         would rightly complain. It does complain — and the update then
         carried on and rebuilt, leaving new code running against an old
         schema. A site went down that way. A database that cannot be brought
         up to date is a reason to stop, not a reason to continue.
         
         `db:baseline` is what makes the migrator usable on a `push`-built
         database: it records the migrations whose tables are *verifiably*
         already there and leaves the rest to be applied. It is a no-op on a
         database that already has history. */
      await run('node', ['scripts/baseline-migrations.mjs'], {
        cwd: appDir(),
        timeout: 5 * 60_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      await run('npx', ['drizzle-kit', 'migrate'], {
        cwd: appDir(),
        timeout: 10 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      await run('node', ['scripts/apply-sql.mjs'], { cwd: appDir(), timeout: 5 * 60_000, maxBuffer: 2 * 1024 * 1024 });
      return { detail: 'Applied database changes.' };
    }

    case 'build':
      await run('npm', ['run', 'build'], { cwd: appDir(), timeout: 20 * 60_000, maxBuffer: 8 * 1024 * 1024 });
      return { detail: 'Rebuilt the site.' };

    case 'reload': {
      /* The process is *found*, not assumed to be called "engine".
         
         This used to run `pm2 reload engine` and, when that failed, report
         "this deployment does not use pm2" — which on a server whose process
         is called something else was wrong in both directions: pm2 was there,
         and the update claimed to have finished while the site went on
         serving the code it had before. */
      const name = await pm2ProcessName();
      if (!name) {
        return {
          detail:
            'Built and ready. Nothing was restarted — no pm2 process was found running from this directory, so restart the site yourself to pick up the new version.',
        };
      }
      await run('pm2', ['reload', name, '--update-env'], { cwd: appDir(), timeout: 120_000 });
      return { detail: `Reloaded ${name} through pm2.` };
    }

    default:
      return { detail: '' };
  }
}

/**
 * Start an update and return immediately: the run outlives the request, and
 * the last step reloads the very process serving it. Progress goes to the
 * settings row the screen polls.
 */
export async function startUpdate(target: string, startedByEmail: string): Promise<RunState | Refusal> {
  const checks = await preflight(target);
  if (!checks.ok) return checks;

  const state = await save({
    status: 'running',
    target,
    fromVersion: ENGINE_VERSION,
    step: 'checks',
    log: [{ step: 'checks', ok: true, detail: `Clean checkout of ${checks.remote}.` }],
    startedAt: new Date().toISOString(),
    startedByEmail,
  });

  void (async () => {
    let current = state;
    try {
      const backup = await createBackup({ reason: `before updating to ${target}`, includeMedia: true });
      if (backup.status !== 'ready') throw new Error(`the backup failed (${backup.error ?? 'unknown'})`);
      current = await save({
        ...current,
        step: 'backup',
        backup: backup.filename,
        log: [...current.log, { step: 'backup', ok: true, detail: `Backed up to ${backup.filename}.` }],
      });

      for (const step of ['fetch', 'checkout', 'install', 'migrate', 'build', 'reload'] as Step[]) {
        current = await save({ ...current, step });
        const result = await runStep(step, target);
        current = await save({ ...current, log: [...current.log, { step, ok: true, detail: result.detail }] });
      }

      await save({ ...current, status: 'done', step: undefined, finishedAt: new Date().toISOString() });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The update failed.';
      await save({
        ...current,
        status: 'failed',
        error: reason.slice(0, 600),
        log: [...current.log, { step: current.step ?? 'unknown', ok: false, detail: reason.slice(0, 600) }],
        finishedAt: new Date().toISOString(),
      });
    }
  })();

  return state;
}

/** Put the panel back to a state where another attempt can be made. */
export async function clearRun(): Promise<RunState> {
  return save(IDLE);
}
