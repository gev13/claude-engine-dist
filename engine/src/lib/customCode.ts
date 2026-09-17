import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Custom CSS, and an analytics tag
   ───────────────────────────────────────────────────────────────────────────
   The engine deliberately has no free-text *code* escape hatch: a snippet
   field that accepts JavaScript is stored cross-site scripting with a nicer
   name, and every editor account becomes a way to run script on every
   visitor's browser.

   Two narrower doors are open instead, because the reasons people ask for
   snippets are almost always these two:

     • **CSS**, which cannot execute anything. It is admin-gated, so the worst
       an author can do with it is make the site ugly — which they could
       already do by editing the page. The checks below are about it not
       escaping the `<style>` element it is written into, and not fetching
       from somewhere else.

     • **an analytics id**, not an analytics script. You give the engine a
       measurement id and it writes the tag itself, so the thing that ends up
       in the page is code this repository wrote and can be read here.

   Anything genuinely needing arbitrary JavaScript needs a code change, which
   is a review, which is the point.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CODE_SETTING_KEY = 'code';

/** Roughly forty pages of CSS. Past this, it wants to be a stylesheet. */
export const CSS_MAX = 50_000;

/**
 * Make a block of CSS safe to write into a `<style>` element.
 *
 * Three removals, each for a stated reason — the result is returned rather
 * than rejected, so a stray `@import` costs the import and not the rest of
 * somebody's stylesheet.
 */
export function safeCss(raw: string): string {
  return (
    raw
      /* The only way out of a <style> element is a closing tag. HTML parses
         `</style` inside it without caring what follows, so this is the one
         removal that is about safety rather than tidiness. */
      .replace(/<\/\s*style/gi, '')
      /* `@import` fetches from another origin, which the CSP would refuse and
         which would fail silently — and it is the usual way a CSS injection
         reaches for something external. */
      .replace(/@import[^;]*;?/gi, '')
      /* Dead in every current browser, and unambiguous about intent. */
      .replace(/expression\s*\(/gi, '')
      .replace(/javascript\s*:/gi, '')
      .slice(0, CSS_MAX)
  );
}

/** Did anything have to be taken out? Used to tell the editor rather than to refuse. */
export function cssWasChanged(raw: string): boolean {
  return safeCss(raw) !== raw.slice(0, CSS_MAX);
}

const css = z.string().max(CSS_MAX).transform(safeCss);

/**
 * A Google Analytics 4 measurement id.
 *
 * `G-` and then the id itself. Held to the shape rather than accepted as free
 * text, because it is interpolated into a script URL — and an id is all the
 * engine ever needs; the tag around it is written here.
 */
export const ANALYTICS_PATTERN = /^G-[A-Z0-9]{4,24}$/;

export const codeSchema = z.object({
  /** Loaded on every page of the site, after the theme. */
  css: css.default(''),
  /** Empty means no analytics at all, and nothing is loaded from Google. */
  analyticsId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === '' || ANALYTICS_PATTERN.test(value), 'A GA4 id looks like G-XXXXXXXXXX')
    .default(''),
});

export type SiteCode = z.output<typeof codeSchema>;

export const defaultCode = (): SiteCode => codeSchema.parse({});

/** Whether anything is actually switched on, so a site that wants none pays nothing. */
export const hasAnalytics = (code: SiteCode) => ANALYTICS_PATTERN.test(code.analyticsId);
