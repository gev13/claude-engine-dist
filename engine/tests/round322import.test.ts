import { describe, expect, it } from 'vitest';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/server/db/schema';
import { checkArchive, type ExistingSnapshot } from '@/server/engine/importCheck';
import { CONTENT_TABLES } from '@/server/engine/transfer';
import { pageCopyAddress } from '@/server/content/duplicate';
import { postReadingMinutes } from '@/lib/utils';

/* 3.22 — imports refuse what they used to accept silently, a merge replaces
   a post's links with the archive's, a written reading time is kept, and a
   duplicate's slug and path share one suffix. */

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
const run = (documents: Record<string, unknown[]>, opts: { strategy?: 'replace' | 'merge'; existing?: ExistingSnapshot } = {}) =>
  checkArchive({ strategy: opts.strategy ?? 'replace', tables, documents, existing: opts.existing ?? {}, hasFile: () => true, allowRegex: false });

describe('an import refuses what it used to take silently', () => {
  it('a post layout it does not know', () => {
    const { report } = run({ posts: [{ id: ID(1), slug: 'a', title: 'A', layout: 'magazine' }] });
    expect(report.rejected[0]?.reason).toMatch(/layout “magazine”/);
  });

  it('a project term that is neither a category nor a tag', () => {
    const { report } = run({ project_terms: [{ id: ID(2), slug: 'x', name: 'X', taxonomy: 'topic' }] });
    expect(report.rejected[0]?.reason).toMatch(/taxonomy “topic”/);
  });

  it('takes a synced saved block that is nowhere out of the page, and says so', () => {
    const blocks = [
      { id: 'a', type: 'savedBlock', props: { savedBlockId: ID(99) } },
      { id: 'b', type: 'spacer', props: {} },
    ];
    const { prepared, report } = run({ pages: [{ id: ID(3), slug: 'p', path: '/p', title: 'P', blocks }] });
    expect((prepared.pages![0]!.values.blocks as { id: string }[]).map((b) => b.id)).toEqual(['b']);
    expect(report.notes[0]?.note).toMatch(/saved block it used is not in the archive/);
    // One that the archive carries stays.
    const kept = run({ saved_blocks: [{ id: ID(99), name: 'CTA', tree: [] }], pages: [{ id: ID(3), slug: 'p', path: '/p', title: 'P', blocks }] });
    expect((kept.prepared.pages![0]!.values.blocks as unknown[]).length).toBe(2);
  });
});

describe('a merge replaces the links of the posts it carries', () => {
  it('writes the archive’s pairs for a post in the archive, and leaves other posts’ pairs alone', () => {
    const existing: ExistingSnapshot = {
      posts: [{ id: ID(1), slug: 'a', locale: 'en' }, { id: ID(2), slug: 'b', locale: 'en' }],
      categories: [{ id: ID(10), slug: 'x', locale: 'en' }],
      post_categories: [{ postId: ID(1), categoryId: ID(10) }, { postId: ID(2), categoryId: ID(10) }],
    };
    const { prepared } = run(
      { posts: [{ id: ID(1), slug: 'a', title: 'A' }], post_categories: [{ postId: ID(1), categoryId: ID(10) }, { postId: ID(2), categoryId: ID(10) }] },
      { strategy: 'merge', existing },
    );
    const actions = prepared.post_categories!.map((row) => `${row.values.postId === ID(1) ? 'carried' : 'other'}:${row.action}`);
    // The carried post's pair is written again (its old links are deleted first); the other post's existing pair is skipped.
    expect(actions).toEqual(['carried:create', 'other:skip']);
  });
});

describe('a reading time written on the post', () => {
  it('is kept; without one it is counted', () => {
    expect(postReadingMinutes('<p>word</p>', { readingMinutes: 17 })).toBe(17);
    expect(postReadingMinutes('<p>word</p>', {})).toBe(1);
    expect(postReadingMinutes('<p>word</p>', { readingMinutes: 0 })).toBe(1);
  });

  it('comes through an import', () => {
    const { prepared } = run({ posts: [{ id: ID(4), slug: 'r', title: 'R', body: '<p>short</p>', seo: { readingMinutes: 17 } }] });
    expect(prepared.posts![0]!.values.readingMinutes).toBe(17);
  });
});

describe('a duplicate’s address', () => {
  it('uses one suffix for slug and path, free for both', () => {
    const taken = [{ slug: 'seo', path: '/services/seo' }, { slug: 'seo-copy', path: '/other/seo-copy' }, { slug: 'x', path: '/services/seo-copy-2' }];
    expect(pageCopyAddress({ slug: 'seo', path: '/services/seo' }, taken)).toEqual({ slug: 'seo-copy-3', path: '/services/seo-copy-3' });
  });

  it('gives the home page a /home-copy that is unique too', () => {
    expect(pageCopyAddress({ slug: 'home', path: '/' }, [{ slug: 'home', path: '/' }])).toEqual({ slug: 'home-copy', path: '/home-copy' });
    expect(pageCopyAddress({ slug: 'home', path: '/' }, [{ slug: 'home', path: '/' }, { slug: 'home-copy', path: '/home-copy' }])).toEqual({ slug: 'home-copy-2', path: '/home-copy-2' });
  });
});
