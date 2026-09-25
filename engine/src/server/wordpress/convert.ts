import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { type FaqItem, cleanContent } from '@/lib/wordpress/content';
import type { WpAnalysis, WpItem, WpSite, WpTerm } from '@/lib/wordpress/model';
import { categoryPath, type Permalinks, postPath, projectPath } from '@/lib/permalinks';
import { normalisePath } from '@/lib/redirectRules';
import { toSlug } from '@/lib/slug';
import { toPlainText } from '@/server/content/sanitize';

/* ═══════════════════════════════════════════════════════════════════════════
   A WordPress site, as rows of a content archive (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   The importer does not write anything itself. It turns the site into the
   same table documents an export holds, and those go through the content
   import's checks and its merge — so a post from WordPress is held to the
   rules a post from the editor is, and importing the same site again updates
   what the first run made instead of adding a second copy.

   Ids are derived from the source site and the WordPress id, never random;
   that is what lets the second run find the first run's rows.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WP_TARGETS = ['posts', 'pages', 'projects', 'skip'] as const;
export const WP_TAXONOMY_TARGETS = ['categories', 'projectCategories', 'projectTags', 'skip'] as const;

export const wpMappingSchema = z.object({
  /** Each WordPress content type: into posts, pages, projects, or left out. */
  types: z.record(z.string().max(60), z.enum(WP_TARGETS)).default({}),
  /** Each taxonomy: blog categories, project categories or tags, or left out. */
  taxonomies: z.record(z.string().max(60), z.enum(WP_TAXONOMY_TARGETS)).default({}),
  /** Drafts, pending and private items come in as drafts; otherwise only what is published. */
  drafts: z.boolean().default(false),
  /** Download the files used by what is imported, every file, or none. */
  media: z.enum(['used', 'all', 'none']).default('used'),
  /** Accordions and toggles become an FAQ block, with its structured data. */
  faq: z.boolean().default(true),
  /** Yoast's title and description become the SEO fields. */
  seo: z.boolean().default(true),
  /** A 301 from every address that changes. */
  redirects: z.boolean().default(true),
  /** A row at an address this site already has: update it, or leave ours alone. */
  existing: z.enum(['update', 'skip']).default('skip'),
});

export type WpMapping = z.output<typeof wpMappingSchema>;

/** A first guess at the mapping, from the names WordPress sites tend to use. */
export function defaultMapping(analysis: WpAnalysis): WpMapping {
  const types: WpMapping['types'] = {};
  for (const { type } of analysis.types) {
    types[type] = type === 'post' ? 'posts' : type === 'page' ? 'pages' : /portfolio|project|work|case/i.test(type) ? 'projects' : 'skip';
  }
  const taxonomies: WpMapping['taxonomies'] = {};
  for (const { taxonomy } of analysis.taxonomies) {
    taxonomies[taxonomy] =
      taxonomy === 'category'
        ? 'categories'
        : /portfolio|project/i.test(taxonomy)
          ? /tag/i.test(taxonomy)
            ? 'projectTags'
            : 'projectCategories'
          : 'skip';
  }
  return wpMappingSchema.parse({ types, taxonomies });
}

/** A stable uuid for one WordPress thing on one site. */
export function wpUuid(site: string, kind: string, key: string | number): string {
  const hex = createHash('sha1').update(`${site}|${kind}|${key}`).digest('hex');
  // Shaped as a version-5 uuid, so it passes every uuid check it meets.
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export type MediaRef = { id: string; url: string };

export type ConvertContext = {
  permalinks: Permalinks;
  locale: string;
  /** WordPress attachment id → the engine's media row. */
  media: Map<number, MediaRef>;
  /** An uploaded file's key (see `uploadKey`) → its address here. */
  files: Map<string, string>;
  /** Media rows made by the download, to travel with the rest. */
  mediaRows: Record<string, unknown>[];
};

export type Converted = { documents: Record<string, unknown[]>; counts: Record<string, number> };

const PUBLISHED = new Set(['publish', 'future']);
const DRAFTS = new Set(['draft', 'pending', 'private']);

/** A post's own path on the WordPress site, when it has a readable one. */
function oldPath(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.search) return null; // ?p=123 — a draft's address, nothing links to it
    const path = normalisePath(decodeURI(url.pathname));
    return path === '/' ? null : path;
  } catch {
    return null;
  }
}

/** Yoast's variables, filled where they can be and dropped where they cannot. The site name is the engine's to add. */
function yoast(template: string | undefined, title: string, siteTitle: string): string | undefined {
  if (!template) return undefined;
  let text = template
    .replace(/%%title%%/g, title)
    .replace(/%%(sitename|sep|page|pagenumber|pagetotal)%%/g, ' ')
    .replace(/%%[a-z_]+%%/g, ' ');
  if (siteTitle && text.endsWith(siteTitle)) text = text.slice(0, -siteTitle.length);
  text = text.replace(/\s+/g, ' ').replace(/[\s|–—\-·:]+$/u, '').trim();
  return text && text !== title ? text : undefined;
}

