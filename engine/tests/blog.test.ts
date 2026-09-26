import { describe, expect, it } from 'vitest';
import { blogSchema, resolveBlog } from '../src/lib/blog';
import { parseTheme, themeSchema } from '../src/lib/theme';

describe('blog layouts (BL1, BL2)', () => {
  it('keeps the card grid and the standard post when nothing is saved', () => {
    expect(resolveBlog(undefined)).toEqual({
      index: 'grid',
      pagination: 'none',
      perPage: 9,
      post: 'standard',
      progress: false,
      // 2.13 — unset keeps the archive sizes the blog had before server paging.
      archivePerPage: undefined,
      archivePager: 'numbers',
      resultCount: false,
      // 2.18 — every extra off, related posts as they always were, cards as each layout drew them.
      share: { position: 'off', networks: ['facebook', 'x', 'pinterest', 'linkedin'] },
      toc: { position: 'off', levels: 'h2h3', title: undefined },
      prevNext: 'off',
      related: { source: 'kind', count: 3, layout: 'grid', title: undefined },
      authorBox: false,
      backLink: false,
      eyebrow: undefined,
      chipAll: true,
      chipResearch: 'auto',
      filterStyle: 'chips',
      archiveBreadcrumbs: false,
      card: {},
      categoryHero: 'title',
      // 2.22 — search below the bar and no featured post, as before.
      searchInBar: false,
      featured: false,
      // 3.3 — no bar on category pages, and the search at the end of the bar when it is there.
      archiveBar: false,
      searchBelow: false,
      off: false,
    });
  });

  it('is part of the theme, checked at the boundary', () => {
    expect(parseTheme({ blog: { index: 'wide', post: 'split' } }).blog).toEqual({ index: 'wide', post: 'split' });
    expect(themeSchema.safeParse({ blog: { index: 'masonry' } }).success).toBe(false);
    expect(themeSchema.safeParse({ blog: { post: 'magazine' } }).success).toBe(false);
  });

  it('keeps a page of posts between 2 and 24', () => {
    expect(blogSchema.safeParse({ perPage: 1 }).success).toBe(false);
    expect(blogSchema.safeParse({ perPage: 25 }).success).toBe(false);
    expect(blogSchema.safeParse({ perPage: 6, pagination: 'pages' }).success).toBe(true);
  });
});
