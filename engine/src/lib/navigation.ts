import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Navigation
   ───────────────────────────────────────────────────────────────────────────
   The header and footer menus, editable from the admin and stored as a single
   `navigation` row in settings.

   Until now these were constants in `src/lib/site.ts`, so adding a menu item
   meant a code change and a deploy. They resolve the same way pages do:
   database first, the bundled constants second — a fresh clone and a database
   outage both render the menus the site has always had.

   Hrefs go into `href` attributes, so the grammar is an allowlist: a
   site-relative path, a full http(s) URL, or a mailto/tel link. `javascript:`
   and `data:` cannot be expressed.
   ═══════════════════════════════════════════════════════════════════════════ */

const HREF_PATTERN =
  /^(\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*|https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+0-9\-\s()]+|#[A-Za-z][\w-]*)$/;

export function isSafeHref(value: string): boolean {
  return HREF_PATTERN.test(value.trim());
}

const href = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isSafeHref, 'Use a path like /about, a full https:// URL, or a mailto: / tel: link');

/**
 * An image source: a site path (an upload under /media, say) or a full https
 * URL. Nothing that could close an attribute or smuggle a scheme. The same
 * grammar the section background images use.
 */
const IMAGE_URL_PATTERN = /^(\/[A-Za-z0-9._~\-/%]*|https:\/\/[A-Za-z0-9._~\-/%?=&:]+)$/;

export function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  return IMAGE_URL_PATTERN.test(v) && !v.includes(')') && !v.includes('..');
}

export const imageUrl = z.string().trim().max(500).refine(isSafeImageUrl, 'Choose an image from the media library');

const baseItem = {
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  href,
  /** `blank` opens in a new tab; the renderer adds rel="noopener noreferrer". */
  target: z.enum(['self', 'blank']).optional(),
  /** The `title` attribute — WordPress calls this the Title Attribute. */
  title: z.string().trim().max(160).optional(),
};

/**
 * A link inside a dropdown. The optional fields feed the richer desktop menus:
 * `group` gathers links under a heading, `description` is the one line under
 * a card, and a link with an `imageUrl` renders as an image card rather than a
 * plain link (MM1, MM3), or as the featured pane of a full-screen menu (MM4).
 */
const childItem = z.object({
  ...baseItem,
  group: z.string().trim().max(40).optional(),
  description: z.string().trim().max(160).optional(),
  imageUrl: imageUrl.optional(),
});
export type NavChild = z.infer<typeof childItem>;

/**
 * One level of children, not arbitrary depth.
 *
 * Two levels covers every menu the ten reference sites had — Ferrari's
 * three-pane menu is two levels plus groups — and a schema that recurses is a
 * schema that can describe a menu nobody can render.
 */
const navItem = z.object({
  ...baseItem,
  children: z.array(childItem).max(24).optional(),
  /** 2.19 — shown beside a full-screen menu while this item is under the pointer. */
  imageUrl: imageUrl.optional(),
});

export type NavItem = z.infer<typeof navItem>;

const footerColumn = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().max(60),
  /**
   * `main` is a column in the footer grid; `legal` sits in the bottom bar
   * beside the copyright, which is where short policy links belong.
   */
  placement: z.enum(['main', 'legal']).optional(),
  items: z.array(childItem).max(20),
});

export type FooterColumn = z.infer<typeof footerColumn>;

/** Networks the footer can draw an icon for. Anything else is a footer link. */
export const SOCIAL_NETWORKS = [
  'x', 'linkedin', 'instagram', 'facebook', 'youtube', 'github', 'tiktok',
  // 2.18
  'behance', 'dribbble', 'vimeo', 'pinterest', 'telegram', 'whatsapp', 'discord', 'threads', 'reddit', 'twitch', 'medium', 'email', 'phone',
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  x: 'X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  github: 'GitHub',
  tiktok: 'TikTok',
  behance: 'Behance',
  dribbble: 'Dribbble',
  vimeo: 'Vimeo',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  threads: 'Threads',
  reddit: 'Reddit',
  twitch: 'Twitch',
  medium: 'Medium',
  email: 'Email',
  phone: 'Phone',
};

