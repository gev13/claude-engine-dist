import { readFileSync } from 'node:fs';
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
    // The tag is the only interpolation that reaches a command argument.
    const argInterpolations = source.match(/await (?:git|run)\([^)]*\$\{(?!target\})/g) ?? [];
    expect(argInterpolations).toEqual([]);
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
