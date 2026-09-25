import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERMALINKS,
  blogIndexPath,
  categoryPath,
  matchBlogPath,
  pagedPath,
  permalinkCollisions,
  permalinksSchema,
  postPath,
  researchPath,
  resolvePermalinks,
  withSlash,
  type Permalinks,
} from '../src/lib/permalinks';
import { findServerList } from '../src/lib/listing';
import { pageWindow, resultRange } from '../src/components/site/Pagination';
import { formatMessage } from '../src/lib/messages';

/** The BetBoyz shape: posts under their category, archives at /category, slashes everywhere. */
const wp: Permalinks = permalinksSchema.parse({
  postPattern: 'category',
  categoryBase: '/category',
  trailingSlash: 'always',
});

describe('permalinks — the defaults are today’s addresses', () => {
  it('keeps /blog, /blog/<slug>, /blog/category/<slug> and no trailing slash', () => {
    expect(DEFAULT_PERMALINKS).toEqual({
      postPattern: 'index',
      blogIndex: '/blog',
      categoryBase: '/blog/category',
      pageSegment: 'page',
      trailingSlash: 'never',
    });
    expect(postPath(DEFAULT_PERMALINKS, { slug: 'hello', categorySlug: 'news' })).toBe('/blog/hello');
    expect(categoryPath(DEFAULT_PERMALINKS, 'news')).toBe('/blog/category/news');
    expect(researchPath(DEFAULT_PERMALINKS)).toBe('/blog/research');
    expect(blogIndexPath(DEFAULT_PERMALINKS, 2)).toBe('/blog/page/2');
  });

  it('never throws on a bad row — the defaults are a working site', () => {
    expect(resolvePermalinks({ postPattern: 'nonsense' })).toEqual(DEFAULT_PERMALINKS);
    expect(resolvePermalinks(null)).toEqual(DEFAULT_PERMALINKS);
  });
});

describe('building addresses', () => {
  it('files a post under its category, or under the blog when it has none', () => {
    expect(postPath(wp, { slug: 'link-building-for-igaming', categorySlug: 'igaming-marketing' })).toBe(
      '/igaming-marketing/link-building-for-igaming',
    );
    expect(postPath(wp, { slug: 'orphan', categorySlug: null })).toBe('/blog/orphan');
    expect(postPath({ ...wp, postPattern: 'root' }, { slug: 'x', categorySlug: 'y' })).toBe('/x');
  });

  it('never writes /page/1 — page one is the base', () => {
    expect(pagedPath('/blog', 1)).toBe('/blog');
    expect(pagedPath('/blog', 0)).toBe('/blog');
    expect(pagedPath('/blog', 3, { ...DEFAULT_PERMALINKS, pageSegment: 'seite' })).toBe('/blog/seite/3');
  });
});

describe('reading addresses', () => {
  it('finds the blog index and its pages', () => {
    expect(matchBlogPath(wp, '/blog')).toContainEqual({ kind: 'blogIndex', page: 1 });
    expect(matchBlogPath(wp, '/blog/page/10')).toContainEqual({ kind: 'blogIndex', page: 10 });
  });

  it('finds a category archive and its pages under the configured base', () => {
    expect(matchBlogPath(wp, '/category/learn')).toContainEqual({ kind: 'category', slug: 'learn', page: 1 });
    expect(matchBlogPath(wp, '/category/igaming-branding-and-design/page/3')).toContainEqual({
      kind: 'category',
      slug: 'igaming-branding-and-design',
      page: 3,
    });
    expect(matchBlogPath(DEFAULT_PERMALINKS, '/category/learn').some((m) => m.kind === 'category')).toBe(false);
  });

  it('offers any two-segment path as a post under the category pattern, carrying the category it claims', () => {
    expect(matchBlogPath(wp, '/igaming-marketing/link-building-for-igaming')).toContainEqual({
      kind: 'post',
      slug: 'link-building-for-igaming',
      categorySlug: 'igaming-marketing',
    });
    // The wrong category still names the post; the resolver 301s it to the right one.
    expect(matchBlogPath(wp, '/learn/link-building-for-igaming')).toContainEqual({
      kind: 'post',
      slug: 'link-building-for-igaming',
      categorySlug: 'learn',
    });
  });

  it('under the default pattern, only /blog/<slug> is a post', () => {
    expect(matchBlogPath(DEFAULT_PERMALINKS, '/blog/hello')).toContainEqual({ kind: 'post', slug: 'hello' });
    expect(matchBlogPath(DEFAULT_PERMALINKS, '/about/team').some((m) => m.kind === 'post')).toBe(false);
  });

  it('offers /…/page/N of any page as a paged list, which the resolver checks for a server list', () => {
    expect(matchBlogPath(DEFAULT_PERMALINKS, '/news/page/2')).toContainEqual({ kind: 'paged', base: '/news', page: 2 });
  });
});

