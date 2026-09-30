import { SITE_URL } from '@/lib/env';
import { servicePath } from '@/lib/site';
import type { AnyBlock } from '@/lib/blocks';
import { absoluteWithSlash } from '@/lib/permalinks';
import { LOCAL_TYPES, type ArticleType, type PageService, type PageType, type SiteSchema } from '@/lib/structuredData';

/** An absolute URL for a site path, in the site's trailing-slash form. */
const abs = (path: string) => absoluteWithSlash(SITE_URL, path || '/');
/** A file's absolute URL (no trailing-slash rules — it is a file). */
const absUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`);

/* Every graph node this site emits. Rendered by <JsonLd> as a single
   @graph script per page, which is what search engines prefer. */

type Node = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

/**
 * The site's identity as an administrator set it in Settings. Passed in rather
 * than read here: this module stays pure so it can be unit-tested and used
 * from client components, and the settings live in the database.
 */
export type SiteIdentity = {
  name: string;
  tagline?: string;
  description: string;
  /** Omitted from the graph when empty — never a placeholder address. */
  contactEmail?: string;
  /** 2.18 — the site's own profiles (Menus → Social links), as `sameAs`. */
  sameAs?: string[];
  /** 2.18 — the brand logo from Appearance, when one is set; the bundled mark otherwise. */
  logoUrl?: string;
  /** 3.18 — Settings → Organization: each left out while empty. */
  legalName?: string;
  alternateName?: string;
  foundingDate?: string;
  phone?: string;
  addressStreet?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  /** A raster logo for search engines; preferred over `logoUrl`, which may be an SVG they do not accept. */
  searchLogoUrl?: string;
  /** 3.20 — Admin → Structured data. */
  schema?: SiteSchema;
  /** 3.20 — the service catalogue, for the offer catalogue when it is switched on. */
  services?: { name: string; path: string }[];
};

/** 3.20 — a service's own @id, shared by its page, the services list and the offer catalogue. */
export const serviceId = (path: string) => `${abs(path)}#service`;

