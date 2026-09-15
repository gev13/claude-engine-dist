import { describe, expect, it } from 'vitest';
import {
  CONTENT_TABLES,
  NEVER_EXPORTED_SETTING_KEYS,
  PORTABLE_SETTING_KEYS,
  isPortableSettingKey,
  isSafeContentName,
  reattribute,
  unsafeEntries,
} from '@/server/engine/transfer';

/* ═══════════════════════════════════════════════════════════════════════════
   Content export and import
   ───────────────────────────────────────────────────────────────────────────
   The three things worth guarding here are the ones that are silent when they
   go wrong: a secret leaving the site inside an export, an archive from
   somebody else writing outside the directory it is unpacked into, and rows
   arriving that still name another site's accounts.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('which settings may travel', () => {
  it('carries the look and structure of a site', () => {
    for (const key of PORTABLE_SETTING_KEYS) expect(isPortableSettingKey(key)).toBe(true);
    for (const key of ['site.name', 'site.tagline', 'site.timeZone', 'site.dateFormat', 'site.contactEmail']) {
      expect(isPortableSettingKey(key)).toBe(true);
    }
  });

  it("never carries a secret, a policy, or one site's own state", () => {
    for (const key of NEVER_EXPORTED_SETTING_KEYS) {
      expect(isPortableSettingKey(key), key).toBe(false);
    }
  });

  it('refuses mail above all', () => {
    // The SMTP password inside it is encrypted with this site's key: on another
    // site it is not merely wrong, it is unreadable — and it is still a secret
    // in transit.
    expect(isPortableSettingKey('mail')).toBe(false);
  });

  it('refuses a key it has never heard of, rather than assuming it is safe', () => {
    for (const key of ['', 'secrets', 'stripe.apiKey', 'sitemap', 'siteish.name', 'Site.name']) {
      expect(isPortableSettingKey(key), key).toBe(false);
    }
  });
});

describe('archive names', () => {
  it('accepts the names this engine generates', () => {
    expect(isSafeContentName('content-1.1.0-2026-09-15T10-00-00-000Z.tar.gz')).toBe(true);
  });

  it('refuses a backup archive, which is a different thing entirely', () => {
    expect(isSafeContentName('engine-1.1.0-2026-09-15T10-00-00-000Z.tar.gz')).toBe(false);
  });

  it('refuses anything that could leave the directory', () => {
    for (const name of [
      '../content-1.tar.gz',
      'content-1/../../etc/passwd',
      '/etc/content-1.tar.gz',
      'content-1.tar.gz ',
      'content-1.tar.gz\n',
      'content-1.zip',
      'content-.tar.gz/../secret',
    ]) {
      expect(isSafeContentName(name), name).toBe(false);
    }
  });
});

describe('unsafeEntries', () => {
  it('passes an ordinary archive listing', () => {
    const listing = ['./', './manifest.json', './tables/pages.json', './media/', './media/2026/photo.jpg'].join('\n');
    expect(unsafeEntries(listing)).toEqual([]);
  });

  it('catches a path that climbs out of the staging directory', () => {
    const listing = ['./manifest.json', '../../etc/cron.d/evil'].join('\n');
    expect(unsafeEntries(listing)).toEqual(['../../etc/cron.d/evil']);
  });

  it('catches a climb buried in the middle of a path', () => {
    expect(unsafeEntries('media/a/../../../root/.ssh/authorized_keys')).toHaveLength(1);
  });

  it('catches an absolute path', () => {
    expect(unsafeEntries('/etc/passwd')).toEqual(['/etc/passwd']);
  });

  it('is not fooled by a name that merely contains two dots', () => {
    // `..` as a path segment is the danger; a filename with dots is ordinary.
    expect(unsafeEntries('media/my..photo.jpg')).toEqual([]);
    expect(unsafeEntries('media/...hidden')).toEqual([]);
  });

  it('ignores blank lines rather than reporting them', () => {
    expect(unsafeEntries('./manifest.json\n\n  \n./tables/pages.json')).toEqual([]);
  });
});

describe('reattribute', () => {
  const me = 'me-0000';

  it('re-points every named column at the importing administrator', () => {
    const rows = [
      { id: 'a', authorId: 'someone-else', title: 'One' },
      { id: 'b', authorId: 'another-person', title: 'Two' },
    ];
    expect(reattribute(rows, ['authorId'], me)).toEqual([
      { id: 'a', authorId: me, title: 'One' },
      { id: 'b', authorId: me, title: 'Two' },
    ]);
  });

  it('leaves a null alone — nobody is not somebody', () => {
    expect(reattribute([{ id: 'a', authorId: null }], ['authorId'], me)).toEqual([{ id: 'a', authorId: null }]);
  });

  it('does not invent a column that was not there', () => {
    expect(reattribute([{ id: 'a' }], ['authorId'], me)).toEqual([{ id: 'a' }]);
  });

  it('changes nothing when a table names no people', () => {
    const rows = [{ id: 'a', slug: 'x' }];
    expect(reattribute(rows, undefined, me)).toEqual(rows);
    expect(reattribute(rows, [], me)).toEqual(rows);
  });

  it('touches only the columns it was given', () => {
    const [row] = reattribute([{ id: 'a', authorId: 'x', uploadedById: 'y' }], ['authorId'], me) as Record<string, unknown>[];
    expect(row).toEqual({ id: 'a', authorId: me, uploadedById: 'y' });
  });

  it('does not mutate the rows it was handed', () => {
    const rows = [{ id: 'a', authorId: 'original' }];
    reattribute(rows, ['authorId'], me);
    expect(rows[0]!.authorId).toBe('original');
  });
});

describe('the tables that travel', () => {
  it('carries content and nothing that belongs to a person', () => {
    expect([...CONTENT_TABLES]).toEqual(['media', 'categories', 'pages', 'posts', 'post_categories', 'redirects']);
  });

  it('leaves out every table holding people, whether staff or visitors', () => {
    for (const table of [
      'users',
      'refresh_tokens',
      'password_reset_tokens',
      'audit_log',
      'enquiries',
      'newsletter_subscribers',
      'form_submissions',
      'blocked_ips',
      'content_revisions',
      'not_found_log',
      'rate_limits',
      'backups',
    ]) {
      expect(CONTENT_TABLES as readonly string[], table).not.toContain(table);
    }
  });

  it('lists parents before the rows that reference them', () => {
    const order = CONTENT_TABLES as readonly string[];
    // posts carry a cover image and a primary category; post_categories join
    // posts to categories. Insert a child first and Postgres refuses it.
    expect(order.indexOf('media')).toBeLessThan(order.indexOf('posts'));
    expect(order.indexOf('categories')).toBeLessThan(order.indexOf('posts'));
    expect(order.indexOf('posts')).toBeLessThan(order.indexOf('post_categories'));
    expect(order.indexOf('categories')).toBeLessThan(order.indexOf('post_categories'));
  });
});