/** The short form a link shows under the `short` style — "Fb.", "Ig." — unless it has its own. */
export const SOCIAL_SHORT: Record<SocialNetwork, string> = {
  x: 'X.',
  linkedin: 'Lk.',
  instagram: 'Ig.',
  facebook: 'Fb.',
  youtube: 'Yt.',
  github: 'Gh.',
  tiktok: 'Tt.',
  behance: 'Be.',
  dribbble: 'Dr.',
  vimeo: 'Vm.',
  pinterest: 'Pi.',
  telegram: 'Tg.',
  whatsapp: 'Wa.',
  discord: 'Dc.',
  threads: 'Th.',
  reddit: 'Rd.',
  twitch: 'Tw.',
  medium: 'Md.',
  email: 'Em.',
  phone: 'Ph.',
};

/** How the site's own profile links are labelled in the header and footer (2.18). */
export const SOCIAL_LABEL_STYLES = ['icon', 'name', 'short'] as const;
export type SocialLabelStyle = (typeof SOCIAL_LABEL_STYLES)[number];

const socialLink = z.object({
  network: z.enum(SOCIAL_NETWORKS),
  href,
  /** Its own short label, for the `short` style ("Be." rather than the default). */
  short: z.string().trim().max(8).optional(),
});
export type SocialLink = z.infer<typeof socialLink>;

/** What a link says under a label style: nothing (an icon), its name, or its short form. */
export function socialText(link: SocialLink, style: SocialLabelStyle): string | null {
  if (style === 'name') return SOCIAL_LABELS[link.network];
  if (style === 'short') return link.short || SOCIAL_SHORT[link.network];
  return null;
}

/** Profiles on the web — what `sameAs` lists. An email address or a phone number is not a profile. */
export const isProfile = (link: SocialLink) => /^https?:\/\//i.test(link.href) && link.network !== 'email' && link.network !== 'phone';

/** A mailto: or tel: opens here; only a web profile opens a new tab. */
export const opensElsewhere = (link: SocialLink) => /^https?:\/\//i.test(link.href);

const cta = z.object({ label: z.string().trim().min(1).max(60), href });

export const navigationSchema = z.object({
  header: z.array(navItem).max(12).optional(),
  /** 2.19 (T26) — the full-screen menu's own list, when it should differ from the header's. */
  overlay: z.array(navItem).max(12).optional(),
  headerCta: cta.optional(),
  /** A quieter second button beside the first ("Log in"). */
  headerSecondaryCta: cta.optional(),
  footer: z.array(footerColumn).max(6).optional(),
  /** Replaces the generated "© year Name" line when set. */
  footerNote: z.string().trim().max(300).optional(),
  /** Postal address shown by the brand-block footer. Plain text, line breaks kept. */
  footerAddress: z.string().trim().max(300).optional(),
  social: z.array(socialLink).max(20).optional(),
  /** 2.18 — icons (as before), names, or short labels ("Fb. / Ig. / Lk."). */
  socialStyle: z.enum(SOCIAL_LABEL_STYLES).optional(),
});

export type Navigation = z.infer<typeof navigationSchema>;

export const emptyNavigation: Navigation = {};

/** Never throws: a malformed row degrades to the bundled menus. */
export function parseNavigation(value: unknown): Navigation {
  const result = navigationSchema.safeParse(value ?? {});
  return result.success ? result.data : emptyNavigation;
}

export type LinkAttrs = { title?: string; target?: '_blank'; rel?: string };

/** Everything a link needs, including the rel an external target requires. */
export function linkAttrs(item: {
  href: string;
  target?: 'self' | 'blank';
  title?: string;
}): LinkAttrs {
  const external = /^https?:\/\//i.test(item.href);
  return {
    ...(item.title ? { title: item.title } : {}),
    ...(item.target === 'blank'
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : external
        ? { rel: 'noopener noreferrer' }
        : {}),
  };
}
