/* ═══════════════════════════════════════════════════════════════════════════
   P3-G — page templates and ready sections
   ───────────────────────────────────────────────────────────────────────────
   Ready-made starting points built only from the engine's own blocks and
   written fresh (after studying how Betheme's prebuilt sites are put
   together — nothing copied). A template is handed out as plain blocks with
   new ids; from then on it is an ordinary page that shares nothing with the
   template it came from.
   ═══════════════════════════════════════════════════════════════════════════ */

/** A block as written in a template, before it is given an id. Rows hold `columns: { width, blocks: Raw[] }[]`. */
export type Raw = { type: string; props: Record<string, unknown>; style?: Record<string, unknown> };

export type PageTemplate = {
  /** Stable, url-safe: it names the demo page /templates/<id>. */
  id: string;
  name: string;
  category: string;
  description: string;
  /** A demo picture that stands for the template on the demo's /templates page. */
  image: string;
  /** What a new page starts with; the author changes both. */
  page: { title: string; excerpt: string };
  blocks: Raw[];
};

export type SectionTemplate = {
  id: string;
  name: string;
  group: string;
  description: string;
  blocks: Raw[];
};

export const b = (type: string, props: Record<string, unknown>, style?: Record<string, unknown>): Raw => ({ type, props, ...(style ? { style } : {}) });

export const link = (label: string, href: string, variant?: 'primary' | 'outline' | 'ghost') => ({ label, href, ...(variant ? { variant } : {}) });

/** A column of a row block in a template. */
export const col = (width: Record<string, number>, blocks: Raw[]) => ({ width, blocks });

/** An ISO date this many days from now — for countdowns, so a new page never opens on a date in the past. */
export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
