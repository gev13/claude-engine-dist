import { z } from 'zod';
import { SOCIAL_LABEL_STYLES, SOCIAL_NETWORKS, isSafeHref, type SocialLabelStyle, type SocialNetwork } from './navigation';

/** A hex colour — the one colour grammar this module needs, kept here so it does not import the theme (which imports it). */
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** 3.23 — a colour: hex, or rgb()/hsl() with numbers only (the theme's grammar, repeated: the theme imports this file). */
const COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
/** 3.22 — a plain length (40px, 2.5rem, -0.02em, 0), for the few sizes set here; it lands in a style attribute. */
const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em|vw|vh|%))$/;

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
export const HEADER_VARIANTS = ['classic', 'centered', 'slim', 'pill', 'splitLogo', 'stacked', 'boxed', 'sidebar', 'rail', 'menuButtonInline', 'notch'] as const;
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
      /** 3.17.1 — the notch header: its tab stays at the top of the screen on phones while the page scrolls. */
      stickyMobile: z.boolean().optional(),
      /** 3.17.2 — the notch header's tab stays at the top of wider screens (above 768px) too. */
      stickyDesktop: z.boolean().optional(),
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
      /** 2.21 notch — the tab's colour (unset: the page colour) and the radius of its curved corners, px. */
      notchBackground: z.string().trim().regex(HEX, 'A hex colour such as #000000').optional(),
      notchRadius: z.number().int().min(0).max(64).optional(),
      /** The bar's own background: solid (as before), none, or frosted glass over the page. */
      background: z.enum(['solid', 'transparent', 'glass']).optional(),
      /** Glass: how much the page behind is blurred, in px. */
      glassBlur: z.number().int().min(0).max(30).optional(),
      /** Glass: the tint laid over the blur, as a percentage of the page colour. */
      glassOpacity: z.number().int().min(0).max(100).optional(),
      /** 3.22 — glass: how much colour the blur keeps, in % (100 is the page's own; unset is 120). */
      glassSaturate: z.number().int().min(0).max(300).optional(),
      /** 3.22 — the thin line under the bar (unset or true, as before). */
      border: z.boolean().optional(),
      /** 3.22 — the page starts at the very top, under the bar, on every page (the bar stays over it). */
      under: z.boolean().optional(),
      /** 3.22 — the header button's own colours; each unset keeps the button style's. */
      ctaColors: z
        .object({
          text: z.string().trim().regex(HEX).optional(),
          background: z.string().trim().regex(HEX).optional(),
          border: z.string().trim().regex(HEX).optional(),
          hoverText: z.string().trim().regex(HEX).optional(),
          hoverBackground: z.string().trim().regex(HEX).optional(),
          hoverBorder: z.string().trim().regex(HEX).optional(),
        })
        .optional(),
      /** 3.22 — the header button drawn as the main button (unset, as before) or the outline one. */
      ctaStyle: z.enum(['primary', 'outline']).optional(),
      /** 3.23 — the header button's edge, px; unset is its button style's. */
      ctaBorderWidth: z.number().int().min(0).max(4).optional(),
      /** 3.23 — the round menu button's own circle and icon colours (e.g. rgba(0,0,0,0.5)); unset is the surface. */
      menuButtonBackground: z.string().trim().max(60).regex(COLOR, 'A colour').optional(),
      menuButtonColor: z.string().trim().max(60).regex(COLOR, 'A colour').optional(),
      /** While scrolling: always there (as before), hide going down and return going up, or shrink. */
      behaviour: z.enum(['always', 'hide', 'shrink']).optional(),
      /** Phones: the logo at the left (as before), centred between the buttons, or (3.6) just after the menu button. */
      logoMobile: z.enum(['left', 'center', 'afterMenu']).optional(),
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
      /** Where the header buttons sit inside the open menu; (3.22) `off` leaves them out of it. */
      ctaPosition: z.enum(['top', 'bottom', 'off']).optional(),
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
      /** 3.17 — the close button where the menu button was, the logo where the header's is. */
      closeAtToggle: z.boolean().optional(),
      /** 3.17 — the service links in the menu's own type and colour (`rows`), rather than small grey text (`list`). */
      servicesLook: z.enum(['list', 'rows']).optional(),

      /* ── 3.22 — the full-screen menu, closer to a site's own ── */
      /** The service pages listed under the links (unset or true, as before). */
      services: z.boolean().optional(),
      /** The links' size in the full-screen menus, e.g. 40px; on phones its own. Unset keeps Link size. */
      itemSize: z.string().trim().max(40).regex(LENGTH, 'A size such as 40px').optional(),
      itemSizeMobile: z.string().trim().max(40).regex(LENGTH, 'A size such as 28px').optional(),
      itemWeight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
      itemTracking: z.string().trim().max(20).regex(LENGTH, 'A spacing such as 0 or -0.02em').optional(),
      /** What opens a link's sub-items: a + in a circle (as before), a plain +, or a chevron. */
      expandIcon: z.enum(['circle', 'plus', 'chevron']).optional(),
      /** The menu's own colour, instead of the page's. */
      background: z.string().trim().regex(HEX, 'A hex colour such as #000000').optional(),
      /** The contact details: a column at the side (the creative menu, as before), a row at the bottom left of any full-screen menu, or none. */
      contactPosition: z.enum(['column', 'row', 'off']).optional(),
      /** Which details it shows; each unset shows it when there is one. */
      contactEmail: z.boolean().optional(),
      contactAddress: z.boolean().optional(),
      contactSocial: z.boolean().optional(),

      /* ── 3.24 — the full-screen menu as a column beside the dimmed page ── */
      /** How wide the menu is, e.g. 380px; unset is the whole screen (as before). The page beside it is dimmed. */
      columnWidth: z.string().trim().max(40).regex(LENGTH, 'A size such as 380px').optional(),
      /** The links from the top (as before) or centred up and down. */
      verticalAlign: z.enum(['top', 'center']).optional(),
      /** The + at the row's far end (as before) or beside the words. */
      expandAt: z.enum(['end', 'beside']).optional(),
      /** The site's header out of sight while the menu is open; the close button stays. */
      hideHeader: z.boolean().optional(),
      /** The contact row's social links: icons, names or short labels, and which networks; unset follows Menus. */
      socialStyle: z.enum(SOCIAL_LABEL_STYLES).optional(),
      socialNetworks: z.array(z.enum(SOCIAL_NETWORKS)).max(20).optional(),
      /** Words before the phone number, e.g. "Ph:". */
      phoneLabel: z.string().trim().max(20).optional(),
      /** 3.25 — with a width: how dark the page beside the column is, 0–100 (unset is 50). */
      dim: z.number().int().min(0).max(100).optional(),
      /** 3.25 — with a width: the column in the menu's colour (as before) or none — the links stand on the dimmed page. */
      columnPanel: z.enum(['panel', 'none']).optional(),
      /** 3.25 — the contact row: the heading small and muted, the details large (as before), or the heading strong and the details muted. */
      contactEmphasis: z.enum(['value', 'title']).optional(),
      /** 3.25 — the social links in circles (as before) or as bare icons. */
      socialLook: z.enum(['circle', 'plain']).optional(),

      /* ── 3.24 — phones: a menu of their own ── */
      onPhones: z
        .object({
          /** The menu style on phones; unset uses the one above at every width (as before). */
          variant: z.enum(MOBILE_MENU_VARIANTS).optional(),
          /** Up to which width: phones (768px, unset) or tablets too (1024px). */
          upTo: z.enum(['mobile', 'tablet']).optional(),
          side: z.enum(['left', 'right']).optional(),
          /** A drawer's width, e.g. 320px. */
          width: z.string().trim().max(40).regex(LENGTH, 'A size such as 320px').optional(),
          itemSize: z.string().trim().max(40).regex(LENGTH, 'A size such as 18px').optional(),
          itemWeight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
          /** Which menu: the header's (unset), the Overlay menu or (3.25) the Phone menu from Menus. */
          source: z.enum(['main', 'overlay', 'phone']).optional(),
          /** The header button as the last link of the list, instead of a button. */
          ctaInList: z.boolean().optional(),
          /** 3.25 — the logo at the top (unset, shown), the lines between the links (unset, shown), what opens sub-items. */
          logo: z.boolean().optional(),
          dividers: z.boolean().optional(),
          expandIcon: z.enum(['chevron', 'plus']).optional(),
        })
        .optional(),
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
      /** 3.1 — what stands at the head of the footer: the built-in mark and the site name (as before), the uploaded logo, or nothing. */
      logo: z.enum(['mark', 'image', 'none']).optional(),
      /** 3.1 — the uploaded logo's height in the footer, px. */
      logoHeight: z.number().int().min(16).max(120).optional(),
      /** 3.13 — the footer logo's height on phones, px; unset keeps the height above. */
      logoHeightMobile: z.number().int().min(16).max(120).optional(),
      /** 3.1 — the footer as a panel: inset, in the panel colour and corners set in Appearance → Shape. */
      panel: z.boolean().optional(),
      /** 3.11 — false leaves the contact email out of the footer. */
      email: z.boolean().optional(),
      /** 3.11 — the copyright line in capitals like the rest of the bottom row (as before), or as written. */
      copyrightCase: z.enum(['upper', 'asWritten']).optional(),
      /** 3.22 — between the social links written as names or short labels: nothing (as before), a slash or a dot. */
      socialSeparator: z.enum(['none', 'slash', 'dot']).optional(),
      /** 3.23 — between the legal links in the bottom row: nothing (as before), a bar, a slash or a dot. */
      legalSeparator: z.enum(['none', 'bar', 'slash', 'dot']).optional(),
      /** 3.22 — these social links as a list of icon and name under the others (phone, messengers), instead of among them. */
      contactLinks: z.array(z.enum(SOCIAL_NETWORKS)).max(12).optional(),
    })
    .optional(),

  /** 2.19 (T27) — a pointer of the site's own, on fine pointers only. */
  cursor: z
    .object({
      style: z.enum(['off', 'dotRing', 'dot', 'ring', 'blend']).optional(),
      /** The word over pictures and films ("View"); empty shows none. */
      mediaLabel: z.string().trim().max(16).optional(),
      /** 3.24 — over a picture that is a link: nothing more (as before), the word above, or a disc with an arrow. */
      linkedMedia: z.enum(['off', 'word', 'arrow']).optional(),
      /** 3.24 — that disc's size, px, and colour. */
      discSize: z.number().int().min(24).max(160).optional(),
      discColor: z.string().trim().max(60).regex(COLOR, 'A colour').optional(),
    })
    .optional(),

  /** 2.19 (T28) — how one page gives way to the next. */
  transition: z
    .object({
      style: z.enum(['off', 'fadeUp', 'fade', 'slide', 'curtain']).optional(),
      /** The logo over the page on the very first load, for at most a second and a half. */
      preloader: z.boolean().optional(),
      /** 3.22 — the first page of a visit arrives the way the others do. */
      firstLoad: z.boolean().optional(),
      /** 3.22 — how a page leaves: fading (as before), or fading and moving up, as long as its arrival. */
      leave: z.enum(['fade', 'fadeUp']).optional(),
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
      /* ── 3.22 — how they read ── */
      /** The labels' face (unset, Appearance → Labels), the text's, or the headings'. */
      font: z.enum(['label', 'body', 'display']).optional(),
      /** Capitals (unset, as the labels) or as written. */
      case: z.enum(['label', 'upper', 'none']).optional(),
      /** px */
      size: z.number().int().min(8).max(24).optional(),
      weight: z.enum(['400', '500', '600', '700']).optional(),
      /** Between the social links: nothing (as before), a slash or a dot. */
      separator: z.enum(['none', 'slash', 'dot']).optional(),
      /** Up and down the middle of the screen (as before), or down at the bottom. */
      position: z.enum(['center', 'bottom']).optional(),
      /** Each part stacked (as before), or the whole rail one line written up the edge. */
      orientation: z.enum(['stacked', 'row']).optional(),
      /** 3.23 — which social links the rail shows, in this order; unset is every one. */
      networks: z.array(z.enum(SOCIAL_NETWORKS)).max(20).optional(),
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
  /** 3.22 — the pause buttons over background and ambient films (unset or true, as before). Off, films are moving pictures only. */
  videoControls: z.boolean().optional(),
  /** GL3 — a footer switch that stops animation for this visitor. */
  motionToggle: z.boolean().optional(),
  /** 2.20 — stops animation for every visitor: the site-wide answer to the switch above. */
  reduceMotion: z.boolean().optional(),
  /** GL6 — lets visitors choose light or dark; needs the dark palette. */
  themeToggle: z.boolean().optional(),
});

