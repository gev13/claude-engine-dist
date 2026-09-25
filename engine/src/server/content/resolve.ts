import 'server-only';
import { cache } from 'react';
import type { AnyBlock } from '@/lib/blocks';
import { archivePerPage, resolveBlog, type ResolvedBlog } from '@/lib/blog';
import { findServerList, type ServerList } from '@/lib/listing';
import type { Locale } from '@/lib/locales';
import {
  DEFAULT_PERMALINKS,
  categoryPath,
  matchBlogPath,
  pagedPath,
  type BlogMatch,
  type Permalinks,
} from '@/lib/permalinks';
import { getPermalinks } from '@/server/routing/config';
import { getCategory, type CategoryRef } from './categories';
import { getPageByPath, type PublicPage } from './pages';
import { countPosts, getPost, postUrl, type PostDetail } from './posts';
import { getTheme } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   What a path is
   ───────────────────────────────────────────────────────────────────────────
   One resolver for every public address the catch-all answers: pages, the
   blog index, categories, research, posts, and the `/page/2` of anything with
   a list on it. It used to be four routes with four hardcoded folder names;
   with permalinks as a setting, the folder names are data, so the decision
   moved here.

   Order matters and is deliberate:

     1. the blog index           — it wraps whatever page sits at its path
     2. a page                   — live content wins over every pattern
     3. research, a category     — their own archives
     4. `/…/page/N` of a page    — a page whose post list pages on the server
     5. a post                   — last, because the category pattern makes
                                   every two-segment path a candidate
     6. an address the defaults  — so switching away from `/blog/<slug>` does
        would have used            not break every link to the old one

   Wrapped in React's `cache`, so `generateMetadata` and the page share one
   resolution per request.
   ═══════════════════════════════════════════════════════════════════════════ */

/** A page number, and how many there are. */
export type Paging = { number: number; total: number; perPage: number; count: number; base: string };

export type Resolved =
  | { kind: 'page'; page: PublicPage; paging?: Paging; list?: ServerList }
  | { kind: 'blogIndex'; page: PublicPage | null; paging: Paging; list?: ServerList }
  | { kind: 'research'; paging: Paging }
  | { kind: 'category'; category: CategoryRef; paging: Paging }
  | { kind: 'post'; post: PostDetail }
  | { kind: 'redirect'; to: string };

export const resolvePath = cache(async (path: string, locale: Locale): Promise<Resolved | null> => {
  const permalinks = await getPermalinks();
  const matches = matchBlogPath(permalinks, path);
  const blog = resolveBlog((await getTheme()).blog);

  const indexMatch = matches.find((m) => m.kind === 'blogIndex');
  if (indexMatch) {
    const page = await getPageByPath(permalinks.blogIndex, locale);
    const list = page ? findServerList(page.blocks as AnyBlock[]) : undefined;
    const paging = page
      ? list
        ? await listPaging(list, indexMatch.page, permalinks.blogIndex, permalinks, locale)
        : single(permalinks.blogIndex, indexMatch.page)
      : await archivePaging({}, archivePerPage(blog, 'index'), indexMatch.page, permalinks.blogIndex, permalinks, locale);
    return settle(paging, path, permalinks, () => ({ kind: 'blogIndex', page, paging, list }));
  }

  const page = await getPageByPath(path, locale);
  if (page) {
    // Page 1 of a page whose post list pages on the server: the list needs to know how many there are.
    const list = findServerList(page.blocks as AnyBlock[]);
    if (!list) return { kind: 'page', page };
    return { kind: 'page', page, list, paging: await listPaging(list, 1, path, permalinks, locale) };
  }

  for (const match of matches) {
    const found = await resolveMatch(match, { permalinks, blog, locale, path });
    if (found) return found;
  }

  // An address the shipped defaults would have used, for a site that moved away from them.
  if (!samePermalinks(permalinks, DEFAULT_PERMALINKS)) {
    for (const match of matchBlogPath(DEFAULT_PERMALINKS, path)) {
      if (match.kind === 'category') {
        const category = await getCategory(match.slug, locale);
        if (category) return { kind: 'redirect', to: categoryPath(permalinks, category.slug, match.page) };
      }
      if (match.kind === 'post') {
        const post = await getPost(match.slug, locale);
        if (post) return { kind: 'redirect', to: postUrl(permalinks, post) };
      }
    }
  }

  return null;
});

