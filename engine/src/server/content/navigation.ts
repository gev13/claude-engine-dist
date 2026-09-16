import 'server-only';
import { nanoid } from 'nanoid';
import { type FooterColumn, type NavItem, type Navigation, type SocialLink, parseNavigation } from '@/lib/navigation';
import { footerNav, headerCta, mainNav, servicePath } from '@/lib/site';
import type { Locale } from '@/lib/locales';
import { readLocalised } from './localisedSettings';
import { getServiceCatalogue } from './services';

export const NAVIGATION_SETTING_KEY = 'navigation';

/**
 * What the site shipped with, used when nothing has been saved.
 *
 * The service columns come from the live catalogue rather than the constants,
 * so a service added in the admin appears in the footer without anyone having
 * to edit the menu — which is what "the default menu" should mean.
 */
export async function bundledNavigation(): Promise<{
  header: NavItem[];
  headerCta: HeaderCta | null;
  footer: FooterColumn[];
}> {
  const { primary, secondary } = await getServiceCatalogue();
  return {
    header: mainNav.map((item) => ({ id: `nav-${item.href.replace(/\W+/g, '') || 'home'}`, ...item })),
    headerCta: headerCta ? { ...headerCta } : null,
    // Empty columns are dropped: a site with no services would otherwise show
    // "Core services" and "Specialist" headings with nothing under them.
    footer: [
      {
        id: 'col-core',
        title: 'Core services',
        items: primary.map((s) => ({ id: `f-${s.slug}`, label: s.title, href: servicePath(s.slug) })),
      },
      {
        id: 'col-specialist',
        title: 'Specialist',
        items: secondary.map((s) => ({ id: `f-${s.slug}`, label: s.title, href: servicePath(s.slug) })),
      },
      {
        id: 'col-company',
        title: 'Company',
        items: footerNav.company.map((l, i) => ({ id: `f-company-${i}`, ...l })),
      },
      {
        id: 'col-legal',
        title: 'Legal',
        placement: 'legal' as const,
        items: footerNav.legal.map((l, i) => ({ id: `f-legal-${i}`, ...l })),
      },
    ].filter((column) => column.items.length > 0),
  };
}

export type HeaderCta = { label: string; href: string };

export type ResolvedNavigation = {
  header: NavItem[];
  /** Null when there is no button: none saved, and none bundled. */
  headerCta: HeaderCta | null;
  headerSecondaryCta: HeaderCta | null;
  footer: FooterColumn[];
  footerNote?: string;
  footerAddress?: string;
  social: SocialLink[];
  /** True when nothing has been saved and the bundled menus are in use. */
  fallback: boolean;
};

/**
 * Read the menus.
 *
 * Database first, bundled constants second — the same rule pages follow, for
 * the same reason: an unreachable database degrades the site to its last
 * known-good navigation rather than to a page with no menu at all.
 *
 * A saved navigation that omits a section falls back for that section only, so
 * editing the header does not silently empty the footer.
 */
export async function getNavigation(locale?: Locale): Promise<ResolvedNavigation> {
  const bundled = await bundledNavigation();

  let saved: Navigation = {};
  let fallback = true;
  try {
    /* `navigation:hy` when it exists, `navigation` otherwise — so a language
       whose menus nobody has translated yet still gets menus. */
    const value = await readLocalised(NAVIGATION_SETTING_KEY, locale);
    if (value !== undefined) {
      saved = parseNavigation(value);
      fallback = Object.keys(saved).length === 0;
    }
  } catch {
    // Leave the bundled menus in place.
  }

  return {
    header: saved.header ?? bundled.header,
    headerCta: saved.headerCta ?? bundled.headerCta,
    headerSecondaryCta: saved.headerSecondaryCta ?? null,
    footer: saved.footer ?? bundled.footer,
    footerNote: saved.footerNote,
    footerAddress: saved.footerAddress,
    social: saved.social ?? [],
    fallback,
  };
}

/** Ids for items created in the admin. */
export function newNavId() {
  return nanoid(10);
}
