import { SITE_URL } from '@/lib/env';
import { servicePath } from '@/lib/site';
import type { AnyBlock } from '@/lib/blocks';
import { absoluteWithSlash } from '@/lib/permalinks';

/** An absolute URL for a site path, in the site's trailing-slash form. */
const abs = (path: string) => absoluteWithSlash(SITE_URL, path || '/');

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
};

export function organization(s: SiteIdentity): Node {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: s.name,
    url: `${SITE_URL}/`,
    description: s.description,
    ...(s.tagline ? { slogan: s.tagline } : {}),
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg`, width: 512, height: 512 },
    ...(s.contactEmail
      ? {
          email: s.contactEmail,
          contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: s.contactEmail }],
        }
      : {}),
  };
}

export function website(s: Pick<SiteIdentity, 'name' | 'description'> & { searchPath?: string }): Node {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE_URL}/`,
    name: s.name,
    description: s.description,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${abs(s.searchPath ?? '/blog')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function webPage(opts: {
  path: string;
  name: string;
  description: string;
  modified?: string;
  breadcrumbId?: string;
  speakableSelectors?: string[];
}): Node {
  const url = abs(opts.path);
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    inLanguage: 'en',
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
export function serviceNode(opts: { slug: string; name: string; description: string; path?: string }): Node {
  const url = abs(opts.path ?? servicePath(opts.slug));
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: opts.name,
    description: opts.description,
    serviceType: opts.name,
    provider: { '@id': ORG_ID },
    url,
    offers: { '@type': 'Offer', url, availability: 'https://schema.org/InStock' },
  };
}

export function itemList(opts: { path: string; name: string; items: { name: string; path: string }[] }): Node {
  return {
    '@type': 'ItemList',
    '@id': `${abs(opts.path)}#list`,
    name: opts.name,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: abs(it.path),
    })),
  };
}

export function blogNode(opts: { path: string; name: string; description: string }): Node {
  return {
    '@type': 'Blog',
    '@id': `${abs(opts.path)}#blog`,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
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
}): Node {
  const url = abs(opts.path);
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: opts.headline,
    description: opts.description,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    isPartOf: { '@id': `${abs(opts.blogPath ?? '/blog')}#blog` },
    publisher: { '@id': ORG_ID },
    author: opts.author
      ? { '@type': 'Person', name: opts.author }
      : { '@id': ORG_ID },
    inLanguage: 'en',
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
export function faqFromBlocks(blocks: AnyBlock[] | null | undefined, path: string): Node | null {
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
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#faq h2', '#faq [role="region"]'] },
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

  return {
    '@type': 'SiteNavigationElement',
    '@id': `${SITE_URL}/#navigation`,
    name: nav.map((n) => n.name),
    url: nav.map((n) => abs(n.path)),
  };
}

export function graph(nodes: (Node | null | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
