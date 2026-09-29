import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Structured data, as an editor configures it (3.20)
   ───────────────────────────────────────────────────────────────────────────
   Two layers. The site's own (`schema` settings row, Admin → Structured
   data): what kind of organization it is, what it knows about, where it
   works, how to reach it, and the defaults every service page starts from.
   And each page's own (`seo.schema`, the Schema panel beside the SEO panel):
   what kind of page it is, the service it describes, whether it lists the
   services, and the parts of the generated graph it can switch off.

   Everything is optional and resolves to what the engine emitted before, so
   a site that never opens either screen emits the same graph. Every value is
   checked here, because it is written into a <script> on every page.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_SETTING_KEY = 'schema';

/** The schema.org types an organization can be, most general first. */
export const ORGANIZATION_TYPES = [
  'Organization',
  'Corporation',
  'OnlineBusiness',
  'ProfessionalService',
  'LocalBusiness',
  'EducationalOrganization',
  'GovernmentOrganization',
  'MedicalOrganization',
  'NGO',
  'NewsMediaOrganization',
  'SportsOrganization',
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  Organization: 'Organization (general)',
  Corporation: 'Corporation',
  OnlineBusiness: 'Online business',
  ProfessionalService: 'Professional service (a local business with an office)',
  LocalBusiness: 'Local business (customers visit an address)',
  EducationalOrganization: 'Educational organization',
  GovernmentOrganization: 'Government organization',
  MedicalOrganization: 'Medical organization',
  NGO: 'Non-profit (NGO)',
  NewsMediaOrganization: 'News or media organization',
  SportsOrganization: 'Sports organization',
};

/** Types that are places people visit — they carry a price range and want an address. */
export const LOCAL_TYPES: readonly OrganizationType[] = ['LocalBusiness', 'ProfessionalService'];

export const PAGE_TYPES = [
  'WebPage',
  'AboutPage',
  'ContactPage',
  'CollectionPage',
  'ItemPage',
  'FAQPage',
  'ProfilePage',
  'SearchResultsPage',
  'CheckoutPage',
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  WebPage: 'Web page',
  AboutPage: 'About page',
  ContactPage: 'Contact page',
  CollectionPage: 'Collection (a page listing other pages)',
  ItemPage: 'Item page (one thing described)',
  FAQPage: 'FAQ page',
  ProfilePage: 'Profile page (a person or team member)',
  SearchResultsPage: 'Search results',
  CheckoutPage: 'Checkout',
};

export const ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report', 'ScholarlyArticle'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

/* ── Value grammars ──────────────────────────────────────────────────────── */

