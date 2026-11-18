import { TIER_RANGE } from './tierRange';

/* ═══════════════════════════════════════════════════════════════════════════
   A floor under headings (3.36)
   ───────────────────────────────────────────────────────────────────────────
   Appearance → Layout → *Space under a heading*. On the tiers asked for, a
   heading followed straight away by paragraph text has at least `min` between
   the two. A larger space stays as it is; nothing here can shrink a gap.

   Two ways, after how the part lays its words out:

   - Words stacked in the normal flow (most parts, rich text, page heads): an
     empty block after the heading's words carries the floor as its bottom
     margin. It collapses with the heading's own margin and the text's, so the
     space is the largest of the three — whatever set those, a block's own
     option, the theme or a site's own CSS — and the heading's box is the same.
   - Words in a flex or grid column (the cards listed in FLEX): margins don't
     collapse there, so the heading's own bottom margin makes up what the
     column's gap and the text's own margin leave short of the floor.

   A heading whose own pseudo-elements draw something (the glitch effect's
   copies) takes the floor as its own bottom margin, with no weight, so any
   rule that sets it wins. Parts whose heading sits beside its text, or
   whose text is folded away until pointed at, are left out (EXCLUDE).
   Nothing is written unset.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tier = keyof typeof TIER_RANGE;
const TIERS: Tier[] = ['base', 'laptop', 'tablet', 'mobile'];
const LENGTH = /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/;

const HEADS = 'h1,h2,h3,h4,h5,h6';
/** What counts as paragraph text right after a heading. */
const TEXT = 'p,.prose-edge,.he-ucard__body';

/** Headings the empty block leaves alone: laid out in a column (FLEX takes them), beside their text, or folded away. */
const EXCLUDE = [
  '.he-plst__text>*',
  '.he-jobc>*',
  '.he-team__grid.is-portrait .he-team__member>*',
  '.he-team__profile>*',
  '.he-flip__content>*',
  '.he-card__body>*',
  '.he-news__body>*',
  '.he-feat__lead>*',
  '.he-fgrid__item>*',
  '.he-post-aside__text>*',
  '.he-catidx__card>*',
  '.he-story__item>*',
  '.he-ucard>*',
  '.he-band.is-group-center .he-band__text>*',
  '.he-proj.is-minimal .he-proj__text>*',
  '.he-fgrid.is-expand-reveal .he-ocard__text>*',
].join(',');
/** Headings whose own `::before`/`::after` draw something (the glitch copies): the floor is their bottom margin instead. */
const OWN_AFTER = '.he-glitch-t,.he-story__title';

/**
 * A heading in a flex or grid column, with what already sits between it and
 * its text: the column's gap plus the text's own top margin. The heading's
 * bottom margin becomes the larger of its own and the floor less that.
 */
type Column = { heading: string; text: string; between: string; own?: string; tiers?: Tier[] };

function columns(tier: Tier, careersPartGap: string | undefined): Column[] {
  const wide = tier !== 'mobile';
  return [
    { heading: '.he-plst__text>.he-plst__title', text: '.he-plst__excerpt', between: '8px' },
    { heading: '.he-plst.is-compact .he-plst__text>.he-plst__title', text: '.he-plst__excerpt', between: '4px' },
    { heading: '.he-jobc>.he-jobc__title', text: '.he-jobc__excerpt', between: careersPartGap ?? '8px' },
    { heading: '.he-team__grid.is-portrait .he-team__member>.he-team__name', text: '.he-team__role', between: '10px' },
    { heading: '.he-team__profile>.he-team__name', text: '.he-team__role', between: '4px' },
    { heading: '.he-flip__content>.he-flip__title', text: '.he-flip__text', between: '10px' },
    { heading: '.he-card__body>.he-card__title', text: '.he-card__text', between: '8px' },
    { heading: '.he-car.has-title-gap .he-card__body>.he-card__title', text: '.he-card__text', between: '8px', own: 'calc(var(--he-car-title-gap) - 8px)' },
    { heading: '.he-news__body>.he-news__title', text: '.he-news__excerpt', between: '10px' },
    { heading: '.he-feat__lead>.he-feat__title', text: '.he-feat__excerpt', between: '12px' },
    { heading: '.he-fgrid__item>.he-fgrid__title', text: '.he-fgrid__body', between: '8px' },
    // The parts' own gap replaces their margins (3.33), tier by tier as the block sets it.
    { heading: '.he-fgrid.has-pg .he-fgrid__item>.he-fgrid__title', text: '.he-fgrid__body', between: 'var(--he-fgrid-pg)' },
    ...(tier === 'tablet' || tier === 'mobile' ? [{ heading: '.he-fgrid.has-pg-t .he-fgrid__item>.he-fgrid__title', text: '.he-fgrid__body', between: 'var(--he-fgrid-pg-t)' }] : []),
    ...(tier === 'mobile' ? [{ heading: '.he-fgrid.has-pg-m .he-fgrid__item>.he-fgrid__title', text: '.he-fgrid__body', between: 'var(--he-fgrid-pg-m)' }] : []),
    { heading: `.he-post-aside__text>:is(${HEADS})`, text: 'p', between: '28px' },
    { heading: '.he-catidx__card>.he-catidx__name', text: '.he-catidx__desc', between: '12px' },
    { heading: '.he-story__item>.he-story__title', text: '.he-story__body', between: '14px' },
    { heading: `.he-ucard>:is(${HEADS})`, text: '.he-ucard__body', between: '12px' },
    // A centred group is a column from tablets up; the text's margin is the band's body gap.
    ...(wide ? [{ heading: `.he-band.is-group-center .he-band__text>:is(${HEADS})`, text: '.he-lbody', between: 'var(--he-band-body-gap,16px)' }] : []),
  ];
}

export type HeadingSpace = { min?: string; at?: Tier[] };

/** The floor's rules, one media block per tier asked for; empty when unset. */
export function headingSpaceCss(space: HeadingSpace | undefined, careersPartGap?: string): string {
  const min = space?.min?.trim();
  if (!min || !LENGTH.test(min) || !space?.at?.length) return '';
  const gap = careersPartGap && LENGTH.test(careersPartGap.trim()) ? careersPartGap.trim() : undefined;
  const flow =
    `:where(${HEADS}):where(:not(${EXCLUDE},${OWN_AFTER})):where(:has(+ :is(${TEXT})))::after{content:"";display:block;margin-bottom:${min}}` +
    // No weight at all, so any rule that sets such a heading's margin wins; in the flow it still collapses with the text's.
    `:where(${HEADS}):where(.he-glitch-t):where(:not(${EXCLUDE})):where(:has(+ :is(${TEXT}))){margin-bottom:${min}}`;
  return TIERS.filter((tier) => space.at!.includes(tier))
    .map((tier) => {
      const rules = columns(tier, gap).map(({ heading, text, between, own }) => `${heading}:has(+ ${text}){margin-bottom:max(${own ?? '0px'},calc(${min} - ${between}))}`);
      return `@media ${TIER_RANGE[tier]}{${flow}${rules.join('')}}`;
    })
    .join('');
}
