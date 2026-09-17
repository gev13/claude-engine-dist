import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STEPS } from '../src/server/engine/update';

/* ═══════════════════════════════════════════════════════════════════════════
   The update runner runs commands — so these are about what it cannot do
   ───────────────────────────────────────────────────────────────────────────
   Applying an update executes git, npm and a build on the server. That is the
   feature; the danger is anything from a request reaching a command line.
   These are source-level checks, deliberately: they fail the moment somebody
   reaches for a shell or builds an argument out of user input.
   ═══════════════════════════════════════════════════════════════════════════ */

const source = readFileSync(new URL('../src/server/engine/update.ts', import.meta.url), 'utf8');

describe('the steps', () => {
  it('take a backup before anything is changed', () => {
    const order = STEPS as readonly string[];
    expect(order.indexOf('backup')).toBeGreaterThan(-1);
    for (const destructive of ['checkout', 'install', 'migrate', 'build', 'reload']) {
      expect(order.indexOf('backup'), `backup must precede ${destructive}`).toBeLessThan(order.indexOf(destructive));
    }
  });

  it('check before they back up', () => {
    const order = STEPS as readonly string[];
    expect(order.indexOf('checks')).toBeLessThan(order.indexOf('backup'));
  });
});

describe('how commands are run', () => {
  it('never opens a shell', () => {
    expect(source).toContain('execFile');
    expect(source).not.toMatch(/\bexec\(/);
    expect(source).not.toContain('shell: true');
    expect(source).not.toContain('spawnSync');
  });

  it('builds the checkout tag from a validated version and nothing else', () => {
    expect(source).toContain('isVersion(target)');
    expect(source).toContain('const tag = `v${target}`');

    /* Only `target` and the `tag` built from it may be interpolated into a
       command argument. `tag` was allowed here when releases gained a
       configurable remote and the fetch had to name `refs/tags/${tag}` — the
       widening is deliberate and stays this narrow, because the whole point
       of the rule is that nothing else ever reaches a command. */
    const argInterpolations = source.match(/await (?:git|run)\([^)]*\$\{(?!target\}|tag\})/g) ?? [];
    expect(argInterpolations).toEqual([]);

    // And `tag` is only ever the validated version with a v in front.
    expect(source.match(/const tag = /g) ?? []).toHaveLength(source.match(/const tag = `v\$\{target\}`/g)?.length ?? 0);
  });

  /* The remote reaches a command as an argv element rather than an
     interpolation, so the rule above cannot see it. It is a name an operator
     set with `git remote add`, held to the characters a name may have — the
     URL behind it was never the panel's to choose. */
  it('takes the release remote from the environment, held to a name', () => {
    expect(source).toContain('env.ENGINE_RELEASE_REMOTE');
    const envSource = readFileSync(fileURLToPath(new URL('../src/lib/env.ts', import.meta.url)), 'utf8');
    const declaration = envSource.slice(envSource.indexOf('ENGINE_RELEASE_REMOTE'), envSource.indexOf('BACKUP_DIR'));
    expect(declaration).toContain('.regex(');
    expect(declaration).toContain("default('origin')");
  });

  it('refuses to run at all unless the deployment turned it on', () => {
    // Measured inside preflight: the git helper is defined above it, so
    // comparing positions across the whole file would prove nothing.
    const start = source.indexOf('export async function preflight');
    expect(start, 'preflight not found').toBeGreaterThan(-1);
    const body = source.slice(start);

    const switchAt = body.indexOf('ENGINE_UPDATE_ENABLED');
    const firstGitCall = body.indexOf('await git(');
    expect(switchAt).toBeGreaterThan(-1);
    expect(firstGitCall).toBeGreaterThan(-1);
    expect(switchAt).toBeLessThan(firstGitCall);
  });

  it('will not touch a checkout with local changes', () => {
    expect(source).toContain("'status', '--porcelain'");
    expect(source).toMatch(/local changes/i);
    // The pipeline's blunt instrument must never appear as an argument. Prose
    // about why it is not used is fine — hence matching arguments, not text.
    expect(source).not.toMatch(/\[\s*'reset'/);
    expect(source).not.toMatch(/'--hard'/);
  });

  it('only checks out a version the site has already seen in a feed', () => {
    expect(source).toContain('getUpdateState');
    expect(source).toMatch(/not in the release list/i);
  });

  it('promises no automatic rollback', () => {
    expect(source).toMatch(/no automatic rollback/i);
  });
});
