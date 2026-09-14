import { z } from 'zod';
import { isSafeHref } from './navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   Site chrome
   ───────────────────────────────────────────────────────────────────────────
   Which header, menus and footer a site uses, plus the small site-wide
   features around them. Picked once per site in Appearance and stored inside
   the theme row, beside the colours and type it is styled by.

   Every choice is an enum or a boolean: the components switch on them, and
   none of these values is ever written into CSS. The few free-text fields
   (announcement, region bar) are rendered as text nodes, and their links go
   through the same allowlist as the menus.

   The patterns come from docs/patterns/package-1-notes.md; the ids in the
   comments (HD1, MN3 …) match the Package 1 Pattern Book.
   ═══════════════════════════════════════════════════════════════════════════ */

const href = z.string().trim().min(1).max(500).refine(isSafeHref, 'Use a path like /about or a full https:// URL');

/**
 * HD1 classic bar · HD2 centred logo + menu button · HD3 slim global bar · HD4 pill navigation ·
 * HD5 logo between split links · HD6 logo row over a links row · HD7 floating rounded box ·
 * HD8 wide left sidebar · HD9 narrow left rail. The last two sit beside the page from 1024px up.
 */
export const HEADER_VARIANTS = ['classic', 'centered', 'slim', 'pill', 'splitLogo', 'stacked', 'boxed', 'sidebar', 'rail'] as const;
export type HeaderVariant = (typeof HEADER_VARIANTS)[number];

/** MM1 compact panel · MM2 full-width sheet · MM3 links + image cards · MM4 full-screen three-level. */
export const MEGA_VARIANTS = ['compact', 'sheet', 'cards', 'fullscreen'] as const;
export type MegaVariant = (typeof MEGA_VARIANTS)[number];

/**
 * MN1 full-screen drill-down · MN2 full-screen accordions · MN3 side drawer · MN4 push drawer ·
 * MN5 full-screen large list with + · MN6 full-screen centred capitals · MN7 full-screen huge type with a contact column.
 */
export const MOBILE_MENU_VARIANTS = ['drilldown', 'accordion', 'drawer', 'push', 'fullscreen', 'fullscreenCentered', 'fullscreenCreative'] as const;
export type MobileMenuVariant = (typeof MOBILE_MENU_VARIANTS)[number];

/** FT1 sitemap columns · FT2 brand block + columns · FT3 centred minimal · FT4 inset card. */
export const FOOTER_VARIANTS = ['sitemap', 'brand', 'centered', 'inset'] as const;
export type FooterVariant = (typeof FOOTER_VARIANTS)[number];

/**
 * The tier at which the header's links give way to the menu button. Named
 * after the tier that is the first to collapse: `tablet` collapses at 1024px
 * and below (Apple), `mobile` keeps the full links down to 769px (Resend).
 */
export const COLLAPSE_TIERS = ['laptop', 'tablet', 'mobile'] as const;
export type CollapseTier = (typeof COLLAPSE_TIERS)[number];

