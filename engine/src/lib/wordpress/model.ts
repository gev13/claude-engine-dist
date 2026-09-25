/* ═══════════════════════════════════════════════════════════════════════════
   A WordPress site, as the importer sees it (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   One shape for both sources — a WXR export file and the REST API — so
   everything after reading (the mapping, the conversion, the checks) has one
   input and cannot care where it came from.
   ═══════════════════════════════════════════════════════════════════════════ */

export type WpTerm = {
  taxonomy: string;
  slug: string;
  name: string;
  description: string;
  /** The parent term's slug, in the same taxonomy. */
  parent?: string;
};

export type WpItem = {
  id: number;
  /** `post`, `page`, `attachment`, or a custom type such as `ohio_portfolio`. */
  type: string;
  title: string;
  slug: string;
  /** `publish`, `draft`, `pending`, `private`, `future`… */
  status: string;
  /** ISO, in UTC. */
  date: string | null;
  content: string;
  /** True when `content` is already rendered HTML (the REST API); false for WXR's raw post content. */
  rendered: boolean;
  excerpt: string;
  parentId: number;
  menuOrder: number;
  /** The address WordPress served it at, absolute. */
  link: string;
  terms: { taxonomy: string; slug: string }[];
  /** Post meta that matters here: `_thumbnail_id`, Yoast's title and description, `_wp_attachment_image_alt`. */
  meta: Record<string, string>;
  /** Attachments: the file's address and type. */
  attachmentUrl?: string;
  mimeType?: string;
};

export type WpSite = {
  title: string;
  /** The site's own address, without a trailing slash. */
  url: string;
  items: WpItem[];
  terms: WpTerm[];
};

/** What a site holds, for the mapping screen. */
export type WpAnalysis = {
  title: string;
  url: string;
  types: { type: string; count: number; sample: string[] }[];
  taxonomies: { taxonomy: string; count: number; sample: string[] }[];
  attachments: number;
};

export function analyse(site: WpSite): WpAnalysis {
  const types = new Map<string, WpItem[]>();
  for (const item of site.items) if (item.type !== 'attachment' && item.type !== 'nav_menu_item') types.set(item.type, [...(types.get(item.type) ?? []), item]);
  const taxonomies = new Map<string, WpTerm[]>();
  for (const term of site.terms) taxonomies.set(term.taxonomy, [...(taxonomies.get(term.taxonomy) ?? []), term]);
  return {
    title: site.title,
    url: site.url,
    types: [...types].map(([type, items]) => ({ type, count: items.length, sample: items.slice(0, 3).map((i) => i.title) })).sort((a, b) => b.count - a.count),
    taxonomies: [...taxonomies]
      .filter(([taxonomy]) => taxonomy !== 'nav_menu')
      .map(([taxonomy, terms]) => ({ taxonomy, count: terms.length, sample: terms.slice(0, 3).map((t) => t.name) })),
    attachments: site.items.filter((i) => i.type === 'attachment').length,
  };
}
