import { z } from 'zod';
import { isSafeHref } from './navigation';

/** A hex colour — the one colour grammar this module needs, kept here so it does not import the theme (which imports it). */
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

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
export const HEADER_VARIANTS = ['classic', 'centered', 'slim', 'pill', 'splitLogo', 'stacked', 'boxed', 'sidebar', 'rail', 'menuButtonInline'] as const;
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

      /* ── 2.18/2.19 (T25) ─────────────────────────────────────────────── */
      /** menuButtonInline — which end the round menu button sits at. */
      menuSide: z.enum(['left', 'right']).optional(),
      /** The bar's own background: solid (as before), none, or frosted glass over the page. */
      background: z.enum(['solid', 'transparent', 'glass']).optional(),
      /** Glass: how much the page behind is blurred, in px. */
      glassBlur: z.number().int().min(0).max(30).optional(),
      /** Glass: the tint laid over the blur, as a percentage of the page colour. */
      glassOpacity: z.number().int().min(0).max(100).optional(),
      /** While scrolling: always there (as before), hide going down and return going up, or shrink. */
      behaviour: z.enum(['always', 'hide', 'shrink']).optional(),
      /** Phones: the logo at the left (as before) or centred between the buttons. */
      logoMobile: z.enum(['left', 'center']).optional(),
      /** The bar's height per tier, in px; empty keeps the stylesheet's. */
      height: z
        .object({
          base: z.number().int().min(40).max(160).optional(),
          laptop: z.number().int().min(40).max(160).optional(),
          tablet: z.number().int().min(40).max(160).optional(),
          mobile: z.number().int().min(40).max(160).optional(),
        })
        .optional(),
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

      /* ── 2.19 (T26) — the full-screen menus, also opened by the menu button on wide screens ── */
      /** The header's own menu, or the separate Overlay menu from Menus. */
      source: z.enum(['main', 'overlay']).optional(),
      /** Item size in the full-screen menus: large (as before) or huge. */
      size: z.enum(['large', 'huge']).optional(),
      /** How the menu arrives. */
      entrance: z.enum(['none', 'fade', 'slide', 'stagger']).optional(),
      /** How much of the page shows through, 0–100 — 100 is the solid page colour (as before). */
      opacity: z.number().int().min(30).max(100).optional(),
      /** A picture beside the list, from the item under the pointer (Menus → an item's picture). */
      hoverImages: z.boolean().optional(),
      /** The contact column — its heading, and a phone number beside the email. */
      contactTitle: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(40).regex(/^\+?[0-9 ()./-]{0,40}$/, 'A phone number').optional(),
    })
    .optional(),

  footer: z
    .object({
      variant: z.enum(FOOTER_VARIANTS).optional(),
      /** A "Share this page" chip on the footer's top edge (Unilever). */
      shareChip: z.boolean().optional(),
      /** 2.19 (T29) — the page lifts off the footer, which waits underneath. */
      reveal: z.boolean().optional(),
      /** Keep the reveal on phones too; off by default, where it costs more than it shows. */
      revealOnMobile: z.boolean().optional(),
      /** The footer's own background, when it should differ from the page's — a hex colour. */
      background: z.string().trim().regex(HEX, 'A hex colour such as #000000').optional(),
    })
    .optional(),

  /** 2.19 (T27) — a pointer of the site's own, on fine pointers only. */
  cursor: z
    .object({
      style: z.enum(['off', 'dotRing', 'dot', 'ring', 'blend']).optional(),
      /** The word over pictures and films ("View"); empty shows none. */
      mediaLabel: z.string().trim().max(16).optional(),
    })
    .optional(),

  /** 2.19 (T28) — how one page gives way to the next. */
  transition: z
    .object({
      style: z.enum(['off', 'fadeUp', 'fade', 'slide', 'curtain']).optional(),
      /** The logo over the page on the very first load, for at most a second and a half. */
      preloader: z.boolean().optional(),
    })
    .optional(),

  /** 2.19 (T30) — fixed rails down the sides of wide screens. */
  rails: z
    .object({
      enabled: z.boolean().optional(),
      /** Scroll-to-top with a progress bar: on which side, or none. */
      scrollSide: z.enum(['left', 'right', 'none']).optional(),
      scrollLabel: z.string().trim().max(30).optional(),
      /** The site's social links, with a label: on which side, or none. */
      socialSide: z.enum(['left', 'right', 'none']).optional(),
      socialLabel: z.string().trim().max(30).optional(),
      /** Appear only once the reader is a screen down. */
      afterFirstScreen: z.boolean().optional(),
      /** Invert against whatever is behind them, so they read over light and dark sections alike. */
      autoContrast: z.boolean().optional(),
      /** Pages to leave them off — paths, `*` at the end for everything under one. */
      hideOn: z.array(z.string().trim().max(200).regex(/^\/[A-Za-z0-9._~\-/%]*\*?$/)).max(20).optional(),
      /** The width they appear from, in px. */
      minWidth: z.number().int().min(768).max(2560).optional(),
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
    menuSide: 'left' | 'right';
    background: 'solid' | 'transparent' | 'glass';
    glassBlur: number;
    glassOpacity: number;
    behaviour: 'always' | 'hide' | 'shrink';
    logoMobile: 'left' | 'center';
    height: { base?: number; laptop?: number; tablet?: number; mobile?: number };
  };
  megaMenu: MegaVariant;
  mobileMenu: {
    variant: MobileMenuVariant;
    side: 'left' | 'right';
    align: 'left' | 'center';
    ctaPosition: 'top' | 'bottom';
    largeType: boolean;
    source: 'main' | 'overlay';
    size: 'large' | 'huge';
    entrance: 'none' | 'fade' | 'slide' | 'stagger';
    opacity: number;
    hoverImages: boolean;
    contactTitle?: string;
    phone?: string;
  };
  footer: { variant: FooterVariant; shareChip: boolean; reveal: boolean; revealOnMobile: boolean; background?: string };
  cursor: { style: 'off' | 'dotRing' | 'dot' | 'ring' | 'blend'; mediaLabel?: string };
  transition: { style: 'off' | 'fadeUp' | 'fade' | 'slide' | 'curtain'; preloader: boolean };
  rails: {
    scrollSide: 'left' | 'right' | 'none';
    scrollLabel: string;
    socialSide: 'left' | 'right' | 'none';
    socialLabel: string;
    afterFirstScreen: boolean;
    autoContrast: boolean;
    hideOn: string[];
    minWidth: number;
  } | null;
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
      menuSide: c.header?.menuSide ?? 'left',
      background: c.header?.background ?? 'solid',
      glassBlur: c.header?.glassBlur ?? 14,
      glassOpacity: c.header?.glassOpacity ?? 60,
      behaviour: c.header?.behaviour ?? 'always',
      logoMobile: c.header?.logoMobile ?? 'left',
      height: c.header?.height ?? {},
    },
    megaMenu: beside ? 'compact' : (c.megaMenu ?? 'compact'),
    mobileMenu: {
      variant: c.mobileMenu?.variant ?? 'drilldown',
      side: c.mobileMenu?.side ?? 'right',
      align: c.mobileMenu?.align ?? 'left',
      ctaPosition: c.mobileMenu?.ctaPosition ?? 'top',
      largeType: c.mobileMenu?.largeType ?? false,
      source: c.mobileMenu?.source ?? 'main',
      size: c.mobileMenu?.size ?? 'large',
      entrance: c.mobileMenu?.entrance ?? 'none',
      opacity: c.mobileMenu?.opacity ?? 100,
      hoverImages: c.mobileMenu?.hoverImages ?? false,
      contactTitle: c.mobileMenu?.contactTitle || undefined,
      phone: c.mobileMenu?.phone || undefined,
    },
    footer: {
      variant: c.footer?.variant ?? 'sitemap',
      shareChip: c.footer?.shareChip ?? false,
      reveal: c.footer?.reveal ?? false,
      revealOnMobile: c.footer?.revealOnMobile ?? false,
      background: c.footer?.background && HEX.test(c.footer.background) ? c.footer.background : undefined,
    },
    cursor: { style: c.cursor?.style ?? 'off', mediaLabel: c.cursor?.mediaLabel || undefined },
    transition: { style: c.transition?.style ?? 'off', preloader: c.transition?.preloader ?? false },
    rails: c.rails?.enabled
      ? {
          scrollSide: c.rails.scrollSide ?? 'left',
          scrollLabel: c.rails.scrollLabel || 'Scroll to top',
          socialSide: c.rails.socialSide ?? 'right',
          socialLabel: c.rails.socialLabel || 'Follow us —',
          afterFirstScreen: c.rails.afterFirstScreen ?? false,
          autoContrast: c.rails.autoContrast ?? false,
          hideOn: c.rails.hideOn ?? [],
          minWidth: c.rails.minWidth ?? 1181,
        }
      : null,
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
  menuButtonInline: { label: 'Menu button and links', hint: 'A round menu button, the logo, links and a button; the menu button opens the full-screen menu everywhere' },
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