export const chromeSchema = z.object({
  header: z
    .object({
      variant: z.enum(HEADER_VARIANTS).optional(),
      /** Stays at the top while the page scrolls. On by default. */
      sticky: z.boolean().optional(),
      /** Sits transparent over a full-bleed hero and turns solid on scroll. */
      overlay: z.boolean().optional(),
      collapseAt: z.enum(COLLAPSE_TIERS).optional(),
      /** A search control in the header, linking to the site search. */
      search: z.boolean().optional(),
      /** Keep the header button beside the menu button on phones (XPeng). */
      ctaOnMobile: z.boolean().optional(),
      /** The word beside the menu icon on the centred header ("Menu"). */
      menuLabel: z.string().trim().max(20).optional(),
      /** HD9 — where the menu button sits on the rail. */
      railButton: z.enum(['top', 'center']).optional(),
    })
    .optional(),

  megaMenu: z.enum(MEGA_VARIANTS).optional(),

  mobileMenu: z
    .object({
      variant: z.enum(MOBILE_MENU_VARIANTS).optional(),
      /** Which edge a drawer slides in from. */
      side: z.enum(['left', 'right']).optional(),
      align: z.enum(['left', 'center']).optional(),
      /** Where the header buttons sit inside the open menu. */
      ctaPosition: z.enum(['top', 'bottom']).optional(),
      largeType: z.boolean().optional(),
    })
    .optional(),

  footer: z
    .object({
      variant: z.enum(FOOTER_VARIANTS).optional(),
      /** A "Share this page" chip on the footer's top edge (Unilever). */
      shareChip: z.boolean().optional(),
    })
    .optional(),

  /** GL4 — one line above the header. */
  announcement: z
    .object({
      enabled: z.boolean().optional(),
      text: z.string().trim().max(160).optional(),
      linkLabel: z.string().trim().max(40).optional(),
      href: href.optional(),
      dismissible: z.boolean().optional(),
    })
    .optional(),

  /** GL5 — suggests another regional or language version of the site. */
  regionBar: z
    .object({
      enabled: z.boolean().optional(),
      message: z.string().trim().max(200).optional(),
      buttonLabel: z.string().trim().max(30).optional(),
      options: z
        .array(z.object({ label: z.string().trim().min(1).max(60), href }))
        .max(12)
        .optional(),
    })
    .optional(),

  /** GL1 — floating button back to the top of the page. */
  backToTop: z.boolean().optional(),
  /** GL3 — a footer switch that stops animation for this visitor. */
  motionToggle: z.boolean().optional(),
  /** GL6 — lets visitors choose light or dark; needs the dark palette. */
  themeToggle: z.boolean().optional(),
});

export type Chrome = z.infer<typeof chromeSchema>;

/** The chrome with every default filled in, which is what components read. */
export type ResolvedChrome = {
  header: {
    variant: HeaderVariant;
    sticky: boolean;
    overlay: boolean;
    collapseAt: CollapseTier;
    search: boolean;
    ctaOnMobile: boolean;
    menuLabel: string;
    railButton: 'top' | 'center';
  };
  megaMenu: MegaVariant;
  mobileMenu: {
    variant: MobileMenuVariant;
    side: 'left' | 'right';
    align: 'left' | 'center';
    ctaPosition: 'top' | 'bottom';
    largeType: boolean;
  };
  footer: { variant: FooterVariant; shareChip: boolean };
  announcement: { text: string; linkLabel?: string; href?: string; dismissible: boolean } | null;
  regionBar: { message: string; buttonLabel: string; options: { label: string; href: string }[] } | null;
  backToTop: boolean;
  motionToggle: boolean;
  themeToggle: boolean;
};

/**
 * Fill in the defaults. A site that has never touched these settings gets the
 * header, menus and footer it shipped with: classic bar, compact dropdowns,
 * full-screen drill-down on phones, sitemap footer.
 */