describe('the trailing slash', () => {
  it('writes nothing different under "never"', () => {
    for (const href of ['/about', '/about/', '/', '/a?b=1', 'https://x.test/a', '#top', 'mailto:a@b.c']) {
      expect(withSlash(href, 'never')).toBe(href);
    }
  });

  it('adds one to site paths under "always", and leaves files, anchors and other sites alone', () => {
    expect(withSlash('/about', 'always')).toBe('/about/');
    expect(withSlash('/about?x=1#y', 'always')).toBe('/about/?x=1#y');
    expect(withSlash('/about/', 'always')).toBe('/about/');
    expect(withSlash('/', 'always')).toBe('/');
    expect(withSlash('/media/report.pdf', 'always')).toBe('/media/report.pdf');
    expect(withSlash('/sitemap.xml', 'always')).toBe('/sitemap.xml');
    expect(withSlash('https://x.test/a', 'always')).toBe('https://x.test/a');
    expect(withSlash('//evil.test', 'always')).toBe('//evil.test');
    expect(withSlash('#top', 'always')).toBe('#top');
  });
});

describe('what a save refuses', () => {
  it('refuses paths the engine owns, and a category base on top of the blog or research', () => {
    expect(permalinksSchema.safeParse({ blogIndex: '/admin' }).success).toBe(false);
    expect(permalinksSchema.safeParse({ blogIndex: '/careers' }).success).toBe(false);
    expect(permalinksSchema.safeParse({ categoryBase: '/blog' }).success).toBe(false);
    expect(permalinksSchema.safeParse({ categoryBase: '/blog/research' }).success).toBe(false);
    expect(permalinksSchema.safeParse({ blogIndex: 'Blog Posts' }).success).toBe(false);
    expect(permalinksSchema.parse({ blogIndex: '/News/' }).blogIndex).toBe('/news');
  });

  it('names a page that sits on a category archive, and a category that shadows a page', () => {
    const problems = permalinkCollisions(wp, {
      pagePaths: ['/', '/category/learn', '/about', '/learn'],
      categorySlugs: ['learn', 'about'],
      locales: ['en'],
    });
    expect(problems.some((p) => p.includes('/category/learn'))).toBe(true);
    expect(problems.some((p) => p.includes('“about”'))).toBe(true);
  });

  it('names a base that starts with a language prefix', () => {
    const problems = permalinkCollisions({ ...DEFAULT_PERMALINKS, blogIndex: '/hy' }, { pagePaths: [], categorySlugs: [], locales: ['en', 'hy'] });
    expect(problems).toHaveLength(1);
  });
});

describe('lists that page on the server', () => {
  it('finds the first such post list, inside rows too, and ignores switched-off ones', () => {
    const blocks = [
      { id: 'a', type: 'postList', props: { pagination: 'server', limit: 12 }, style: { disabled: true } },
      {
        id: 'r',
        type: 'row',
        props: { columns: [{ id: 'c', blocks: [{ id: 'b', type: 'postList', props: { pagination: 'server', limit: 12, kind: 'article' } }] }] },
      },
    ];
    expect(findServerList(blocks as never)).toEqual({ blockId: 'b', kind: 'article', categorySlug: undefined, limit: 12 });
    expect(findServerList([{ id: 'x', type: 'postList', props: { pagination: 'pages' } }] as never)).toBeUndefined();
  });

  it('shows the first, the last and two either side of the current page', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(6, 10)).toEqual([1, 'gap', 4, 5, 6, 7, 8, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 8, 9, 10]);
  });

  it('counts "Showing 13–24 of 110"', () => {
    expect(resultRange(2, 12, 110)).toEqual({ from: 13, to: 24, total: 110 });
    expect(resultRange(10, 12, 110)).toEqual({ from: 109, to: 110, total: 110 });
    expect(formatMessage('Showing {from}–{to} of {total} results', resultRange(1, 12, 110))).toBe('Showing 1–12 of 110 results');
    expect(formatMessage('Page {n} of {missing}', { n: 2 })).toBe('Page 2 of {missing}');
  });
});

/* The point of 2.13's permalinks is that the blog's address is data. A
   hardcoded `/blog/` in a component would quietly send every link back to
   the default, on exactly the sites that changed it. */
describe('no component writes the blog’s address by hand', () => {
  const root = path.join(__dirname, '..', 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) files.push(full);
    }
  };
  walk(root);
  // The defaults themselves, the demo content, and fallbacks that say "/blog" when nothing else is known.
  const allowed = ['lib/permalinks.ts', 'content/', 'lib/site.ts', 'lib/popups.ts', 'components/site/Header.tsx', 'lib/seo/jsonld.ts'];

  // Comments are allowed to say "/blog" — they are about the default, not writing it.
  const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('builds every post, category and index link from the permalinks', () => {
    const offenders = files
      .filter((file) => !allowed.some((ok) => file.replace(/\\/g, '/').includes(`src/${ok}`)))
      .filter((file) => /[`'"]\/blog(\/|[`'"?])/.test(withoutComments(readFileSync(file, 'utf8'))));
    expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
  });
});

/* The trailing-slash form is one process-wide value that `getPermalinks()`
   loads. A route that writes URLs without loading it first writes them in the
   default form — which is how the sitemaps were prerendered without slashes
   on a slashed site. Every entry point that writes a URL has to ask first. */
describe('every route that writes a URL loads the permalinks first', () => {
  const app = path.join(__dirname, '..', 'src', 'app');
  const entries: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/^(page|route)\.tsx?$/.test(name)) entries.push(full);
    }
  };
  walk(app);

  it('asks for them wherever buildMetadata, urlSet or a JSON-LD node is built', () => {
    const offenders = entries.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /buildMetadata\(|urlSet\(|from '@\/lib\/seo\/jsonld'/.test(source) && !source.includes('getPermalinks');
    });
    expect(offenders.map((file) => path.relative(app, file))).toEqual([]);
  });
});