export function organization(s: SiteIdentity): Node {
  const schema = s.schema ?? {};
  const type = schema.organizationType ?? 'Organization';
  const sameAs = [...new Set([...(s.sameAs ?? []), ...(schema.sameAs ?? [])])];
  const contactPoints = [
    ...(s.contactEmail
      ? [{ '@type': 'ContactPoint', contactType: 'customer support', email: s.contactEmail, ...(s.phone ? { telephone: s.phone } : {}) }]
      : []),
    ...(schema.contactPoints ?? []).map((point) => ({
      '@type': 'ContactPoint',
      contactType: point.contactType,
      ...(point.email ? { email: point.email } : {}),
      ...(point.telephone ? { telephone: point.telephone } : {}),
      ...(point.url ? { url: point.url } : {}),
      ...(point.areaServed?.length ? { areaServed: point.areaServed } : {}),
      ...(point.availableLanguage?.length ? { availableLanguage: point.availableLanguage } : {}),
    })),
  ];
  return {
    '@type': type,
    '@id': ORG_ID,
    name: s.name,
    url: `${SITE_URL}/`,
    description: s.description,
    ...(s.tagline ? { slogan: s.tagline } : {}),
    ...(s.legalName ? { legalName: s.legalName } : {}),
    ...(s.alternateName ? { alternateName: s.alternateName } : {}),
    ...(s.foundingDate ? { foundingDate: s.foundingDate } : {}),
    logo: s.searchLogoUrl
      ? { '@type': 'ImageObject', url: abs(s.searchLogoUrl) }
      : s.logoUrl
        ? { '@type': 'ImageObject', url: abs(s.logoUrl) }
        : { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg`, width: 512, height: 512 },
    ...(s.searchLogoUrl ? { image: abs(s.searchLogoUrl) } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.addressStreet || s.addressLocality || s.addressCountry
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(s.addressStreet ? { streetAddress: s.addressStreet } : {}),
            ...(s.addressLocality ? { addressLocality: s.addressLocality } : {}),
            ...(s.addressRegion ? { addressRegion: s.addressRegion } : {}),
            ...(s.addressPostalCode ? { postalCode: s.addressPostalCode } : {}),
            ...(s.addressCountry ? { addressCountry: s.addressCountry } : {}),
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(s.contactEmail ? { email: s.contactEmail } : {}),
    ...(contactPoints.length ? { contactPoint: contactPoints } : {}),
    ...(schema.knowsAbout?.length ? { knowsAbout: schema.knowsAbout } : {}),
    ...(schema.areaServed?.length ? { areaServed: schema.areaServed } : {}),
    ...(schema.vatId ? { vatID: schema.vatId } : {}),
    ...(schema.taxId ? { taxID: schema.taxId } : {}),
    ...(schema.priceRange && LOCAL_TYPES.includes(type) ? { priceRange: schema.priceRange } : {}),
    ...(schema.offerCatalog && s.services?.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Services',
            itemListElement: s.services.map((service) => ({
              '@type': 'Offer',
              itemOffered: { '@type': 'Service', '@id': serviceId(service.path), name: service.name, url: abs(service.path) },
            })),
          },
        }
      : {}),
  };
}

/**
 * The site. 3.18 — the search box search engines may show (`SearchAction`)
 * only when the site has a search to send it to: `searchPath` is the blog's
 * index, and a site with its blog switched off passes none.
 */
export function website(s: Pick<SiteIdentity, 'name' | 'description' | 'alternateName'> & { searchPath?: string; inLanguage?: string }): Node {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE_URL}/`,
    name: s.name,
    description: s.description,
    ...(s.alternateName ? { alternateName: s.alternateName } : {}),
    publisher: { '@id': ORG_ID },
    inLanguage: s.inLanguage ?? 'en',
    ...(s.searchPath
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${abs(s.searchPath)}?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  };
}

export function webPage(opts: {
  path: string;
  name: string;
  description: string;
  modified?: string;
  breadcrumbId?: string;
  speakableSelectors?: string[];
  /** 3.20 — AboutPage, ContactPage, CollectionPage…; WebPage when unset. */
  type?: PageType;
  inLanguage?: string;
  published?: string;
  /** The picture the page is shared with. */
  imageUrl?: string;
  /** The node the page is about — its Service, the services list. */
  mainEntityId?: string;
}): Node {
  const url = abs(opts.path);
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    inLanguage: opts.inLanguage ?? 'en',
    ...(opts.imageUrl ? { primaryImageOfPage: { '@type': 'ImageObject', url: absUrl(opts.imageUrl) } } : {}),
    ...(opts.mainEntityId ? { mainEntity: { '@id': opts.mainEntityId } } : {}),
    ...(opts.published ? { datePublished: opts.published } : {}),
    ...(opts.modified ? { dateModified: opts.modified } : {}),
    ...(opts.breadcrumbId ? { breadcrumb: { '@id': opts.breadcrumbId } } : {}),
    ...(opts.speakableSelectors
      ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: opts.speakableSelectors } }
      : {}),
  };
}

/** One step of a page's trail: Home › Section › Page. */
export type Crumb = { name: string; path: string };