export function resolveChrome(chrome: Chrome | undefined): ResolvedChrome {
  const c = chrome ?? {};
  const announcement = c.announcement?.enabled && c.announcement.text ? c.announcement : null;
  const region = c.regionBar?.enabled && c.regionBar.message ? c.regionBar : null;

  const variant = c.header?.variant ?? 'classic';
  /* A header down the side of the page has no hero to lie over, and its
     dropdowns open beside it, so the wide panels cannot apply. */
  const beside = variant === 'sidebar' || variant === 'rail';

  return {
    header: {
      variant,
      sticky: c.header?.sticky ?? true,
      overlay: beside ? false : (c.header?.overlay ?? false),
      collapseAt: c.header?.collapseAt ?? 'tablet',
      search: c.header?.search ?? false,
      ctaOnMobile: c.header?.ctaOnMobile ?? false,
      menuLabel: c.header?.menuLabel || 'Menu',
      railButton: c.header?.railButton ?? 'top',
    },
    megaMenu: beside ? 'compact' : (c.megaMenu ?? 'compact'),
    mobileMenu: {
      variant: c.mobileMenu?.variant ?? 'drilldown',
      side: c.mobileMenu?.side ?? 'right',
      align: c.mobileMenu?.align ?? 'left',
      ctaPosition: c.mobileMenu?.ctaPosition ?? 'top',
      largeType: c.mobileMenu?.largeType ?? false,
    },
    footer: { variant: c.footer?.variant ?? 'sitemap', shareChip: c.footer?.shareChip ?? false },
    announcement: announcement
      ? {
          text: announcement.text!,
          linkLabel: announcement.linkLabel,
          href: announcement.href,
          dismissible: announcement.dismissible ?? true,
        }
      : null,
    regionBar: region
      ? {
          message: region.message!,
          buttonLabel: region.buttonLabel || 'Continue',
          options: region.options ?? [],
        }
      : null,
    backToTop: c.backToTop ?? false,
    motionToggle: c.motionToggle ?? false,
    themeToggle: c.themeToggle ?? false,
  };
}

/** Labels for the admin, in the words the Pattern Book uses. */
export const HEADER_VARIANT_LABELS: Record<HeaderVariant, { label: string; hint: string }> = {
  classic: { label: 'Classic bar', hint: 'Logo left, links, buttons right' },
  centered: { label: 'Centred logo', hint: 'Menu button left, logo centre, icons right' },
  slim: { label: 'Slim global bar', hint: 'A thin bar; pair it with a sub-nav block' },
  pill: { label: 'Pill navigation', hint: 'Links in a rounded capsule, utility row above' },
  splitLogo: { label: 'Logo between the links', hint: 'Half the links each side of a centred logo' },
  stacked: { label: 'Logo over the links', hint: 'Logo on its own row, links centred below' },
  boxed: { label: 'Floating box', hint: 'The whole bar in a rounded box off the page edge' },
  sidebar: { label: 'Sidebar', hint: 'The full menu in a column down the left, from 1024px up' },
  rail: { label: 'Narrow rail', hint: 'A slim strip down the left with the menu button, from 1024px up' },
};

export const MEGA_VARIANT_LABELS: Record<MegaVariant, { label: string; hint: string }> = {
  compact: { label: 'Compact panel', hint: 'Opens under its link: link columns and preview cards' },
  sheet: { label: 'Full-width sheet', hint: 'First group in large type; the page blurs behind' },
  cards: { label: 'Links and image cards', hint: 'Links left, image cards with descriptions right' },
  fullscreen: { label: 'Full-screen, three levels', hint: 'Dark layer: sections, their links, a featured pane' },
};

export const MOBILE_MENU_LABELS: Record<MobileMenuVariant, { label: string; hint: string }> = {
  drilldown: { label: 'Full screen, drill-down', hint: 'Items with › open a second screen' },
  accordion: { label: 'Full screen, accordions', hint: 'Items expand in place' },
  drawer: { label: 'Side drawer', hint: 'Slides over a dimmed page' },
  push: { label: 'Push drawer', hint: 'Pushes the page aside' },
  fullscreen: { label: 'Full screen, large list', hint: 'Big type; + opens the sub-items in place' },
  fullscreenCentered: { label: 'Full screen, centred', hint: 'Centred capitals, vertically centred' },
  fullscreenCreative: { label: 'Full screen, with contact details', hint: 'Huge type beside email, address and social links' },
};

export const FOOTER_VARIANT_LABELS: Record<FooterVariant, { label: string; hint: string }> = {
  sitemap: { label: 'Sitemap columns', hint: 'Grouped link columns and a legal row' },
  brand: { label: 'Brand block and columns', hint: 'Name, address and socials beside the links' },
  centered: { label: 'Centred minimal', hint: 'Mark, one row of links, socials' },
  inset: { label: 'Inset card', hint: 'A rounded card inside the page margin' },
};
