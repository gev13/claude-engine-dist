import 'server-only';
import { DomUtils, parseDocument } from 'htmlparser2';
import type { WpItem, WpSite, WpTerm } from '@/lib/wordpress/model';
import { getPublic } from '@/server/security/outbound';

/* ═══════════════════════════════════════════════════════════════════════════
   Reading a live WordPress site through its REST API (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   `/wp-json/wp/v2/…`, public content only — no credentials are asked for,
   so drafts and private posts stay where they are (a WXR export carries
   those). Every request goes through `getPublic`, which refuses an address
   on the private network however the name resolves; the reading stops at
   fixed limits, because a site's size is not ours to trust.
   ═══════════════════════════════════════════════════════════════════════════ */

const PER_PAGE = 100;
const MAX_PAGES = 60; // 6,000 rows per type
const MAX_ITEMS = 20_000;

/** REST titles and excerpts are HTML with entities; the importer wants their text. */
const plain = (html: string) => DomUtils.textContent(parseDocument(html ?? '', { decodeEntities: true })).replace(/\s+/g, ' ').trim();

type Json = Record<string, unknown>;

async function getJson(url: string): Promise<{ ok: true; data: unknown; totalPages: number } | { ok: false; error: string; status?: number }> {
  const res = await getPublic(url, { accept: 'application/json', maxBytes: 30 * 1024 * 1024, timeoutMs: 30_000 });
  if (!res.ok) return res;
  try {
    return { ok: true, data: JSON.parse(res.body.toString('utf8')), totalPages: Number(res.headers['x-wp-totalpages'] ?? 1) || 1 };
  } catch {
    return { ok: false, error: `${new URL(url).pathname} did not answer with JSON.` };
  }
}

async function getAll(url: string): Promise<{ ok: true; rows: Json[] } | { ok: false; error: string }> {
  const rows: Json[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getJson(`${url}${url.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=${page}`);
    if (!res.ok) return page === 1 ? res : { ok: true, rows }; // past the last page WordPress answers 400
    if (!Array.isArray(res.data)) return { ok: false, error: `${new URL(url).pathname} did not answer with a list.` };
    rows.push(...(res.data as Json[]));
    if (page >= res.totalPages || rows.length >= MAX_ITEMS) break;
  }
  return { ok: true, rows };
}

/** The site's own address, from whatever was typed: `example.com`, `https://example.com/blog/`. */
export function siteRoot(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return `${url.origin}${url.pathname.replace(/\/wp-json.*$/, '').replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export async function readRestSite(input: string): Promise<{ ok: true; site: WpSite } | { ok: false; error: string }> {
  const root = siteRoot(input);
  if (!root) return { ok: false, error: 'That is not an address.' };
  const api = `${root}/wp-json`;

  const index = await getJson(`${api}/`);
  if (!index.ok) return { ok: false, error: `Could not read ${api}/ — ${index.error} Is the REST API switched on?` };
  const info = (index.data ?? {}) as Json;

  const typesRes = await getJson(`${api}/wp/v2/types`);
  const taxRes = await getJson(`${api}/wp/v2/taxonomies`);
  if (!typesRes.ok || !taxRes.ok) return { ok: false, error: 'The site does not list its content types.' };

  // Taxonomies first: posts name their terms by id.
  const terms: WpTerm[] = [];
  const termById = new Map<string, WpTerm>(); // `${taxonomy}:${id}`
  const taxonomyByBase = new Map<string, string>();
  for (const [slug, tax] of Object.entries(taxRes.data as Record<string, Json>)) {
    const base = String(tax.rest_base ?? slug);
    if (slug === 'nav_menu' || slug === 'wp_pattern_category') continue;
    taxonomyByBase.set(base, slug);
    const all = await getAll(`${api}/wp/v2/${base}?_fields=id,slug,name,description,parent`);
    if (!all.ok) continue;
    const ids = new Map(all.rows.map((row) => [Number(row.id), String(row.slug ?? '')]));
    for (const row of all.rows) {
      const term: WpTerm = {
        taxonomy: slug,
        slug: String(row.slug ?? ''),
        name: plain(String(row.name ?? '')),
        description: plain(String(row.description ?? '')),
        parent: row.parent ? ids.get(Number(row.parent)) : undefined,
      };
      terms.push(term);
      termById.set(`${slug}:${row.id}`, term);
    }
  }

  const items: WpItem[] = [];
  const skipTypes = new Set(['attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'wp_global_styles', 'wp_font_family', 'wp_font_face']);
  for (const [slug, type] of Object.entries(typesRes.data as Record<string, Json>)) {
    if (skipTypes.has(slug)) continue;
    const base = String(type.rest_base ?? slug);
    const all = await getAll(`${api}/wp/v2/${base}`);
    if (!all.ok) continue;
    for (const row of all.rows) {
      const meta: Record<string, string> = {};
      if (row.featured_media) meta._thumbnail_id = String(row.featured_media);
      const yoast = row.yoast_head_json as Json | undefined;
      if (yoast?.title) meta._yoast_wpseo_title = String(yoast.title);
      if (yoast?.description) meta._yoast_wpseo_metadesc = String(yoast.description);
      const itemTerms: WpItem['terms'] = [];
      for (const [field, taxonomy] of taxonomyByBase) {
        const ids = row[field];
        if (!Array.isArray(ids)) continue;
        for (const id of ids) {
          const term = termById.get(`${taxonomy}:${id}`);
          if (term) itemTerms.push({ taxonomy, slug: term.slug });
        }
      }
      items.push({
        id: Number(row.id),
        type: slug,
        title: plain(String((row.title as Json | undefined)?.rendered ?? '')),
        slug: String(row.slug ?? ''),
        status: String(row.status ?? 'publish'),
        date: row.date_gmt ? `${String(row.date_gmt)}Z` : null,
        content: String((row.content as Json | undefined)?.rendered ?? ''),
        rendered: true,
        excerpt: plain(String((row.excerpt as Json | undefined)?.rendered ?? '')),
        parentId: Number(row.parent ?? 0),
        menuOrder: Number(row.menu_order ?? 0),
        link: String(row.link ?? ''),
        terms: itemTerms,
        meta,
      });
      if (items.length >= MAX_ITEMS) break;
    }
  }

  const media = await getAll(`${api}/wp/v2/media?_fields=id,source_url,mime_type,alt_text,title,caption,slug,date_gmt,link`);
  if (media.ok) {
    for (const row of media.rows) {
      items.push({
        id: Number(row.id),
        type: 'attachment',
        title: plain(String((row.title as Json | undefined)?.rendered ?? '')),
        slug: String(row.slug ?? ''),
        status: 'inherit',
        date: row.date_gmt ? `${String(row.date_gmt)}Z` : null,
        content: '',
        rendered: true,
        excerpt: plain(String((row.caption as Json | undefined)?.rendered ?? '')),
        parentId: 0,
        menuOrder: 0,
        link: String(row.link ?? ''),
        terms: [],
        meta: row.alt_text ? { _wp_attachment_image_alt: String(row.alt_text) } : {},
        attachmentUrl: String(row.source_url ?? ''),
        mimeType: String(row.mime_type ?? ''),
      });
    }
  }

  return { ok: true, site: { title: plain(String(info.name ?? '')), url: String(info.url ?? root).replace(/\/+$/, ''), items, terms } };
}