export function breadcrumbs(trail: Crumb[]): Node {
  const url = abs(trail[trail.length - 1]?.path ?? '/');
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/** A service page is modelled as a Service plus an Offer, per the spec's
 *  "Products (for services)" requirement. Only facts the page itself carries
 *  go in — audience, category and pricing differ per site and are added
 *  through the page's own JSON-LD additions when a site has them. */
export function serviceNode(opts: {
  slug: string;
  name: string;
  description: string;
  path?: string;
  /** 3.20 — the page's Schema panel over Structured data's service defaults (`resolveService`). */
  details?: PageService;
  imageUrl?: string;
}): Node {
  const path = opts.path ?? servicePath(opts.slug);
  const url = abs(path);
  const d = opts.details ?? {};
  const offerPrice = d.price
    ? {
        price: d.price,
        ...(d.priceCurrency ? { priceCurrency: d.priceCurrency } : {}),
        ...(d.priceKind === 'from'
          ? { priceSpecification: { '@type': 'PriceSpecification', minPrice: d.price, ...(d.priceCurrency ? { priceCurrency: d.priceCurrency } : {}) } }
          : {}),
      }
    : {};
  return {
    '@type': 'Service',
    '@id': serviceId(path),
    name: d.name || opts.name,
    description: d.description || opts.description,
    serviceType: d.serviceType || opts.name,
    ...(d.category ? { category: d.category } : {}),
    provider: { '@id': ORG_ID },
    url,
    ...(d.areaServed?.length ? { areaServed: d.areaServed } : {}),
    ...(d.audience ? { audience: { '@type': 'BusinessAudience', audienceType: d.audience } } : {}),
    ...(opts.imageUrl ? { image: absUrl(opts.imageUrl) } : {}),
    offers: {
      '@type': 'Offer',
      url,
      availability: 'https://schema.org/InStock',
      ...offerPrice,
      ...(d.offerDescription ? { description: d.offerDescription } : {}),
    },
  };
}

export function itemList(opts: {
  path: string;
  name: string;
  items: { name: string; path: string }[];
  /** 3.20 — each entry names the node it is (a Service's @id), not just its address. */
  itemType?: 'Service';
}): Node {
  return {
    '@type': 'ItemList',
    '@id': `${abs(opts.path)}#list`,
    name: opts.name,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((it, i) =>
      opts.itemType === 'Service'
        ? { '@type': 'ListItem', position: i + 1, item: { '@type': 'Service', '@id': serviceId(it.path), name: it.name, url: abs(it.path) } }
        : { '@type': 'ListItem', position: i + 1, name: it.name, url: abs(it.path) },
    ),
  };
}

export function blogNode(opts: { path: string; name: string; description: string; inLanguage?: string }): Node {
  return {
    '@type': 'Blog',
    '@id': `${abs(opts.path)}#blog`,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    publisher: { '@id': ORG_ID },
    inLanguage: opts.inLanguage ?? 'en',
  };
}

export function articleNode(opts: {
  path: string;
  headline: string;
  description: string;
  published?: string;
  modified?: string;
  author?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  wordCount?: number;
  /** The blog index this article belongs to — a setting since 2.13. */
  blogPath?: string;
  /** 3.20 — BlogPosting, NewsArticle…; Article when unset. */
  type?: ArticleType;
  authorUrl?: string;
  inLanguage?: string;
}): Node {
  const url = abs(opts.path);
  return {
    '@type': opts.type ?? 'Article',
    '@id': `${url}#article`,
    headline: opts.headline,
    description: opts.description,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    isPartOf: { '@id': `${abs(opts.blogPath ?? '/blog')}#blog` },
    publisher: { '@id': ORG_ID },
    author: opts.author
      ? { '@type': 'Person', name: opts.author, ...(opts.authorUrl ? { url: opts.authorUrl } : {}) }
      : { '@id': ORG_ID },
    inLanguage: opts.inLanguage ?? 'en',
    ...(opts.published ? { datePublished: opts.published } : {}),
    ...(opts.modified ? { dateModified: opts.modified } : {}),
    ...(opts.section ? { articleSection: opts.section } : {}),
    ...(opts.wordCount ? { wordCount: opts.wordCount } : {}),
    ...(opts.imageUrl ? { image: [opts.imageUrl.startsWith('http') ? opts.imageUrl : `${SITE_URL}${opts.imageUrl}`] } : {}),
  };
}

/* ── A job advert ───────────────────────────────────────────────────────────
   `JobPosting` is the one node here with a duty attached to it: a search
   engine that indexes an advert will keep sending people to it, so a role
   that has been filled must stop emitting this — see `jobPostingNode`'s
   caller, which does not render it once `isOpen` is false.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * The engine's free-text contract field, mapped onto schema.org's closed list.
 *
 * Unmapped is left out entirely rather than guessed: "Hybrid — 3 days in
 * office" is a working pattern, not an employment type, and a wrong enum value
 * is worse than a missing optional one.
 */
const EMPLOYMENT_TYPES: Record<string, string> = {
  'full time': 'FULL_TIME',
  'full-time': 'FULL_TIME',
  fulltime: 'FULL_TIME',
  'part time': 'PART_TIME',
  'part-time': 'PART_TIME',
  parttime: 'PART_TIME',
  contract: 'CONTRACTOR',
  contractor: 'CONTRACTOR',
  freelance: 'CONTRACTOR',
  temporary: 'TEMPORARY',
  temp: 'TEMPORARY',
  internship: 'INTERN',
  intern: 'INTERN',
  volunteer: 'VOLUNTEER',
};

export function employmentType(contractType: string | null | undefined): string | null {
  return EMPLOYMENT_TYPES[(contractType ?? '').trim().toLowerCase()] ?? null;
}

export function jobPostingNode(opts: {
  path: string;
  title: string;
  description: string;
  datePosted?: string;
  validThrough?: string;
  location?: string;
  contractType?: string;
  department?: string;
  organisationName: string;
}): Node {
  const url = abs(opts.path);
  const type = employmentType(opts.contractType);

  return {
    '@type': 'JobPosting',
    '@id': `${url}#job`,
    title: opts.title,
    description: opts.description,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    /* Named rather than referenced: Google reads `hiringOrganization` on its
       own and a bare @id reference to the Organization node is not always
       resolved. The site's own name is the honest answer. */
    hiringOrganization: { '@type': 'Organization', name: opts.organisationName, '@id': ORG_ID },
    ...(opts.datePosted ? { datePosted: opts.datePosted } : {}),
    ...(opts.validThrough ? { validThrough: opts.validThrough } : {}),
    ...(type ? { employmentType: type } : {}),
    ...(opts.department ? { occupationalCategory: opts.department } : {}),
    ...(opts.location
      ? {
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressLocality: opts.location },
          },
        }
      : {}),
  };
}

