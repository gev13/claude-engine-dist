import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PgTable } from 'drizzle-orm/pg-core';
import { DEFAULT_PERMALINKS, categoryPath, postPath, projectPath } from '@/lib/permalinks';
import { cleanContent, extractAccordions, rewriteUploads, stripShortcodes, uploadKey, wpautop } from '@/lib/wordpress/content';
import { analyse } from '@/lib/wordpress/model';
import { parseWxr } from '@/lib/wordpress/wxr';
import * as schema from '@/server/db/schema';
import { checkArchive } from '@/server/engine/importCheck';
import { CONTENT_TABLES } from '@/server/engine/transfer';
import { convertSite, defaultMapping, wantedAttachments, wpUuid } from '@/server/wordpress/convert';
import { siteRoot } from '@/server/wordpress/rest';

/* 2.20 (T37) — a WordPress site becomes the rows of a content archive, and
   those rows pass the checks every import applies. */

const xml = readFileSync(path.join(process.cwd(), 'tests/fixtures/wordpress/sample.xml'), 'utf8');
const site = parseWxr(xml);

describe('a WXR export', () => {
  it('is read into items and terms', () => {
    expect(site.title).toBe('Old Studio');
    expect(site.url).toBe('https://old.example');
    const post = site.items.find((i) => i.id === 20)!;
    expect(post).toMatchObject({ type: 'post', title: 'Hello & welcome', slug: 'hello-welcome', status: 'publish', date: '2024-03-01T09:30:00.000Z', rendered: false });
    expect(post.terms).toEqual([
      { taxonomy: 'category', slug: 'news' },
      { taxonomy: 'post_tag', slug: 'crm' },
    ]);
    expect(post.meta._thumbnail_id).toBe('10');
    expect(site.terms.map((t) => `${t.taxonomy}:${t.slug}`)).toEqual(['category:news', 'post_tag:crm', 'ohio_portfolio_category:branding']);
    expect(site.items.find((i) => i.id === 10)?.attachmentUrl).toBe('https://old.example/wp-content/uploads/2024/03/hero.jpg');
  });

  it('is summarised for the mapping, with a first guess at it', () => {
    const analysis = analyse(site);
    expect(analysis.types.map((t) => t.type)).toEqual(['post', 'page', 'ohio_portfolio']);
    expect(analysis.attachments).toBe(1);
    const mapping = defaultMapping(analysis);
    expect(mapping.types).toEqual({ post: 'posts', page: 'pages', ohio_portfolio: 'projects' });
    expect(mapping.taxonomies).toEqual({ category: 'categories', post_tag: 'skip', ohio_portfolio_category: 'projectCategories' });
  });

  it('refuses what is not one', () => {
    expect(() => parseWxr('<html><body>no</body></html>')).toThrow(/not a WordPress export/);
  });
});

describe('content cleaning', () => {
  it('makes paragraphs the way WordPress does', () => {
    expect(wpautop('One\n\nTwo\nthree')).toBe('<p>One</p>\n<p>Two<br>\nthree</p>');
    expect(wpautop('<h2>Title</h2>\nText')).toBe('<h2>Title</h2>\n<p>Text</p>');
  });

  it('keeps what builder shortcodes wrapped, and leaves a footnote alone', () => {
    expect(stripShortcodes('[vc_row][vc_column]Hi[/vc_column][/vc_row] see [1]').replace(/\s+/g, ' ').trim()).toBe('Hi see [1]');
    expect(stripShortcodes('[caption id="x"]<img src="a.jpg"> A cat[/caption]')).toBe('<figure><img src="a.jpg"><figcaption>A cat</figcaption></figure>');
    expect(stripShortcodes('[vc_single_image image="10"]', (id) => (id === 10 ? '/media/a.jpg' : undefined))).toBe('<img src="/media/a.jpg" alt="">');
  });

  it('turns an accordion into questions and answers', () => {
    const { content, faqs } = extractAccordions('Intro [vc_tta_accordion][vc_tta_section title="Q1"]A1[/vc_tta_section][vc_tta_section title="Q2"]A2[/vc_tta_section][/vc_tta_accordion]');
    expect(faqs).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);
    expect(content.trim()).toBe('Intro');
  });

  it('points every size of an upload at the one file here, and drops srcset', () => {
    expect(uploadKey('https://old.example/wp-content/uploads/2024/03/hero-300x200.jpg')).toBe('2024/03/hero.jpg');
    expect(uploadKey('http://cdn.example/wp-content/uploads/2024/03/hero-scaled.jpg?x=1')).toBe('2024/03/hero.jpg');
    const files = new Map([['2024/03/hero.jpg', '/media/2026/09/abc.jpg']]);
    expect(rewriteUploads('<img src="https://old.example/wp-content/uploads/2024/03/hero-1024x683.jpg" srcset="x 300w">', files)).toBe('<img src="/media/2026/09/abc.jpg">');
  });
});

