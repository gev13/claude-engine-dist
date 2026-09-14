import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, EXCLUDED_TABLES, isSafeArchiveName, manifestSchema, restoreRefusal } from '../src/server/engine/backup';

/* ═══════════════════════════════════════════════════════════════════════════
   The archive boundary (package 6)
   ───────────────────────────────────────────────────────────────────────────
   Downloading and restoring both take a file name. These tests are about the
   one rule that makes that safe: the name must be one this engine generated,
   and nothing else — no separators, no traversal, no surprises.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('archive names', () => {
  it('accepts what the engine writes', () => {
    expect(isSafeArchiveName('engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz')).toBe(true);
    expect(isSafeArchiveName('engine-1.2.3-rc.1-2026-09-14T10-00-00-000Z.tar.gz')).toBe(true);
  });

  it('refuses anything that could point elsewhere', () => {
    for (const name of [
      '../engine-0.1.0-x.tar.gz',
      'engine-0.1.0/../../etc/passwd',
      '/etc/passwd',
      'engine-0.1.0-x.tar.gz/../secret',
      'engine-0.1.0-x.zip',
      'manifest.json',
      '',
      'engine-0.1.0-x.tar.gz ',
      'engine-$(whoami).tar.gz',
      'engine-0.1.0-x.tar.gz\n',
    ]) {
      expect(isSafeArchiveName(name), name).toBe(false);
    }
  });
});

describe('what an archive holds', () => {
  it('keeps sessions, reset tokens, rate limits and the audit log out', () => {
    for (const table of EXCLUDED_TABLES) {
      expect(BACKUP_TABLES).not.toContain(table);
    }
    // The audit log especially: append-only means never restored over.
    expect(EXCLUDED_TABLES).toContain('audit_log');
  });

  it('writes parents before the rows that point at them', () => {
    const order = BACKUP_TABLES as readonly string[];
    expect(order.indexOf('users')).toBeLessThan(order.indexOf('pages'));
    expect(order.indexOf('media')).toBeLessThan(order.indexOf('pages'));
    expect(order.indexOf('posts')).toBeLessThan(order.indexOf('post_categories'));
    expect(order.indexOf('categories')).toBeLessThan(order.indexOf('post_categories'));
  });
});

describe('the manifest', () => {
  const good = {
    format: 1 as const,
    engineVersion: '0.1.0',
    takenAt: '2026-09-14T10:00:00.000Z',
    includesMedia: true,
    tables: { users: 2, pages: 10 },
    digests: { users: 'a'.repeat(64), pages: 'b'.repeat(64) },
  };

  it('accepts one this engine wrote', () => {
    expect(manifestSchema.safeParse(good).success).toBe(true);
    expect(restoreRefusal(manifestSchema.parse(good))).toBeNull();
  });

  it('refuses a layout it does not know', () => {
    expect(manifestSchema.safeParse({ ...good, format: 2 }).success).toBe(false);
  });

  it('refuses an archive that will not say which engine wrote it', () => {
    const vague = manifestSchema.parse({ ...good, engineVersion: 'main' });
    expect(restoreRefusal(vague)).toMatch(/which engine/i);
  });
});