function excerptOf(item: WpItem, html: string): string {
  const source = item.excerpt ? toPlainText(item.excerpt) : toPlainText(html);
  const text = source.replace(/\s+/g, ' ').trim();
  if (text.length <= 300) return text;
  return `${text.slice(0, 297).replace(/\s+\S*$/, '')}…`;
}

function faqBlock(id: string, items: FaqItem[]) {
  return { id, type: 'faq', props: { items: items.map((f) => ({ question: f.question.slice(0, 300), answer: f.answer })) } };
}

export function convertSite(site: WpSite, mapping: WpMapping, ctx: ConvertContext): Converted {
  const id = (kind: string, key: string | number) => wpUuid(site.url, kind, key);
  const documents: Record<string, unknown[]> = {};
  const push = (table: string, row: unknown) => (documents[table] ??= []).push(row);
  const redirects = new Map<string, string>();
  const redirect = (from: string | null, to: string) => {
    if (mapping.redirects && from && from !== to && !redirects.has(from)) redirects.set(from, to);
  };

  // Terms.
  const termTarget = (t: WpTerm) => mapping.taxonomies[t.taxonomy] ?? 'skip';
  const termId = (t: { taxonomy: string; slug: string }) => {
    const target = mapping.taxonomies[t.taxonomy];
    return target === 'categories' ? id('category', `${t.taxonomy}:${t.slug}`) : id('term', `${t.taxonomy}:${t.slug}`);
  };
  const termSlug = new Map<string, string>(); // `${taxonomy}:${slug}` → engine slug
  for (const term of site.terms) {
    const target = termTarget(term);
    if (target === 'skip') continue;
    const slug = toSlug(term.slug || term.name, 'term');
    termSlug.set(`${term.taxonomy}:${term.slug}`, slug);
    if (target === 'categories') {
      push('categories', {
        id: termId(term),
        slug,
        name: term.name.slice(0, 200) || slug,
        description: term.description,
        parentId: term.parent ? termId({ taxonomy: term.taxonomy, slug: term.parent }) : null,
        locale: ctx.locale,
      });
      if (term.taxonomy === 'category') redirect(normalisePath(`/category/${term.slug}`), categoryPath(ctx.permalinks, slug));
    } else {
      push('project_terms', { id: termId(term), taxonomy: target === 'projectTags' ? 'tag' : 'category', slug, name: term.name.slice(0, 200) || slug, description: term.description, locale: ctx.locale });
    }
  }

  // Which items come in, and as what.
  const wanted = (item: WpItem) => {
    const target = mapping.types[item.type] ?? 'skip';
    if (target === 'skip') return null;
    if (PUBLISHED.has(item.status)) return target;
    if (mapping.drafts && DRAFTS.has(item.status)) return target;
    return null;
  };
  const byId = new Map(site.items.map((item) => [item.id, item]));
  const imageUrl = (wpId: number) => ctx.media.get(wpId)?.url;
  const clean = (item: WpItem) => cleanContent(item.content, { rendered: item.rendered, files: ctx.files, imageUrl, extractFaq: mapping.faq });
  const common = (item: WpItem) => {
    const title = (item.title || 'Untitled').slice(0, 300);
    const seo: Record<string, string> = {};
    if (mapping.seo) {
      const t = yoast(item.meta._yoast_wpseo_title, title, site.title);
      const d = yoast(item.meta._yoast_wpseo_metadesc, title, '');
      if (t) seo.title = t.slice(0, 300);
      if (d) seo.description = d.slice(0, 1000);
    }
    return {
      title,
      status: PUBLISHED.has(item.status) ? 'published' : 'draft',
      publishedAt: item.date,
      seo,
      locale: ctx.locale,
    };
  };
  const cover = (item: WpItem) => ctx.media.get(Number(item.meta._thumbnail_id))?.id ?? null;

  // Pages' paths come from their parents' slugs, as WordPress built them.
  const pagePath = (item: WpItem, seen = new Set<number>()): string => {
    const slug = toSlug(item.slug || item.title, 'page');
    const parent = item.parentId ? byId.get(item.parentId) : undefined;
    if (!parent || seen.has(parent.id) || wanted(parent) !== 'pages') return `/${slug}`;
    seen.add(item.id);
    return `${pagePath(parent, seen)}/${slug}`;
  };

  for (const item of site.items) {
    const target = wanted(item);
    if (!target) continue;
    const { html, faqs } = clean(item);
    const base = common(item);
    const slug = toSlug(item.slug || item.title, target === 'pages' ? 'page' : target === 'projects' ? 'project' : 'post');

    if (target === 'posts') {
      const rowId = id('post', item.id);
      const cats = item.terms.filter((t) => mapping.taxonomies[t.taxonomy] === 'categories' && termSlug.has(`${t.taxonomy}:${t.slug}`));
      const primary = cats[0];
      push('posts', {
        id: rowId,
        slug,
        ...base,
        body: html,
        excerpt: excerptOf(item, html),
        kind: 'article',
        coverMediaId: cover(item),
        primaryCategoryId: primary ? termId(primary) : null,
        ...(faqs.length ? { layout: 'bodyThenBlocks', blocks: [faqBlock(`faq-${item.id}`, faqs)] } : {}),
      });
      for (const cat of cats) push('post_categories', { postId: rowId, categoryId: termId(cat) });
      redirect(oldPath(item.link), postPath(ctx.permalinks, { slug, categorySlug: primary ? termSlug.get(`${primary.taxonomy}:${primary.slug}`) : null }));
    } else if (target === 'pages') {
      const path = pagePath(item);
      const parent = item.parentId ? byId.get(item.parentId) : undefined;
      push('pages', {
        id: id('page', item.id),
        slug,
        path,
        ...base,
        excerpt: excerptOf(item, html),
        parentId: parent && wanted(parent) === 'pages' ? id('page', parent.id) : null,
        sortOrder: item.menuOrder,
        blocks: [
          ...(html.trim() ? [{ id: `wp-${item.id}`, type: 'prose', props: { html } }] : []),
          ...(faqs.length ? [faqBlock(`faq-${item.id}`, faqs)] : []),
        ],
      });
      redirect(oldPath(item.link), path);
    } else {
      const rowId = id('project', item.id);
      push('projects', {
        id: rowId,
        slug,
        ...base,
        intro: html,
        excerpt: excerptOf(item, html),
        coverMediaId: cover(item),
        sortOrder: item.menuOrder,
        ...(faqs.length ? { blocks: [faqBlock(`faq-${item.id}`, faqs)] } : {}),
      });
      let primaryDone = false;
      for (const term of item.terms) {
        const t = mapping.taxonomies[term.taxonomy];
        if ((t !== 'projectCategories' && t !== 'projectTags') || !termSlug.has(`${term.taxonomy}:${term.slug}`)) continue;
        const isPrimary = t === 'projectCategories' && !primaryDone;
        if (isPrimary) primaryDone = true;
        push('project_term_links', { projectId: rowId, termId: termId(term), isPrimary });
      }
      redirect(oldPath(item.link), projectPath(ctx.permalinks, slug));
    }
  }

  if (ctx.mediaRows.length) documents.media = ctx.mediaRows;
  for (const [from, to] of redirects) {
    push('redirects', { id: id('redirect', from), fromPath: from, toPath: to, matchType: 'exact', status: 301, note: 'Imported from WordPress' });
  }

  const counts = Object.fromEntries(Object.entries(documents).map(([table, rows]) => [table, rows.length]));
  return { documents, counts };
}

