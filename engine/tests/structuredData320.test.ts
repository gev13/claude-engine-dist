import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { articleNode, faqFromBlocks, itemList, organization, serviceId, serviceNode, siteNavigation, webPage, website } from '@/lib/seo/jsonld';
import { pageSchemaSchema, parsePageSchema, parseSiteSchema, resolveService, siteSchemaSchema } from '@/lib/structuredData';
import { seoSchema } from '@/server/api/schemas';
import { checkSetting } from '@/server/engine/importCheck';
import { isPortableSettingKey, PORTABLE_SETTING_KEYS } from '@/server/engine/transfer';
import type { AnyBlock } from '@/lib/blocks';

/* 3.20 — structured data an editor manages: the site's (Admin → Structured
   data) and each page's (the Schema panel). Untouched, the graph is what the
   engine emitted before. */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const base = { name: 'Northfold', description: 'A site.', contactEmail: 'hello@example.com' };

describe('the site settings', () => {
  it('check every value that lands in a script', () => {
    expect(siteSchemaSchema.safeParse({ sameAs: ['javascript:alert(1)'] }).success).toBe(false);
    expect(siteSchemaSchema.safeParse({ sameAs: ['https://example.org/n'] }).success).toBe(true);
    expect(siteSchemaSchema.safeParse({ organizationType: 'Spaceship' }).success).toBe(false);
    expect(siteSchemaSchema.safeParse({ serviceDefaults: { priceCurrency: 'euro' } }).success).toBe(false);
    expect(siteSchemaSchema.safeParse({ contactPoints: [{ contactType: 'sales', telephone: '<b>' }] }).success).toBe(false);
  });

  it('read a damaged row field by field', () => {
    expect(parseSiteSchema({ organizationType: 'Corporation', sameAs: ['nope'] })).toEqual({ organizationType: 'Corporation' });
    expect(parseSiteSchema(null)).toEqual({});
  });

  it('travel with an export and are checked on import', () => {
    expect(PORTABLE_SETTING_KEYS).toContain('schema');
    expect(isPortableSettingKey('schema')).toBe(true);
    expect(checkSetting('schema', { offerCatalog: true }).ok).toBe(true);
    expect(checkSetting('schema', { sameAs: ['ftp://x'] }).ok).toBe(false);
  });
});

describe('the Organization', () => {
  it('is what it was when nothing is set', () => {
    const node = organization(base);
    expect(node['@type']).toBe('Organization');
    for (const key of ['knowsAbout', 'areaServed', 'hasOfferCatalog', 'vatID', 'priceRange']) expect(node).not.toHaveProperty(key);
    expect(node.contactPoint).toEqual([{ '@type': 'ContactPoint', contactType: 'customer support', email: 'hello@example.com' }]);
  });

  it('takes its type, topics, areas, profiles and contact points from the settings', () => {
    const node = organization({
      ...base,
      sameAs: ['https://x.example/n'],
      schema: {
        organizationType: 'Corporation',
        knowsAbout: ['Penetration testing'],
        areaServed: ['Worldwide'],
        sameAs: ['https://x.example/n', 'https://registry.example/42'],
        contactPoints: [{ contactType: 'sales', email: 'sales@example.com', availableLanguage: ['English'] }],
        vatId: 'GB123',
        priceRange: '$$',
      },
    });
    expect(node['@type']).toBe('Corporation');
    expect(node.knowsAbout).toEqual(['Penetration testing']);
    expect(node.areaServed).toEqual(['Worldwide']);
    expect(node.sameAs).toEqual(['https://x.example/n', 'https://registry.example/42']);
    expect(node.contactPoint).toHaveLength(2);
    expect((node.contactPoint as Record<string, unknown>[])[1]).toEqual({ '@type': 'ContactPoint', contactType: 'sales', email: 'sales@example.com', availableLanguage: ['English'] });
    expect(node.vatID).toBe('GB123');
    // A price range belongs to a place people visit.
    expect(node).not.toHaveProperty('priceRange');
    expect(organization({ ...base, schema: { organizationType: 'ProfessionalService', priceRange: '$$' } }).priceRange).toBe('$$');
  });

  it('lists the services as its offer catalogue only when asked', () => {
    const services = [{ name: 'Audits', path: '/services/audits' }];
    expect(organization({ ...base, services })).not.toHaveProperty('hasOfferCatalog');
    const catalogue = organization({ ...base, services, schema: { offerCatalog: true } }).hasOfferCatalog as { itemListElement: { itemOffered: Record<string, unknown> }[] };
    expect(catalogue.itemListElement[0].itemOffered).toMatchObject({ '@type': 'Service', '@id': serviceId('/services/audits'), name: 'Audits' });
  });
});

