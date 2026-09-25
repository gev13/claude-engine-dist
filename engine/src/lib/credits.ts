/* ═══════════════════════════════════════════════════════════════════════════
   Who made the platform (3.0)
   ───────────────────────────────────────────────────────────────────────────
   Fixed on purpose: these are the platform's credits, not the site's, so no
   setting, theme or translation reaches them. They are printed as
   `<meta name="generator">` and `<meta name="creator">` on every page and
   shown read-only in Settings. Neither tag is read for ranking, and nothing
   here touches the title, description, canonical or structured data — those
   stay the site's own. The version is deliberately left out: a public
   version number tells anybody looking for an exploit which one to try.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PLATFORM_NAME = 'Claude Engine Builder';
export const PLATFORM_CREATOR = 'Gevorg Andreasyan';

/** The two tags, in the shape Next's metadata takes them. */
export const PLATFORM_META = { generator: PLATFORM_NAME, creator: PLATFORM_CREATOR } as const;