/** The attachments a mapping needs: featured pictures and files named in the content — or all, or none. */
export function wantedAttachments(site: WpSite, mapping: WpMapping, uploadKeyOf: (url: string) => string | null): { attachments: WpItem[]; strays: string[] } {
  const attachments = site.items.filter((item) => item.type === 'attachment' && item.attachmentUrl);
  if (mapping.media === 'none') return { attachments: [], strays: [] };
  if (mapping.media === 'all') return { attachments, strays: [] };

  const imported = site.items.filter((item) => {
    const target = mapping.types[item.type] ?? 'skip';
    return target !== 'skip' && (PUBLISHED.has(item.status) || (mapping.drafts && DRAFTS.has(item.status)));
  });
  const featured = new Set(imported.map((item) => Number(item.meta._thumbnail_id)).filter(Boolean));
  const keys = new Set<string>();
  const found = new Map<string, string>();
  for (const item of imported) {
    for (const match of item.content.matchAll(/https?:\/\/[^\s"'()<>]+\/wp-content\/uploads\/[^\s"'()<>]+/gi)) {
      const key = uploadKeyOf(match[0]);
      if (key) {
        keys.add(key);
        if (!found.has(key)) found.set(key, match[0]);
      }
    }
    for (const match of item.content.matchAll(/\b(?:image|ids)\s*=\s*"([\d,\s]+)"/gi)) for (const n of match[1]!.split(',')) featured.add(Number(n.trim()));
  }
  const chosen = attachments.filter((a) => featured.has(a.id) || keys.has(uploadKeyOf(a.attachmentUrl!) ?? ''));
  const covered = new Set(chosen.map((a) => uploadKeyOf(a.attachmentUrl!)));
  // Files in the content that no attachment names — uploaded elsewhere, or past the API's list.
  const strays = [...keys].filter((key) => !covered.has(key)).map((key) => found.get(key)!);
  return { attachments: chosen, strays };
}