describe('pages', () => {
  it('are a WebPage in English unless told otherwise', () => {
    const node = webPage({ path: '/about', name: 'About', description: 'd' });
    expect(node['@type']).toBe('WebPage');
    expect(node.inLanguage).toBe('en');
    for (const key of ['primaryImageOfPage', 'mainEntity', 'datePublished']) expect(node).not.toHaveProperty(key);
  });

  it('take a type, their language, their picture and what they are about', () => {
    const node = webPage({ path: '/about', name: 'About', description: 'd', type: 'AboutPage', inLanguage: 'hy', imageUrl: '/media/og.jpg', mainEntityId: 'x#service', published: '2026-01-01' });
    expect(node['@type']).toBe('AboutPage');
    expect(node.inLanguage).toBe('hy');
    expect(node.primaryImageOfPage).toMatchObject({ '@type': 'ImageObject' });
    expect(String((node.primaryImageOfPage as { url: string }).url)).toMatch(/^https?:\/\/.+\/media\/og\.jpg$/);
    expect(node.mainEntity).toEqual({ '@id': 'x#service' });
    expect(node.datePublished).toBe('2026-01-01');
    expect(website({ name: 'N', description: 'd', inLanguage: 'ru' }).inLanguage).toBe('ru');
  });

  it('accept a Schema panel through the API rules, and refuse a bad one', () => {
    expect(seoSchema.safeParse({ schema: { pageType: 'ContactPage', service: { price: '1500', priceCurrency: 'EUR' } } }).success).toBe(true);
    expect(seoSchema.safeParse({ schema: { pageType: 'Castle' } }).success).toBe(false);
    expect(pageSchemaSchema.safeParse({ service: { price: '15 euros' } }).success).toBe(false);
    expect(parsePageSchema({ pageType: 'Castle' })).toEqual({});
  });
});

describe('services', () => {
  it('are what they were with no details', () => {
    const node = serviceNode({ slug: 'audits', path: '/services/audits', name: 'Audits', description: 'd' });
    expect(node).toMatchObject({ '@type': 'Service', name: 'Audits', serviceType: 'Audits' });
    expect(node.offers).toEqual({ '@type': 'Offer', url: expect.any(String), availability: 'https://schema.org/InStock' });
    for (const key of ['category', 'areaServed', 'audience']) expect(node).not.toHaveProperty(key);
  });

  it('carry the page’s details over the site’s defaults', () => {
    const details = resolveService({ serviceType: 'Penetration testing', price: '1500', priceKind: 'from' }, { category: 'Cybersecurity', areaServed: ['Worldwide'], audience: 'Operators', priceCurrency: 'EUR' });
    const node = serviceNode({ slug: 'a', path: '/services/a', name: 'A', description: 'd', details });
    expect(node).toMatchObject({ serviceType: 'Penetration testing', category: 'Cybersecurity', areaServed: ['Worldwide'], audience: { '@type': 'BusinessAudience', audienceType: 'Operators' } });
    expect(node.offers).toMatchObject({ price: '1500', priceCurrency: 'EUR', priceSpecification: { '@type': 'PriceSpecification', minPrice: '1500', priceCurrency: 'EUR' } });
    expect(resolveService({ areaServed: ['Armenia'] }, { areaServed: ['Worldwide'] }).areaServed).toEqual(['Armenia']);
  });

  it('are listed by @id on the page that lists them', () => {
    const list = itemList({ path: '/services', name: 'Services', items: [{ name: 'A', path: '/services/a' }], itemType: 'Service' });
    expect((list.itemListElement as Record<string, unknown>[])[0]).toEqual({ '@type': 'ListItem', position: 1, item: { '@type': 'Service', '@id': serviceId('/services/a'), name: 'A', url: expect.any(String) } });
    // A plain list keeps its old shape.
    expect((itemList({ path: '/b', name: 'B', items: [{ name: 'A', path: '/a' }] }).itemListElement as Record<string, unknown>[])[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'A', url: expect.any(String) });
  });
});