export type Chrome = z.infer<typeof chromeSchema>;

/** The chrome with every default filled in, which is what components read. */
export type ResolvedChrome = {
  header: {
    variant: HeaderVariant;
    sticky: boolean;
    stickyMobile: boolean;
    stickyDesktop: boolean;
    overlay: boolean;
    collapseAt: CollapseTier;
    search: boolean;
    ctaOnMobile: boolean;
    menuLabel: string;
    railButton: 'top' | 'center';
    menuSide: 'left' | 'right';
    notchBackground?: string;
    notchRadius: number;
    background: 'solid' | 'transparent' | 'glass';
    glassBlur: number;
    glassOpacity: number;
    glassSaturate: number;
    border: boolean;
    under: boolean;
    ctaColors: { text?: string; background?: string; border?: string; hoverText?: string; hoverBackground?: string; hoverBorder?: string };
    ctaStyle: 'primary' | 'outline';
    ctaBorderWidth?: number;
    menuButtonBackground?: string;
    menuButtonColor?: string;
    behaviour: 'always' | 'hide' | 'shrink';
    logoMobile: 'left' | 'center' | 'afterMenu';
    height: { base?: number; laptop?: number; tablet?: number; mobile?: number };
  };
  megaMenu: MegaVariant;
  mobileMenu: {
    variant: MobileMenuVariant;
    side: 'left' | 'right';
    align: 'left' | 'center';
    ctaPosition: 'top' | 'bottom' | 'off';
    largeType: boolean;
    services: boolean;
    itemSize?: string;
    itemSizeMobile?: string;
    itemWeight?: string;
    itemTracking?: string;
    expandIcon: 'circle' | 'plus' | 'chevron';
    background?: string;
    contactPosition: 'column' | 'row' | 'off';
    contactEmail: boolean;
    contactAddress: boolean;
    contactSocial: boolean;
    source: 'main' | 'overlay';
    size: 'large' | 'huge';
    entrance: 'none' | 'fade' | 'slide' | 'stagger';
    opacity: number;
    hoverImages: boolean;
    contactTitle?: string;
    phone?: string;
    closeAtToggle: boolean;
    servicesLook: 'list' | 'rows';
    columnWidth?: string;
    verticalAlign: 'top' | 'center';
    expandAt: 'end' | 'beside';
    hideHeader: boolean;
    socialStyle?: SocialLabelStyle;
    socialNetworks?: SocialNetwork[];
    phoneLabel?: string;
    dim?: number;
    columnPanel: 'panel' | 'none';
    contactEmphasis: 'value' | 'title';
    socialLook: 'circle' | 'plain';
    onPhones?: {
      variant: MobileMenuVariant;
      upTo: 'mobile' | 'tablet';
      side: 'left' | 'right';
      width?: string;
      itemSize?: string;
      itemWeight?: string;
      source: 'main' | 'overlay' | 'phone';
      ctaInList: boolean;
      logo: boolean;
      dividers: boolean;
      expandIcon: 'chevron' | 'plus';
    };
  };
  footer: {
    variant: FooterVariant;
    shareChip: boolean;
    reveal: boolean;
    revealOnMobile: boolean;
    background?: string;
    logo: 'mark' | 'image' | 'none';
    logoHeight?: number;
    logoHeightMobile?: number;
    panel: boolean;
    email: boolean;
    copyrightCase: 'upper' | 'asWritten';
    socialSeparator: 'none' | 'slash' | 'dot';
    legalSeparator: 'none' | 'bar' | 'slash' | 'dot';
    contactLinks: SocialNetwork[];
  };
  cursor: { style: 'off' | 'dotRing' | 'dot' | 'ring' | 'blend'; mediaLabel?: string; linkedMedia: 'off' | 'word' | 'arrow'; discSize?: number; discColor?: string };
  transition: { style: 'off' | 'fadeUp' | 'fade' | 'slide' | 'curtain'; preloader: boolean; firstLoad: boolean; leave: 'fade' | 'fadeUp' };
  rails: {
    scrollSide: 'left' | 'right' | 'none';
    scrollLabel: string;
    socialSide: 'left' | 'right' | 'none';
    socialLabel: string;
    afterFirstScreen: boolean;
    autoContrast: boolean;
    hideOn: string[];
    minWidth: number;
    font: 'label' | 'body' | 'display';
    case: 'label' | 'upper' | 'none';
    size?: number;
    weight?: '400' | '500' | '600' | '700';
    separator: 'none' | 'slash' | 'dot';
    position: 'center' | 'bottom';
    orientation: 'stacked' | 'row';
    networks?: SocialNetwork[];
  } | null;
  announcement: { text: string; linkLabel?: string; href?: string; dismissible: boolean } | null;
  regionBar: { message: string; buttonLabel: string; options: { label: string; href: string }[] } | null;
  backToTop: boolean;
  videoControls: boolean;
  motionToggle: boolean;
  reduceMotion: boolean;
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
  /* 2.21 — the notch is cut into the first section; it neither sticks nor lies over a hero. */
  const notch = variant === 'notch';

  return {
    header: {
      variant,
      sticky: notch ? false : (c.header?.sticky ?? true),
      stickyMobile: notch ? (c.header?.stickyMobile ?? false) : false,
      stickyDesktop: notch ? (c.header?.stickyDesktop ?? false) : false,
      overlay: beside || notch ? false : (c.header?.overlay ?? false),
      collapseAt: c.header?.collapseAt ?? 'tablet',
      search: c.header?.search ?? false,
      ctaOnMobile: c.header?.ctaOnMobile ?? false,
      menuLabel: c.header?.menuLabel || 'Menu',
      railButton: c.header?.railButton ?? 'top',
      menuSide: c.header?.menuSide ?? 'left',
      notchBackground: c.header?.notchBackground && HEX.test(c.header.notchBackground) ? c.header.notchBackground : undefined,
      notchRadius: c.header?.notchRadius ?? 32,
      background: c.header?.background ?? 'solid',
      glassBlur: c.header?.glassBlur ?? 14,
      glassOpacity: c.header?.glassOpacity ?? 60,
      glassSaturate: c.header?.glassSaturate ?? 120,
      border: c.header?.border !== false,
      // Beside the page or cut into the first section, there is nothing for the page to run under.
      under: beside || notch ? false : (c.header?.under ?? false),
      ctaColors: Object.fromEntries(Object.entries(c.header?.ctaColors ?? {}).filter(([, v]) => typeof v === 'string' && HEX.test(v))),
      ctaStyle: c.header?.ctaStyle ?? 'primary',
      ctaBorderWidth: c.header?.ctaBorderWidth,
      menuButtonBackground: c.header?.menuButtonBackground && COLOR.test(c.header.menuButtonBackground) ? c.header.menuButtonBackground : undefined,
      menuButtonColor: c.header?.menuButtonColor && COLOR.test(c.header.menuButtonColor) ? c.header.menuButtonColor : undefined,
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
      closeAtToggle: c.mobileMenu?.closeAtToggle ?? false,
      servicesLook: c.mobileMenu?.servicesLook ?? 'list',
      services: c.mobileMenu?.services !== false,
      itemSize: c.mobileMenu?.itemSize && LENGTH.test(c.mobileMenu.itemSize) ? c.mobileMenu.itemSize : undefined,
      itemSizeMobile: c.mobileMenu?.itemSizeMobile && LENGTH.test(c.mobileMenu.itemSizeMobile) ? c.mobileMenu.itemSizeMobile : undefined,
      itemWeight: c.mobileMenu?.itemWeight,
      itemTracking: c.mobileMenu?.itemTracking && LENGTH.test(c.mobileMenu.itemTracking) ? c.mobileMenu.itemTracking : undefined,
      expandIcon: c.mobileMenu?.expandIcon ?? 'circle',
      background: c.mobileMenu?.background && HEX.test(c.mobileMenu.background) ? c.mobileMenu.background : undefined,
      contactPosition: c.mobileMenu?.contactPosition ?? 'column',
      contactEmail: c.mobileMenu?.contactEmail !== false,
      contactAddress: c.mobileMenu?.contactAddress !== false,
      contactSocial: c.mobileMenu?.contactSocial !== false,
      columnWidth: c.mobileMenu?.columnWidth && LENGTH.test(c.mobileMenu.columnWidth) ? c.mobileMenu.columnWidth : undefined,
      verticalAlign: c.mobileMenu?.verticalAlign ?? 'top',
      expandAt: c.mobileMenu?.expandAt ?? 'end',
      hideHeader: c.mobileMenu?.hideHeader ?? false,
      socialStyle: c.mobileMenu?.socialStyle,
      socialNetworks: c.mobileMenu?.socialNetworks?.length ? c.mobileMenu.socialNetworks : undefined,
      phoneLabel: c.mobileMenu?.phoneLabel || undefined,
      dim: c.mobileMenu?.dim,
      columnPanel: c.mobileMenu?.columnPanel ?? 'panel',
      contactEmphasis: c.mobileMenu?.contactEmphasis ?? 'value',
      socialLook: c.mobileMenu?.socialLook ?? 'circle',
      onPhones: c.mobileMenu?.onPhones?.variant
        ? {
            variant: c.mobileMenu.onPhones.variant,
            upTo: c.mobileMenu.onPhones.upTo ?? 'mobile',
            side: c.mobileMenu.onPhones.side ?? c.mobileMenu?.side ?? 'right',
            width: c.mobileMenu.onPhones.width && LENGTH.test(c.mobileMenu.onPhones.width) ? c.mobileMenu.onPhones.width : undefined,
            itemSize: c.mobileMenu.onPhones.itemSize && LENGTH.test(c.mobileMenu.onPhones.itemSize) ? c.mobileMenu.onPhones.itemSize : undefined,
            itemWeight: c.mobileMenu.onPhones.itemWeight,
            source: c.mobileMenu.onPhones.source ?? 'main',
            ctaInList: c.mobileMenu.onPhones.ctaInList ?? false,
            logo: c.mobileMenu.onPhones.logo !== false,
            dividers: c.mobileMenu.onPhones.dividers !== false,
            expandIcon: c.mobileMenu.onPhones.expandIcon ?? 'chevron',
          }
        : undefined,
    },
    footer: {
      variant: c.footer?.variant ?? 'sitemap',
      shareChip: c.footer?.shareChip ?? false,
      reveal: c.footer?.reveal ?? false,
      revealOnMobile: c.footer?.revealOnMobile ?? false,
      background: c.footer?.background && HEX.test(c.footer.background) ? c.footer.background : undefined,
      logo: c.footer?.logo ?? 'mark',
      logoHeight: c.footer?.logoHeight,
      logoHeightMobile: c.footer?.logoHeightMobile,
      panel: c.footer?.panel ?? false,
      email: c.footer?.email ?? true,
      copyrightCase: c.footer?.copyrightCase ?? 'upper',
      socialSeparator: c.footer?.socialSeparator ?? 'none',
      legalSeparator: c.footer?.legalSeparator ?? 'none',
      contactLinks: c.footer?.contactLinks ?? [],
    },
    cursor: {
      style: c.cursor?.style ?? 'off',
      mediaLabel: c.cursor?.mediaLabel || undefined,
      linkedMedia: c.cursor?.linkedMedia ?? 'off',
      discSize: c.cursor?.discSize,
      discColor: c.cursor?.discColor && COLOR.test(c.cursor.discColor) ? c.cursor.discColor : undefined,
    },
    transition: {
      style: c.transition?.style ?? 'off',
      preloader: c.transition?.preloader ?? false,
      firstLoad: c.transition?.firstLoad ?? false,
      leave: c.transition?.leave ?? 'fade',
    },
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
          font: c.rails.font ?? 'label',
          case: c.rails.case ?? 'label',
          size: c.rails.size,
          weight: c.rails.weight,
          separator: c.rails.separator ?? 'none',
          position: c.rails.position ?? 'center',
          orientation: c.rails.orientation ?? 'stacked',
          networks: c.rails.networks?.length ? c.rails.networks : undefined,
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
    videoControls: c.videoControls !== false,
    // With motion off for everyone, a switch to turn it off is a switch that does nothing.
    motionToggle: (c.motionToggle ?? false) && !c.reduceMotion,
    reduceMotion: c.reduceMotion ?? false,
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
  notch: { label: 'Notch', hint: 'Logo and links in a tab cut into the top of the first section — make that section a Panel' },
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
