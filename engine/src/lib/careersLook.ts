import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   3.29 — how the careers pages are drawn (Appearance → Careers)
   ───────────────────────────────────────────────────────────────────────────
   Stored in the theme row as `careers`. Every option unset draws the pages
   exactly as before: a list of rows, the standard advert, labelled fields.
   ═══════════════════════════════════════════════════════════════════════════ */

/* 3.30 — the checked values a type style takes. Local, like blog.ts's: theme.ts imports this file. */
const LENGTH = /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/;
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const LINE = /^(\d*\.?\d+|\d*\.?\d+(px|rem|em))$/;
const TRACKING = /^(0|-?\d*\.?\d+(px|rem|em))$/;
const len = () => z.string().trim().max(40).refine((v) => LENGTH.test(v), 'Not a valid CSS length').optional();

/** 3.30 — a run of words drawn in a face, size, weight and colour of its own; each unset keeps the drawn one. */
export const careersTypeSchema = z.object({
  /** The text's face or the headings'. */
  font: z.enum(['body', 'display']).optional(),
  size: len(),
  sizeMobile: len(),
  weight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
  line: z.string().trim().max(20).refine((v) => LINE.test(v), 'A line height').optional(),
  tracking: z.string().trim().max(20).refine((v) => TRACKING.test(v), 'A spacing such as -0.5px').optional(),
  color: z.string().trim().max(60).refine((v) => COLOUR.test(v), 'Not a colour').optional(),
});
export type CareersType = z.infer<typeof careersTypeSchema>;

export const careersLookSchema = z.object({
  /** The listing: rows (as before) or cards in a grid. */
  list: z.enum(['rows', 'cards']).optional(),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  /** Cards: "LOCATION · WORKING TIME" above the title, and a button to the advert. */
  kicker: z.boolean().optional(),
  button: z.boolean().optional(),
  /** The advert: standard (as before) or the cover beside a panel holding the details, the text and the form. */
  page: z.enum(['standard', 'aside']).optional(),
  /** An icon beside each detail. */
  icons: z.boolean().optional(),
  /** The application form: labels above the fields (as before) or the words inside them; the CV as a drop zone. */
  form: z.enum(['labels', 'placeholders']).optional(),
  dropZone: z.boolean().optional(),
  /** After applying: "Back to the homepage" and "Explore other jobs" under the thanks. */
  doneButtons: z.boolean().optional(),
  /** A saved block shown after every advert — a closing band, say. */
  afterSavedBlock: z.string().uuid().optional(),
  /** 3.30 — a role's title in the listing, and the advert's section headings (about the role, responsibilities, the offer). */
  cardTitle: careersTypeSchema.optional(),
  headings: careersTypeSchema.optional(),
  /** 3.30 — the space under the application form's heading; unset is the heading's own margin. */
  applyGap: len(),
});

export type CareersLook = z.infer<typeof careersLookSchema>;

export type ResolvedCareersLook = {
  list: 'rows' | 'cards';
  columns: 2 | 3;
  kicker: boolean;
  button: boolean;
  page: 'standard' | 'aside';
  icons: boolean;
  form: 'labels' | 'placeholders';
  dropZone: boolean;
  doneButtons: boolean;
  afterSavedBlock?: string;
};

export function resolveCareersLook(look: CareersLook | undefined): ResolvedCareersLook {
  return {
    list: look?.list ?? 'rows',
    columns: look?.columns ?? 3,
    kicker: look?.kicker === true,
    button: look?.button === true,
    page: look?.page ?? 'standard',
    icons: look?.icons === true,
    form: look?.form ?? 'labels',
    dropZone: look?.dropZone === true,
    doneButtons: look?.doneButtons === true,
    afterSavedBlock: look?.afterSavedBlock,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3.30 — the careers words' own type, as CSS. Unlayered (it goes out with
   the theme), so it beats the careers stylesheet and the `m-0` utility on a
   heading. A rule only when its value is set, and every value checked again:
   it lands in a <style> element.
   ═══════════════════════════════════════════════════════════════════════════ */

const ok = (re: RegExp, v: unknown): v is string => typeof v === 'string' && re.test(v.trim());
const FACES = { body: 'var(--he-body-family)', display: 'var(--font-display)' } as const;

function typeRule(selector: string, type: CareersType | undefined): string[] {
  if (!type) return [];
  const decls = [
    ['font-family', type.font ? FACES[type.font] : undefined],
    ['font-size', ok(LENGTH, type.size) ? type.size.trim() : undefined],
    ['font-weight', typeof type.weight === 'string' && /^[3-8]00$/.test(type.weight) ? type.weight : undefined],
    ['line-height', ok(LINE, type.line) ? type.line.trim() : undefined],
    ['letter-spacing', ok(TRACKING, type.tracking) ? type.tracking.trim() : undefined],
    ['color', ok(COLOUR, type.color) ? type.color.trim() : undefined],
  ].filter(([, v]) => v !== undefined);
  const out = decls.length ? [`${selector}{${decls.map(([p, v]) => `${p}:${v}`).join(';')}}`] : [];
  if (ok(LENGTH, type.sizeMobile)) out.push(`@media (max-width:768px){${selector}{font-size:${type.sizeMobile.trim()}}}`);
  return out;
}

export function careersCss(look: CareersLook | undefined): string {
  if (!look) return '';
  const out: string[] = [];
  const cardTitle = typeRule(':is(.he-jobc__title,.he-job-card__title)', look.cardTitle);
  out.push(...cardTitle);
  // A colour of its own would also hold the card's title still under the pointer; it keeps lighting up as drawn.
  if (ok(COLOUR, look.cardTitle?.color)) out.push('.he-jobc:hover .he-jobc__title{color:var(--color-flare)}');
  out.push(...typeRule('.he-job__section>h2', look.headings));
  if (ok(LENGTH, look.applyGap)) out.push(`.he-job__applytitle{margin-bottom:${look.applyGap.trim()}}`);
  return out.join('');
}