type Context = { permalinks: Permalinks; blog: ResolvedBlog; locale: Locale; path: string };

async function resolveMatch(match: BlogMatch, { permalinks, blog, locale, path }: Context): Promise<Resolved | null> {
  switch (match.kind) {
    case 'research': {
      const base = path.replace(new RegExp(`/${permalinks.pageSegment}/\\d+$`), '');
      const paging = await archivePaging({ kind: 'research' }, archivePerPage(blog, 'research'), match.page, base, permalinks, locale);
      return settle(paging, path, permalinks, () => ({ kind: 'research', paging }));
    }
    case 'category': {
      const category = await getCategory(match.slug, locale);
      if (!category) return null;
      const base = categoryPath(permalinks, category.slug);
      const paging = await archivePaging(
        { categorySlug: category.slug },
        archivePerPage(blog, 'category'),
        match.page,
        base,
        permalinks,
        locale,
      );
      return settle(paging, path, permalinks, () => ({ kind: 'category', category, paging }));
    }
    case 'paged': {
      const page = await getPageByPath(match.base, locale);
      const list = page ? findServerList(page.blocks as AnyBlock[]) : undefined;
      if (!page || !list) return null;
      const paging = await listPaging(list, match.page, match.base, permalinks, locale);
      return settle(paging, path, permalinks, () => ({ kind: 'page', page, paging, list }));
    }
    case 'post': {
      const post = await getPost(match.slug, locale);
      if (!post) return null;
      const canonical = postUrl(permalinks, post);
      // Filed under another category, or reached by an older shape: one address per post.
      return canonical === path ? { kind: 'post', post } : { kind: 'redirect', to: canonical };
    }
    default:
      return null;
  }
}

/**
 * Page 1 has one address, the base; `/page/1` 301s to it. A page past the
 * last is a 404 — an empty archive page is a soft 404 that search engines
 * eventually treat as one anyway.
 */
function settle(paging: Paging, path: string, permalinks: Permalinks, ok: () => Resolved): Resolved | null {
  if (path.endsWith(`/${permalinks.pageSegment}/1`)) return { kind: 'redirect', to: paging.base };
  if (paging.number > paging.total) return null;
  return ok();
}

const single = (base: string, number: number): Paging => ({ number, total: 1, perPage: 0, count: 0, base });

async function archivePaging(
  filter: { kind?: 'research'; categorySlug?: string },
  perPage: number,
  number: number,
  base: string,
  _permalinks: Permalinks,
  locale: Locale,
): Promise<Paging> {
  const count = await countPosts({ ...filter, locale });
  return { number, perPage, count, total: Math.max(1, Math.ceil(count / perPage)), base };
}

async function listPaging(list: ServerList, number: number, base: string, _permalinks: Permalinks, locale: Locale): Promise<Paging> {
  const count = await countPosts({
    kind: list.kind === 'all' ? undefined : list.kind,
    categorySlug: list.categorySlug,
    locale,
  });
  return { number, perPage: list.limit, count, total: Math.max(1, Math.ceil(count / list.limit)), base };
}

function samePermalinks(a: Permalinks, b: Permalinks): boolean {
  return a.blogIndex === b.blogIndex && a.categoryBase === b.categoryBase && a.postPattern === b.postPattern;
}

/** The address of page `n` of a paging, in the site's permalinks. */
export function pageHref(paging: Paging, n: number, permalinks: Permalinks): string {
  return pagedPath(paging.base, n, permalinks);
}