describe('conversion', () => {
  const mapping = defaultMapping(analyse(site));
  const mediaId = wpUuid(site.url, 'media', 10);
  const ctx = {
    permalinks: DEFAULT_PERMALINKS,
    locale: 'en',
    media: new Map([[10, { id: mediaId, url: '/media/2026/09/abc.jpg' }]]),
    files: new Map([['2024/03/hero.jpg', '/media/2026/09/abc.jpg']]),
    mediaRows: [{ id: mediaId, filename: '2026/09/abc.jpg', originalName: 'hero.jpg', mimeType: 'image/jpeg', extension: 'jpg', byteSize: 10, checksum: 'a'.repeat(64) }],
  };
  const { documents } = convertSite(site, mapping, ctx);

  it('makes a post with its cover, category, SEO, FAQ block and clean body', () => {
    const post = documents.posts![0] as Record<string, unknown>;
    expect(post).toMatchObject({ slug: 'hello-welcome', title: 'Hello & welcome', status: 'published', coverMediaId: mediaId, layout: 'bodyThenBlocks' });
    expect(post.seo).toEqual({ title: 'Welcome to the studio', description: 'Who we are and what we do.' });
    const body = post.body as string;
    expect(body).toContain('<p>Inside a builder row.</p>');
    expect(body).toContain('href="/media/2026/09/abc.jpg"');
    expect(body).not.toContain('srcset');
    expect(body).not.toContain('vc_');
    expect(body).toContain('[1]');
    expect((post.blocks as { props: { items: unknown[] } }[])[0]!.props.items).toHaveLength(2);
    expect(documents.post_categories).toEqual([{ postId: post.id, categoryId: post.primaryCategoryId }]);
  });

  it('leaves drafts out unless asked, and builds page paths from their parents', () => {
    expect(documents.posts).toHaveLength(1);
    const pages = documents.pages as Record<string, unknown>[];
    expect(pages.map((p) => p.path)).toEqual(['/about-us', '/about-us/team']);
    expect(pages[1]!.parentId).toBe(pages[0]!.id);
    expect((pages[0]!.blocks as { type: string }[])[0]!.type).toBe('prose');
    expect(convertSite(site, { ...mapping, drafts: true }, ctx).documents.posts).toHaveLength(2);
  });

  it('makes a project with its category and the builder’s image', () => {
    const project = documents.projects![0] as Record<string, unknown>;
    expect(project.intro).toContain('<img src="/media/2026/09/abc.jpg"');
    expect(documents.project_terms).toMatchObject([{ taxonomy: 'category', slug: 'branding', name: 'Branding' }]);
    expect(documents.project_term_links).toEqual([{ projectId: project.id, termId: (documents.project_terms![0] as { id: string }).id, isPrimary: true }]);
  });

  it('adds a 301 from every address that changes, and none that stay', () => {
    const redirects = (documents.redirects as { fromPath: string; toPath: string }[]).map((r) => `${r.fromPath} → ${r.toPath}`);
    expect(redirects).toContain(`/2024/03/hello-welcome → ${postPath(DEFAULT_PERMALINKS, { slug: 'hello-welcome', categorySlug: 'news' })}`);
    expect(redirects).toContain(`/portfolio/rebrand-bet-co → ${projectPath(DEFAULT_PERMALINKS, 'rebrand-bet-co')}`);
    expect(redirects).toContain(`/category/news → ${categoryPath(DEFAULT_PERMALINKS, 'news')}`);
    expect(redirects.some((r) => r.startsWith('/about-us '))).toBe(false);
  });

  it('gives the same ids every time, so a second run updates the first', () => {
    expect(convertSite(site, mapping, ctx).documents.posts![0]).toMatchObject({ id: (documents.posts![0] as { id: string }).id });
    expect(wpUuid('https://a', 'post', 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('passes every check an import applies', () => {
    const tables: Record<string, PgTable> = {
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
    const { report } = checkArchive({
      strategy: 'merge',
      tables: CONTENT_TABLES.map((name) => ({ name, table: tables[name]! })),
      documents,
      existing: {},
      hasFile: () => true,
      allowRegex: false,
    });
    expect(report.rejected).toEqual([]);
    expect(report.tables.posts).toMatchObject({ create: 1, failed: 0 });
  });
});

describe('which files come across', () => {
  it('are the ones the imported content uses', () => {
    const mapping = defaultMapping(analyse(site));
    expect(wantedAttachments(site, mapping, uploadKey).attachments.map((a) => a.id)).toEqual([10]);
    expect(wantedAttachments(site, { ...mapping, media: 'none' }, uploadKey).attachments).toEqual([]);
  });
});

describe('a site address', () => {
  it('is read however it was typed', () => {
    expect(siteRoot('example.com')).toBe('https://example.com');
    expect(siteRoot('https://example.com/blog/wp-json/wp/v2')).toBe('https://example.com/blog');
    expect(siteRoot('')).toBeNull();
  });
});

describe('the whole post, cleaned', () => {
  it('is HTML the sanitiser will keep', () => {
    const { html, faqs } = cleanContent('Hello\n\n[toggle title="Why?"]Because.[/toggle]', { rendered: false, files: new Map(), extractFaq: true });
    expect(html).toBe('<p>Hello</p>');
    expect(faqs).toEqual([{ question: 'Why?', answer: '<p>Because.</p>' }]);
  });
});