describe('the rest of the graph', () => {
  it('names each menu link as a part of the site navigation', () => {
    const nav = siteNavigation([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }, { name: 'Out', path: 'https://x.example' }]);
    expect(nav).toMatchObject({ '@type': 'SiteNavigationElement', name: 'Site navigation' });
    expect(nav?.hasPart).toEqual([
      { '@type': 'SiteNavigationElement', name: 'Home', url: expect.any(String) },
      { '@type': 'SiteNavigationElement', name: 'About', url: expect.any(String) },
    ]);
  });

  it('publishes articles as the chosen type, with a byline that can link somewhere', () => {
    const node = articleNode({ path: '/p', headline: 'H', description: 'd', author: 'Ana', authorUrl: 'https://example.org/ana', type: 'BlogPosting', inLanguage: 'hy' });
    expect(node['@type']).toBe('BlogPosting');
    expect(node.author).toEqual({ '@type': 'Person', name: 'Ana', url: 'https://example.org/ana' });
    expect(node.inLanguage).toBe('hy');
    expect(articleNode({ path: '/p', headline: 'H', description: 'd' })['@type']).toBe('Article');
  });

  it('leaves the speakable hint off an FAQ when switched off', () => {
    const blocks = [{ id: 'f', type: 'faq', props: { items: [{ question: 'Q', answer: 'A' }] } }] as unknown as AnyBlock[];
    expect(faqFromBlocks(blocks, '/x')).toHaveProperty('speakable');
    expect(faqFromBlocks(blocks, '/x', { speakable: false })).not.toHaveProperty('speakable');
  });
});

describe('where it is wired', () => {
  it('reaches the layout, pages, posts and projects', () => {
    const layout = read('src/app/(site)/[locale]/layout.tsx');
    expect(layout).toContain('getSiteSchema(locale)');
    expect(layout).toContain('siteSchema.navigation === false ? null : siteNavigation(navLinks)');
    const route = read('src/app/(site)/[locale]/[[...slug]]/page.tsx');
    expect(route).toContain('parsePageSchema(page.seo.schema)');
    expect(route).toContain("catalogue.some((s) => s.path.startsWith(`${path}/`))");
    expect(read('src/components/site/blog/PostArticle.tsx')).toContain('postSchema.articleType ?? siteSchema.articleType');
    expect(read('src/components/site/projects/ProjectViews.tsx')).toContain('type: projectSchema.pageType');
  });

  it('has a screen, an API and a panel in every editor that has SEO', () => {
    expect(read('src/components/admin/Sidebar.tsx')).toContain("{ label: 'Structured data', href: '/admin/schema', roles: ['admin'] }");
    expect(read('src/app/api/admin/schema/route.ts')).toContain("requireUser(request, 'settings:write')");
    expect(read('scripts/smoke.mjs')).toContain("'/api/admin/schema'");
    for (const editor of ['pages/PageEditor.tsx', 'posts/PostEditor.tsx', 'projects/ProjectEditor.tsx']) {
      const source = read(`src/app/(system)/admin/(panel)/${editor}`);
      expect(source).toContain('<SchemaSection');
      expect(source).toContain('jsonLd={false}');
    }
  });
});