/** The first `faq` block in a tree — at the top level or inside a row's columns. */
function findFaq(blocks: AnyBlock[] | null | undefined): AnyBlock | undefined {
  for (const block of blocks ?? []) {
    if (!block || (block as { style?: { disabled?: boolean } }).style?.disabled) continue;
    if (block.type === 'faq') return block;
    if (block.type === 'row') {
      for (const column of ((block.props ?? {}) as { columns?: { blocks?: AnyBlock[] }[] }).columns ?? []) {
        const found = findFaq(column.blocks);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/**
 * Pulled automatically out of the first `faq` block on the page — including
 * one inside a row, and one in a post's own blocks (2.13), where it sits
 * beside the Article node in the same graph.
 */
export function faqFromBlocks(blocks: AnyBlock[] | null | undefined, path: string, options: { speakable?: boolean } = {}): Node | null {
  const faq = findFaq(blocks);
  if (!faq) return null;
  const items = (faq.props?.items ?? []) as { question: string; answer: string }[];
  if (!Array.isArray(items) || items.length === 0) return null;

  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
    ...(options.speakable === false ? {} : { speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#faq h2', '#faq [role="region"]'] } }),
  };
}

/**
 * Rendered once in the site layout, from the menus an editor actually built
 * plus the service catalogue — never from a fixed list of paths, which would
 * advertise pages this site may not have.
 *
 * Only site-relative links are kept (an external menu item is not part of this
 * site's navigation), each path once. Returns null when nothing is left, and
 * `graph` drops it.
 */
export function siteNavigation(links: readonly { name: string; path: string }[] = []): Node | null {
  const seen = new Set<string>();
  const nav = links.filter((l) => {
    if (!l.path.startsWith('/') || l.path.startsWith('//') || seen.has(l.path)) return false;
    seen.add(l.path);
    return true;
  });
  if (nav.length === 0) return null;

  /* 3.20 — one element per link, as parts of the menu, rather than two
     parallel lists of names and addresses: validators show each link, and
     nothing has to pair them back up by position. */
  return {
    '@type': 'SiteNavigationElement',
    '@id': `${SITE_URL}/#navigation`,
    name: 'Site navigation',
    hasPart: nav.map((n) => ({ '@type': 'SiteNavigationElement', name: n.name, url: abs(n.path) })),
  };
}

/**
 * The page's own structured data, from its SEO panel (2.18) — stored since
 * the start and never rendered until now. Only objects that name a schema.org
 * `@type` survive; a `@context` is dropped, since the graph has one. They
 * join the generated graph rather than replacing it.
 */
export function customNodes(jsonLd: unknown): Node[] {
  if (!Array.isArray(jsonLd)) return [];
  const isObject = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  // A @type is a name, or (3.22) a list of names: ["Organization", "LocalBusiness"].
  const typed = (item: Record<string, unknown>) => {
    const type = item['@type'];
    return typeof type === 'string' || (Array.isArray(type) && type.length > 0 && type.every((t) => typeof t === 'string'));
  };
  /* 3.22 — a whole document pasted from another tool ({"@graph": [...]}, as
     Yoast writes it) is its nodes; it used to be dropped for having no @type. */
  const nodes = jsonLd.flatMap((item) => (isObject(item) && !typed(item) && Array.isArray(item['@graph']) ? (item['@graph'] as unknown[]) : [item]));
  return nodes
    .filter((item): item is Record<string, unknown> => isObject(item) && typed(item))
    .slice(0, 20)
    .map(({ '@context': _context, ...node }) => node as Node);
}

export function graph(nodes: (Node | null | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