const text = (max: number) => z.string().trim().max(max);
const phrase = text(160);
const phrases = z.array(phrase.min(1)).max(30);
/** An absolute http(s) address — a profile, a page elsewhere. */
const httpUrl = z.string().trim().max(500).regex(/^https?:\/\/[^\s"<>]+$/i, 'An address starting with https://');
const email = z.string().trim().max(200).email();
const phone = z.string().trim().max(40).regex(/^\+?[0-9 ()./-]{4,40}$/, 'A phone number');
/** A price as written: 1500, 1500.00 — no currency sign, which is its own field. */
const price = z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, 'A number such as 1500 or 1500.00');
const currency = z.string().trim().regex(/^[A-Z]{3}$/, 'A three-letter currency code, e.g. EUR');
/** A language as BCP 47 or its English name ("en", "English"). */
const language = z.string().trim().min(1).max(40).regex(/^[A-Za-z][A-Za-z -]*$/, 'A language, e.g. English or en');

export const contactPointSchema = z.object({
  /** "sales", "customer support", "technical support", "billing support"… */
  contactType: phrase.min(1),
  email: email.optional(),
  telephone: phone.optional(),
  url: httpUrl.optional(),
  areaServed: phrases.optional(),
  availableLanguage: z.array(language).max(20).optional(),
});
export type ContactPoint = z.infer<typeof contactPointSchema>;

/** What every service page starts from; a page's own values win. */
export const serviceDefaultsSchema = z.object({
  /** The broad kind, e.g. "Cybersecurity". Each page's `serviceType` defaults to its own name. */
  category: phrase.optional(),
  areaServed: phrases.optional(),
  /** Who it is for, e.g. "Online casino operators". */
  audience: phrase.optional(),
  priceCurrency: currency.optional(),
});
export type ServiceDefaults = z.infer<typeof serviceDefaultsSchema>;

export const siteSchemaSchema = z.object({
  organizationType: z.enum(ORGANIZATION_TYPES).optional(),
  /** Topics the organization is an authority on. */
  knowsAbout: phrases.optional(),
  /** Countries, regions or "Worldwide". */
  areaServed: phrases.optional(),
  /** Profiles and listings beyond Menus → Social links (a directory, a registry entry, Wikidata). */
  sameAs: z.array(httpUrl).max(30).optional(),
  contactPoints: z.array(contactPointSchema).max(10).optional(),
  /** Registration numbers, when public. */
  vatId: text(60).optional(),
  taxId: text(60).optional(),
  /** "$$", "€100–€500" — shown for local business types only. */
  priceRange: text(40).optional(),
  /** List every service on the Organization as its offer catalogue. */
  offerCatalog: z.boolean().optional(),
  serviceDefaults: serviceDefaultsSchema.optional(),
  /** The menus as SiteNavigationElement — on unless switched off. */
  navigation: z.boolean().optional(),
  /** Speakable hints on pages and FAQs — on unless switched off. */
  speakable: z.boolean().optional(),
  /** The type every post is published as, unless the post says otherwise. */
  articleType: z.enum(ARTICLE_TYPES).optional(),
});
export type SiteSchema = z.infer<typeof siteSchemaSchema>;

export const pageServiceSchema = z.object({
  /** Off only when a service page should not describe a Service at all. */
  enabled: z.boolean().optional(),
  name: phrase.optional(),
  serviceType: phrase.optional(),
  category: phrase.optional(),
  description: text(1000).optional(),
  areaServed: phrases.optional(),
  audience: phrase.optional(),
  price: price.optional(),
  /** `from` — the price is where it starts; `fixed` — it is the price. */
  priceKind: z.enum(['from', 'fixed']).optional(),
  priceCurrency: currency.optional(),
  offerDescription: text(300).optional(),
});
export type PageService = z.infer<typeof pageServiceSchema>;

export const pageSchemaSchema = z.object({
  /** Unset — the engine decides (a page listing the services is a collection). */
  pageType: z.enum(PAGE_TYPES).optional(),
  /** Unset — only a service page describes a Service. */
  service: pageServiceSchema.optional(),
  /** `auto` (unset) — a page with the services block, or the parent of the service pages. */
  listServices: z.enum(['on', 'off']).optional(),
  /** Both on unless switched off. */
  breadcrumbs: z.boolean().optional(),
  faq: z.boolean().optional(),
  /** Posts: the article type and a byline other than the account's name. */
  articleType: z.enum(ARTICLE_TYPES).optional(),
  authorName: phrase.optional(),
  authorUrl: httpUrl.optional(),
});
export type PageSchema = z.infer<typeof pageSchemaSchema>;

/** Never throws: a stored row that fails is read as empty, field by field where it can be. */
export function parseSiteSchema(value: unknown): SiteSchema {
  const parsed = siteSchemaSchema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(siteSchemaSchema.shape)) {
    const one = (schema as z.ZodType).safeParse(raw[key]);
    if (one.success && one.data !== undefined) out[key] = one.data;
  }
  return out as SiteSchema;
}

export function parsePageSchema(value: unknown): PageSchema {
  const parsed = pageSchemaSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/** A page's service, its site's defaults under it. */
export function resolveService(page: PageService | undefined, defaults: ServiceDefaults | undefined): PageService {
  const d = defaults ?? {};
  const p = page ?? {};
  return {
    ...p,
    category: p.category || d.category,
    areaServed: p.areaServed?.length ? p.areaServed : d.areaServed,
    audience: p.audience || d.audience,
    priceCurrency: p.priceCurrency || d.priceCurrency,
  };
}
