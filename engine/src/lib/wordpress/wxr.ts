import { DomUtils, parseDocument } from 'htmlparser2';
import type { Element } from 'domhandler';
import type { WpItem, WpSite, WpTerm } from './model';

/* ═══════════════════════════════════════════════════════════════════════════
   Reading a WordPress export file (WXR) (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   WXR is RSS 2.0 with a `wp:` namespace. Parsed as XML by htmlparser2 — the
   parser the SVG cleaner already uses — which runs no script, resolves no
   entity files and fetches nothing, so a hostile export is only text.
   Unknown elements are ignored; a missing one reads as empty.
   ═══════════════════════════════════════════════════════════════════════════ */

const text = (el: Element | null | undefined) => (el ? DomUtils.textContent(el).trim() : '');
const child = (el: Element, name: string) => DomUtils.findOne((e) => e.name === name, el.children, false);
const children = (el: Element, name: string) => DomUtils.findAll((e) => e.name === name, el.children).filter((e) => e.parent === el);
const num = (value: string) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** WXR dates are "2024-03-01 09:30:00" in UTC (`post_date_gmt`); "0000-00-00 …" means never. */
function isoDate(gmt: string, fallback: string): string | null {
  const value = gmt && !gmt.startsWith('0000') ? `${gmt.replace(' ', 'T')}Z` : fallback;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseWxr(xml: string): WpSite {
  const doc = parseDocument(xml, { xmlMode: true, decodeEntities: true, recognizeCDATA: true });
  const channel = DomUtils.findOne((e) => e.name === 'channel', doc.children, true);
  if (!channel) throw new Error('That is not a WordPress export (no channel).');
  const site = text(child(channel, 'wp:base_blog_url')) || text(child(channel, 'link'));

  const terms: WpTerm[] = [];
  for (const el of children(channel, 'wp:category')) {
    terms.push({
      taxonomy: 'category',
      slug: text(child(el, 'wp:category_nicename')),
      name: text(child(el, 'wp:cat_name')),
      description: text(child(el, 'wp:category_description')),
      parent: text(child(el, 'wp:category_parent')) || undefined,
    });
  }
  for (const el of children(channel, 'wp:tag')) {
    terms.push({ taxonomy: 'post_tag', slug: text(child(el, 'wp:tag_slug')), name: text(child(el, 'wp:tag_name')), description: text(child(el, 'wp:tag_description')) });
  }
  for (const el of children(channel, 'wp:term')) {
    const taxonomy = text(child(el, 'wp:term_taxonomy'));
    if (taxonomy === 'category' || taxonomy === 'post_tag') continue; // already read above
    terms.push({
      taxonomy,
      slug: text(child(el, 'wp:term_slug')),
      name: text(child(el, 'wp:term_name')),
      description: text(child(el, 'wp:term_description')),
      parent: text(child(el, 'wp:term_parent')) || undefined,
    });
  }

  const items: WpItem[] = children(channel, 'item').map((el) => {
    const meta: Record<string, string> = {};
    for (const m of children(el, 'wp:postmeta')) meta[text(child(m, 'wp:meta_key'))] = text(child(m, 'wp:meta_value'));
    const itemTerms = children(el, 'category')
      .map((c) => ({ taxonomy: c.attribs.domain ?? '', slug: c.attribs.nicename ?? '' }))
      .filter((t) => t.taxonomy && t.slug);
    const type = text(child(el, 'wp:post_type')) || 'post';
    return {
      id: num(text(child(el, 'wp:post_id'))),
      type,
      title: text(child(el, 'title')),
      slug: text(child(el, 'wp:post_name')),
      status: text(child(el, 'wp:status')) || 'draft',
      date: isoDate(text(child(el, 'wp:post_date_gmt')), text(child(el, 'pubDate'))),
      content: text(child(el, 'content:encoded')),
      rendered: false,
      excerpt: text(child(el, 'excerpt:encoded')),
      parentId: num(text(child(el, 'wp:post_parent'))),
      menuOrder: num(text(child(el, 'wp:menu_order'))),
      link: text(child(el, 'link')),
      terms: itemTerms,
      meta,
      ...(type === 'attachment' ? { attachmentUrl: text(child(el, 'wp:attachment_url')) || text(child(el, 'guid')) } : {}),
    };
  });

  return { title: text(child(channel, 'title')), url: site.replace(/\/+$/, ''), items, terms: terms.filter((t) => t.slug) };
}
