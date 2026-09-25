import { describe, expect, it } from 'vitest';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/server/db/schema';
import { checkArchive, checkSetting, normaliseRow, type ExistingSnapshot } from '@/server/engine/importCheck';
import { CONTENT_TABLES } from '@/server/engine/transfer';
import { reportCsv, reportTotals } from '@/lib/importReport';

/* 2.20 (T36) — an archive's rows are checked like the editor's saves before
   anything is written, and a merge matches what is already here. */

const TABLES: Record<string, PgTable> = {
  media: schema.media,
  categories: schema.categories,
  pages: schema.pages,
  posts: schema.posts,
  post_categories: schema.postCategories,
  projects: schema.projects,
  project_terms: schema.projectTerms,
  project_term_links: schema.projectTermLinks,
  saved_blocks: schema.savedBlocks,
  jobs: schema.jobs,
  redirects: schema.redirects,
};
const tables = CONTENT_TABLES.map((name) => ({ name, table: TABLES[name]! }));

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = (documents: Record<string, unknown[]>, opts: { strategy?: 'replace' | 'merge'; existing?: ExistingSnapshot; files?: string[] } = {}) =>
  checkArchive({
    strategy: opts.strategy ?? 'replace',
    tables,
    documents,
    existing: opts.existing ?? {},
    hasFile: (f) => (opts.files ?? []).includes(f),
    allowRegex: false,
  });

const post = (n: number, extra: Record<string, unknown> = {}) => ({ id: ID(n), slug: `post-${n}`, title: `Post ${n}`, body: '<p>Hello world</p>', ...extra });

