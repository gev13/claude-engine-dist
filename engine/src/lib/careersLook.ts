import { z } from 'zod';
import { type TypeStyle, typeRule, typeStyleSchema } from './typeStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   3.29 — how the careers pages are drawn (Appearance → Careers)
   ───────────────────────────────────────────────────────────────────────────
   Stored in the theme row as `careers`. Every option unset draws the pages
   exactly as before: a list of rows, the standard advert, labelled fields.
   ═══════════════════════════════════════════════════════════════════════════ */

/* 3.30 — the checked values a type style takes. Local, like blog.ts's: theme.ts imports this file. */
const LENGTH = /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/;
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const len = () => z.string().trim().max(40).refine((v) => LENGTH.test(v), 'Not a valid CSS length').optional();
/* 3.33 — the grammars the advert's looks use. */
const BOX = /^(0|-?\d*\.?\d+(px|rem|em|%))(\s+(0|-?\d*\.?\d+(px|rem|em|%))){0,3}$/;
const TRACKS = /^\d{1,5}(?:\.\d{1,3})?(?:fr|px|rem|%)\s+\d{1,5}(?:\.\d{1,3})?(?:fr|px|rem|%)$/;
const POSITION = /^(\d{1,3}(?:\.\d{1,2})?%|left|center|right)(\s+(\d{1,3}(?:\.\d{1,2})?%|top|center|bottom))?$/;
const SHADOW = /^-?\d{1,3}(?:px)?\s+-?\d{1,3}(?:px)?\s+\d{1,3}(?:px)?(\s+-?\d{1,3}px)?\s+(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const isClear = (v: string) => v.trim() === 'transparent' || COLOUR.test(v.trim());
const box = () => z.string().trim().max(60).refine((v) => BOX.test(v.trim()), 'One to four sizes, such as 20px 24px').optional();
const colour = () => z.string().trim().max(60).refine((v) => COLOUR.test(v.trim()), 'Not a colour').optional();
const clear = () => z.string().trim().max(60).refine(isClear, 'A colour, or transparent').optional();
const position = () => z.string().trim().max(30).refine((v) => POSITION.test(v.trim()), 'Such as 72% 50%, or center top').optional();

/** 3.30 — a run of words drawn in a face, size, weight and colour of its own; each unset keeps the drawn one. */
export const careersTypeSchema = typeStyleSchema;
export type CareersType = TypeStyle;

export const careersLookSchema = z.object({
  /** The listing: rows (as before) or cards in a grid. */
  list: z.enum(['rows', 'cards']).optional(),
  columns: z.union([z.literal(2), z.literal(3)]).optional(),
  /** Cards: "LOCATION · WORKING TIME" above the title, and a button to the advert. */
  kicker: z.boolean().optional(),
  button: z.boolean().optional(),
  /** The advert: standard (as before) or the cover beside a panel holding the details, the text and the form. */
  page: z.enum(['standard', 'aside', 'centered']).optional(),
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

  /* 3.33 — the listing as a section of its own. */
  sectionBackground: clear(),
  sectionBackgroundMobile: clear(),
  sectionRadius: box(),
  sectionRadiusMobile: box(),
  sectionMargin: box(),
  sectionMarginMobile: box(),
  sectionPadding: box(),
  sectionPaddingMobile: box(),
  /* 3.33 — the cards. */
  cardBackground: clear(),
  cardBackgroundMobile: clear(),
  cardShadow: z.string().trim().max(120).refine((v) => SHADOW.test(v.trim()), 'Such as 18px 17px 54px rgba(0,0,0,0.1)').optional(),
  cardMinHeight: len(),
  cardMinHeightMobile: len(),
  cardPadding: box(),
  cardPaddingMobile: box(),
  cardGap: len(),
  cardPartGap: len(),
  cardFootGap: len(),
  cardFootSpace: len(),
  kickerType: typeStyleSchema.optional(),
  excerptType: typeStyleSchema.optional(),
  postedType: typeStyleSchema.optional(),
  excerptLines: z.number().int().min(1).max(8).optional(),
  excerptLinesMobile: z.number().int().min(1).max(8).optional(),
  titleHoverColor: colour(),
  /** The Explore button: the outline one (as before) or the site's filled one, with its own fill, words, corners and padding. */
  buttonLook: z.enum(['outline', 'primary']).optional(),
  buttonFill: colour(),
  buttonText: colour(),
  buttonRadius: box(),
  buttonPadding: box(),
  buttonGap: len(),
  buttonType: typeStyleSchema.optional(),
  /* 3.33 — the advert. */
  advertColumns: z.string().trim().max(40).refine((v) => TRACKS.test(v.trim()), 'Two widths, such as 744fr 572fr').optional(),
  columnsGap: len(),
  columnsGapMobile: len(),
  sticky: z.boolean().optional(),
  stickyTop: len(),
  advertPadding: box(),
  advertPaddingMobile: box(),
  titleType: typeStyleSchema.optional(),
  titleGap: len(),
  titleInset: len(),
  eyebrowType: typeStyleSchema.optional(),
  /** The centred advert: the heading's place on phones. */
  headLeftMobile: z.boolean().optional(),
  panelBackground: clear(),
  panelBackgroundMobile: clear(),
  panelRadius: box(),
  panelRadiusMobile: box(),
  panelPadding: box(),
  panelPaddingMobile: box(),
  panelTop: len(),
  sideTop: len(),
  sectionsGap: len(),
  headingsGap: len(),
  bodyType: typeStyleSchema.optional(),
  paragraphGap: len(),
  datesGap: len(),
  datesLabelType: typeStyleSchema.optional(),
  datesValueType: typeStyleSchema.optional(),
  detailsType: typeStyleSchema.optional(),
  detailsColumnsMobile: z.union([z.literal(1), z.literal(2)]).optional(),
  detailsGap: len(),
  detailsInset: len(),
  iconColor: colour(),
  coverPosition: position(),
  coverPositionMobile: position(),
  coverRadius: box(),
  coverRadiusMobile: box(),
  coverGap: len(),
  /* 3.33 — the application card. */
  applyBackground: clear(),
  applyBackgroundMobile: clear(),
  applyRadius: box(),
  applyRadiusMobile: box(),
  applyPadding: box(),
  applyPaddingMobile: box(),
  applyTop: len(),
  applyTitle: typeStyleSchema.optional(),
  groupType: typeStyleSchema.optional(),
  groupGap: len(),
});

export type CareersLook = z.infer<typeof careersLookSchema>;

export type ResolvedCareersLook = {
  list: 'rows' | 'cards';
  columns: 2 | 3;
  kicker: boolean;
  button: boolean;
  page: 'standard' | 'aside' | 'centered';
  icons: boolean;
  form: 'labels' | 'placeholders';
  dropZone: boolean;
  doneButtons: boolean;
  afterSavedBlock?: string;
  buttonLook: 'outline' | 'primary';
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
    buttonLook: look?.buttonLook ?? 'outline',
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3.30 — the careers words' own type, as CSS. Unlayered (it goes out with
   the theme), so it beats the careers stylesheet and the `m-0` utility on a
   heading. A rule only when its value is set, and every value checked again:
   it lands in a <style> element.
   ═══════════════════════════════════════════════════════════════════════════ */

const ok = (re: RegExp, v: unknown): v is string => typeof v === 'string' && re.test(v.trim());
type Decls = [string, string | undefined][];
function rule(selector: string, list: Decls): string {
  const body = list.filter(([, v]) => v !== undefined && v !== '').map(([p, v]) => `${p}:${v}`).join(';');
  return body ? `${selector}{${body}}` : '';
}
const phone = (css: string) => (css ? `@media (max-width:768px){${css}}` : '');
const lenOf = (v: unknown) => (ok(LENGTH, v) ? (v as string).trim() : undefined);
const boxOf = (v: unknown) => (ok(BOX, v) ? (v as string).trim().replace(/\s+/g, ' ') : undefined);
const colourOf = (v: unknown) => (ok(COLOUR, v) ? (v as string).trim() : undefined);
const clearOf = (v: unknown) => (typeof v === 'string' && v.trim() === 'transparent' ? 'transparent' : colourOf(v));
const posOf = (v: unknown) => (ok(POSITION, v) ? (v as string).trim() : undefined);

export function careersCss(look: CareersLook | undefined): string {
  if (!look) return '';
  const out: string[] = [];
  const cardTitle = typeRule(':is(.he-jobc__title,.he-job-card__title)', look.cardTitle);
  out.push(...cardTitle);
  // A colour of its own would also hold the card's title still under the pointer; it keeps lighting up as drawn.
  if (ok(COLOUR, look.cardTitle?.color)) out.push(`.he-jobc:hover .he-jobc__title{color:${colourOf(look.titleHoverColor) ?? 'var(--color-flare)'}}`);
  else if (colourOf(look.titleHoverColor)) out.push(`.he-jobc:hover .he-jobc__title{color:${colourOf(look.titleHoverColor)}}`);
  out.push(...typeRule('.he-job__section>h2', look.headings));
  if (ok(LENGTH, look.applyGap)) out.push(`.he-job__applytitle{margin-bottom:${look.applyGap.trim()}}`);

  // 3.33 — the listing's section.
  const section = '.he-jobs-sec';
  out.push(rule(section, [['background-color', clearOf(look.sectionBackground)], ['border-radius', boxOf(look.sectionRadius)], ['margin', boxOf(look.sectionMargin)], ['border-width', clearOf(look.sectionBackground) ? '0' : undefined]]));
  out.push(rule(`${section}>.shell`, [['padding', boxOf(look.sectionPadding)]]));
  out.push(phone(rule(section, [['background-color', clearOf(look.sectionBackgroundMobile)], ['border-radius', boxOf(look.sectionRadiusMobile)], ['margin', boxOf(look.sectionMarginMobile)]]) + rule(`${section}>.shell`, [['padding', boxOf(look.sectionPaddingMobile)]])));

  // 3.33 — the cards.
  out.push(rule('.he-jobcards', [['gap', lenOf(look.cardGap)]]));
  out.push(rule('.he-jobc', [['background-color', clearOf(look.cardBackground)], ['box-shadow', ok(SHADOW, look.cardShadow) ? look.cardShadow!.trim() : undefined], ['min-height', lenOf(look.cardMinHeight)], ['padding', boxOf(look.cardPadding)], ['gap', lenOf(look.cardPartGap)], ['justify-content', lenOf(look.cardMinHeight) ? 'flex-end' : undefined]]));
  out.push(phone(rule('.he-jobc', [['background-color', clearOf(look.cardBackgroundMobile)], ['min-height', lenOf(look.cardMinHeightMobile)], ['padding', boxOf(look.cardPaddingMobile)]])));
  out.push(rule('.he-jobc__foot', [['gap', lenOf(look.cardFootGap)], ['padding-top', lenOf(look.cardFootSpace)]]));
  out.push(...typeRule('.he-jobc__kicker', look.kickerType), ...typeRule('.he-jobc__excerpt', look.excerptType), ...typeRule('.he-jobc__when', look.postedType));
  const lines = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8 ? `-webkit-line-clamp:${n};line-clamp:${n}` : '');
  if (lines(look.excerptLines)) out.push(`.he-jobc__excerpt{${lines(look.excerptLines)}}`);
  if (lines(look.excerptLinesMobile)) out.push(phone(`.he-jobc__excerpt{${lines(look.excerptLinesMobile)}}`));
  const button = '.he-jobc .he-jobc__btn,.he-jobc:hover .he-jobc__btn';
  out.push(rule(button, [['background-color', colourOf(look.buttonFill)], ['color', colourOf(look.buttonText)], ['border-radius', boxOf(look.buttonRadius)], ['padding', boxOf(look.buttonPadding)], ['gap', lenOf(look.buttonGap)], ['border-color', colourOf(look.buttonFill) ? 'transparent' : undefined]]));
  out.push(...typeRule('.he-jobc .he-jobc__btn', look.buttonType));

  // 3.33 — the advert's columns, in either layout that has them.
  const grid = ':is(.he-job-aside,.he-job-c)';
  if (ok(TRACKS, look.advertColumns)) out.push(`@media (min-width:1025px){${grid}{grid-template-columns:${look.advertColumns.trim().split(/\s+/).map((t) => (t.endsWith('fr') ? `minmax(0,${t})` : t)).join(' ')}}}`);
  out.push(rule(grid, [['gap', lenOf(look.columnsGap)]]));
  out.push(phone(rule(grid, [['gap', lenOf(look.columnsGapMobile)]])));
  if (look.sticky) out.push(`@media (min-width:1025px){:is(.he-job-aside__head,.he-job-c__side){position:sticky;top:${lenOf(look.stickyTop) ?? 'calc(var(--he-header-h,72px) + 24px)'};align-self:start}}`);
  out.push(rule('.he-job-sec>.shell', [['padding', boxOf(look.advertPadding)]]));
  out.push(phone(rule('.he-job-sec>.shell', [['padding', boxOf(look.advertPaddingMobile)]])));
  const title = ':is(.he-job-aside__title,.he-job-c__title)';
  out.push(...typeRule(title, look.titleType));
  // In the centred layout the space under the title is its head's: the title's own margin is a utility's.
  out.push(rule('.he-job-aside__title', [['margin-bottom', lenOf(look.titleGap)]]));
  out.push(rule('.he-job-c__head', [['margin-bottom', lenOf(look.titleGap)]]));
  out.push(rule(title, [['padding-inline', lenOf(look.titleInset)]]));
  out.push(...typeRule('.he-job-c__head .type-eyebrow', look.eyebrowType));
  if (look.headLeftMobile) out.push(phone('.he-job-c__head{text-align:left}.he-job-c__head .he-eyebrow{justify-content:flex-start}'));
  const panel = '.he-job-aside__panel';
  out.push(rule(panel, [['background-color', clearOf(look.panelBackground)], ['border-radius', boxOf(look.panelRadius)], ['clip-path', boxOf(look.panelRadius) ? 'none' : undefined], ['padding', boxOf(look.panelPadding)]]));
  out.push(phone(rule(panel, [['background-color', clearOf(look.panelBackgroundMobile)], ['border-radius', boxOf(look.panelRadiusMobile)], ['padding', boxOf(look.panelPaddingMobile)]])));
  out.push(rule('.he-job-c__main', [['padding-top', lenOf(look.panelTop)]]));
  out.push(rule('.he-job__section', [['margin-top', lenOf(look.sectionsGap)]]));
  out.push(rule('.he-job__section>h2', [['margin-bottom', lenOf(look.headingsGap)]]));
  out.push(...typeRule('.he-job__section .prose-edge p', look.bodyType));
  out.push(rule('.he-job__section .prose-edge p', [['margin-block', lenOf(look.paragraphGap) ? `0 ${lenOf(look.paragraphGap)}` : undefined]]));
  out.push(rule('.he-job__dates', [['margin-top', lenOf(look.datesGap)]]));
  out.push(...typeRule('.he-job__dates dt', look.datesLabelType), ...typeRule('.he-job__dates dd', look.datesValueType));
  out.push(...typeRule('.he-job__meta.has-icons dd', look.detailsType));
  out.push(rule('.he-job__meta', [['gap', lenOf(look.detailsGap)], ['padding-inline', lenOf(look.detailsInset)]]));
  if (look.detailsColumnsMobile === 1 || look.detailsColumnsMobile === 2) out.push(phone(`.he-job__meta{grid-template-columns:repeat(${look.detailsColumnsMobile},minmax(0,1fr))}`));
  out.push(rule('.he-job__icon', [['color', colourOf(look.iconColor)]]));
  const cover = '.he-job-aside__cover';
  out.push(rule(`${cover} .he-fill`, [['object-position', posOf(look.coverPosition)]]));
  out.push(phone(rule(`${cover} .he-fill`, [['object-position', posOf(look.coverPositionMobile)]])));
  out.push(rule(cover, [['border-radius', boxOf(look.coverRadius)], ['clip-path', boxOf(look.coverRadius) ? 'none' : undefined]]));
  out.push(phone(rule(cover, [['border-radius', boxOf(look.coverRadiusMobile)]])));
  out.push(rule('.he-job-c__side', [['gap', lenOf(look.coverGap)], ['padding-top', lenOf(look.sideTop)]]));
  out.push(phone(rule('.he-job-c__side', [['padding-top', lenOf(look.sideTop) ? '0' : undefined]])));
  out.push(phone(rule('.he-job-c__main', [['padding-top', lenOf(look.panelTop) ? '0' : undefined]])));
  const apply = '.he-job-aside__apply';
  out.push(rule(apply, [['background-color', clearOf(look.applyBackground)], ['border-radius', boxOf(look.applyRadius)], ['clip-path', boxOf(look.applyRadius) ? 'none' : undefined], ['padding', boxOf(look.applyPadding)], ['margin-top', lenOf(look.applyTop)]]));
  out.push(phone(rule(apply, [['background-color', clearOf(look.applyBackgroundMobile)], ['border-radius', boxOf(look.applyRadiusMobile)], ['padding', boxOf(look.applyPaddingMobile)], ['margin-inline', boxOf(look.applyPaddingMobile) ? '0' : undefined]])));
  out.push(...typeRule('.he-job__applytitle', look.applyTitle));
  out.push(...typeRule('.he-apply__group', look.groupType));
  if (look.groupType?.size) out.push('.he-apply__group{text-transform:none;letter-spacing:0}');
  out.push(rule('.he-apply__group', [['margin-bottom', lenOf(look.groupGap)]]));
  return out.filter(Boolean).join('');
}
