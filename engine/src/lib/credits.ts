/* ═══════════════════════════════════════════════════════════════════════════
   Who made the platform (3.0)
   ───────────────────────────────────────────────────────────────────────────
   The words are fixed — these are the platform's credits, not the site's, so
   no theme or translation reaches them — and shown read-only in Settings.

   Printing them in every page's source as `<meta name="generator">` and
   `<meta name="creator">` is the site owner's choice since 3.32, and **off
   unless switched on** (Settings → SEO, `seo.platformCredits`). A security
   review of a live site asked for that: the generator tells anybody looking
   for an exploit which platform to try, and the creator put a person's name
   on somebody else's production pages with no way to remove it. The version
   was always left out for the same reason. Neither tag is read for ranking,
   and nothing here touches the title, description, canonical or structured
   data — those stay the site's own.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PLATFORM_NAME = 'Claude Engine Builder';
export const PLATFORM_CREATOR = 'Gevorg Andreasyan';

/** The two tags, in the shape Next's metadata takes them. */
export const PLATFORM_META = { generator: PLATFORM_NAME, creator: PLATFORM_CREATOR } as const;

/** The tags for a page's metadata: both when the site has switched them on, none otherwise. */
export function platformMeta(enabled: boolean | undefined): Partial<typeof PLATFORM_META> {
  return enabled === true ? PLATFORM_META : {};
}