describe('a row against its table', () => {
  it('fills defaults, generates an id, converts dates and names unknown columns', () => {
    const result = normaliseRow(schema.posts, { slug: 'a', title: 'A', publishedAt: '2026-01-02T03:04:05Z', wpId: 12 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.values.publishedAt).toBeInstanceOf(Date);
    expect(result.values.status).toBeUndefined(); // the column default decides
    expect(result.ignored).toEqual(['wpId']);
  });

  it('refuses a missing required value, a wrong type, an overlong text and an unknown status', () => {
    expect(normaliseRow(schema.posts, { slug: 'a' })).toMatchObject({ ok: false, reason: 'title is required.' });
    expect(normaliseRow(schema.posts, { slug: 'a', title: 5 })).toMatchObject({ ok: false });
    expect(normaliseRow(schema.posts, { slug: 'a'.repeat(400), title: 'A' })).toMatchObject({ ok: false });
    expect(normaliseRow(schema.posts, { slug: 'a', title: 'A', status: 'live' })).toMatchObject({ ok: false });
    expect(normaliseRow(schema.posts, 'not a row')).toMatchObject({ ok: false });
  });
});

describe('the editor’s rules', () => {
  it('sanitise a post’s body and count its reading time again', () => {
    const words = Array.from({ length: 660 }, () => 'word').join(' ');
    const { prepared, report } = run({ posts: [post(1, { body: `<p>${words}</p><script>alert(1)</script>`, readingMinutes: 99 })] });
    const values = prepared.posts![0]!.values;
    expect(values.body).not.toContain('<script');
    expect(values.readingMinutes).toBe(3);
    expect(report.rejected).toEqual([]);
  });

  it('refuse a block no page could draw, and a slug not in its written form', () => {
    const { report } = run({
      pages: [
        { id: ID(1), slug: 'about', path: '/about', title: 'About', blocks: [{ id: 'b1', type: 'noSuchBlock', props: {} }] },
        { id: ID(2), slug: 'About Us', path: '/about-us', title: 'About us' },
        { id: ID(3), slug: 'team', path: '/team/', title: 'Team' },
      ],
    });
    expect(report.rejected.map((r) => r.row)).toEqual([1, 2, 3]);
    expect(report.tables.pages).toMatchObject({ total: 3, create: 0, failed: 3 });
  });

  it('hold a redirect to the checks a typed one meets', () => {
    const { report } = run({
      redirects: [
        { id: ID(1), fromPath: '/old', toPath: '/new' },
        { id: ID(2), fromPath: '/evil', toPath: '//evil.example' },
        { id: ID(3), fromPath: '^/a(.*)$', toPath: '/b', matchType: 'regex' },
      ],
    });
    expect(report.rejected.map((r) => r.row)).toEqual([2, 3]);
  });

  it('refuse one address twice in the same archive', () => {
    const { report } = run({ posts: [post(1), post(2, { slug: 'post-1' })] });
    expect(report.rejected).toMatchObject([{ row: 2, reason: expect.stringContaining('earlier') }]);
  });

  it('refuse a media row whose file is nowhere', () => {
    const media = { id: ID(1), filename: '2026/09/a.png', originalName: 'a.png', mimeType: 'image/png', extension: 'png', byteSize: 10 };
    expect(run({ media: [media] }).report.rejected).toHaveLength(1);
    expect(run({ media: [media] }, { files: ['2026/09/a.png'] }).report.rejected).toHaveLength(0);
    expect(run({ media: [{ ...media, filename: '../etc/passwd' }] }, { files: ['../etc/passwd'] }).report.rejected).toHaveLength(1);
  });

  it('refuse a saved block that contains itself', () => {
    const { report } = run({ saved_blocks: [{ id: ID(1), name: 'Loop', tree: [{ id: 's1', type: 'savedBlock', props: { savedBlockId: ID(1) } }] }] });
    expect(report.rejected[0]?.reason).toMatch(/itself/);
  });
});

describe('references', () => {
  it('refuse a link to a refused post, and clear an optional one to nothing', () => {
    const { report, prepared } = run({
      categories: [{ id: ID(10), slug: 'news', name: 'News' }],
      posts: [post(1, { primaryCategoryId: ID(99) }), post(2, { title: 7 })],
      post_categories: [
        { postId: ID(1), categoryId: ID(10) },
        { postId: ID(2), categoryId: ID(10) },
      ],
    });
    expect(prepared.posts![0]!.values.primaryCategoryId).toBeNull();
    expect(report.notes).toHaveLength(1);
    expect(report.rejected.map((r) => `${r.table}#${r.row}`)).toEqual(['posts#2', 'post_categories#2']);
  });

  it('find a parent in a table the archive does not replace', () => {
    const { report } = run({ post_categories: [{ postId: ID(1), categoryId: ID(10) }] }, { existing: { posts: [{ id: ID(1) }], categories: [{ id: ID(10) }] } });
    expect(report.rejected).toEqual([]);
  });
});

describe('a merge', () => {
  it('updates the row with the same address, and carries its links across', () => {
    const existing: ExistingSnapshot = { posts: [{ id: ID(50), slug: 'post-1', locale: 'en' }], categories: [{ id: ID(10), slug: 'news', locale: 'en' }], post_categories: [] };
    const { prepared, report } = run(
      {
        posts: [post(1), post(2)],
        post_categories: [{ postId: ID(1), categoryId: ID(10) }],
      },
      { strategy: 'merge', existing },
    );
    expect(prepared.posts!.map((p) => [p.values.id, p.action])).toEqual([
      [ID(50), 'update'],
      [ID(2), 'create'],
    ]);
    expect(prepared.post_categories![0]!.values.postId).toBe(ID(50));
    expect(reportTotals(report)).toMatchObject({ create: 2, update: 1, failed: 0 });
  });

  it('leaves a file it already has, and points the archive’s pages at it', () => {
    const sum = 'a'.repeat(64);
    const existing: ExistingSnapshot = { media: [{ id: ID(70), filename: '2025/01/old.png', url: '/media/2025/01/old.png', checksum: sum }] };
    const { prepared, urlMap, skippedMedia } = run(
      {
        media: [{ id: ID(1), filename: '2026/09/new.png', originalName: 'n.png', mimeType: 'image/png', extension: 'png', byteSize: 1, checksum: sum }],
        pages: [{ id: ID(2), slug: 'home', path: '/', title: 'Home', blocks: [{ id: 'h1', type: 'image', props: { url: '/media/2026/09/new.png', alt: '' } }], seo: { ogImageId: ID(1) } }],
      },
      { strategy: 'merge', existing },
    );
    expect(prepared.media![0]!.action).toBe('skip');
    expect(skippedMedia).toEqual(['2026/09/new.png']);
    expect(urlMap).toEqual({ '/media/2026/09/new.png': '/media/2025/01/old.png' });
    const page = prepared.pages![0]!.values;
    expect(JSON.stringify(page.blocks)).toContain('/media/2025/01/old.png');
    expect((page.seo as { ogImageId: string }).ogImageId).toBe(ID(70));
  });

  it('leaves a link pair it already has', () => {
    const existing: ExistingSnapshot = { posts: [{ id: ID(1) }], categories: [{ id: ID(10) }], post_categories: [{ postId: ID(1), categoryId: ID(10) }] };
    const { prepared } = run({ post_categories: [{ postId: ID(1), categoryId: ID(10) }] }, { strategy: 'merge', existing });
    expect(prepared.post_categories![0]!.action).toBe('skip');
  });
});

describe('settings', () => {
  it('are held to their own screen’s schema', () => {
    expect(checkSetting('theme', {}).ok).toBe(true);
    expect(checkSetting('theme', { chrome: { cursor: { style: 'sparkles' } } }).ok).toBe(false);
    expect(checkSetting('site.name', 'Northfold').ok).toBe(true);
    expect(checkSetting('site.name:hy', 'Northfold').ok).toBe(true);
    expect(checkSetting('site.nonsense', 'x').ok).toBe(false);
    expect(checkSetting('popups', [{ id: 'p1', name: 'Hello', blocks: [{ id: 'x', type: 'noSuchBlock', props: {} }] }]).ok).toBe(false);
  });
});

describe('the report', () => {
  it('downloads as a CSV no spreadsheet will run', () => {
    const { report } = run({ posts: [post(1, { slug: '=cmd' })] });
    const csv = reportCsv(report);
    expect(csv.split('\r\n')[0]).toBe('"table","row","item","outcome","detail"');
    expect(csv).toContain(`"'=cmd"`);
  });
});
