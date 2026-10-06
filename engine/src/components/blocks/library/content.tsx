import Link from '@/components/ui/SiteLink';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { MoreIcon } from '@/components/ui/More';
import { MessageText } from '@/components/site/MessageText';
import type { blockSchemas } from '@/lib/blocks';
import { isColor } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { itemClass } from '@/lib/itemStyle';
import { BlockHead, BlockTitle } from '../parts';
import { CountUp } from './CountUp';
import { MediaFill } from './media';
import { ParallaxLayer } from './ParallaxLayer';
import { QuoteMedia } from './QuoteMedia';
import { SiteImg } from '@/components/ui/SiteImg';
import { gapTiers } from './gapTiers';
import type { ButtonPad } from '@/lib/buttonPad';

/* ═══════════════════════════════════════════════════════════════════════════
   Library content sections (CT1–CT5, CT8–CT10, CT14, CT16)
   ───────────────────────────────────────────────────────────────────────────
   Server components. The interactive ones — tabs, the colour picker, the
   product window, the sub-nav and the image accordion — live in their own
   client files next to this one.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;
type LibLink = { label: string; href: string; arrow?: boolean; pad?: ButtonPad };

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

/** One or two buttons: the first filled, the second outlined. */
export function Actions({ links, className }: { links: LibLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={cn('he-actions', className)}>
      {links.map((l, i) => (
        <Button key={l.href + i} href={l.href} variant={i === 0 ? 'primary' : 'outline'} withArrow={l.arrow === true || undefined} pad={l.pad}>
          {l.label}
        </Button>
      ))}
    </div>
  );
}

/* ── CT1: split editorial ─────────────────────────────────────────────────── */

export function SplitMedia(p: P<'splitMedia'>) {
  return (
    <section className={cn('he-lsec he-split', toneClass(p.tone), p.mediaSide === 'right' && 'is-media-right')}>
      <div className="shell he-split__grid">
        <div className={cn('he-split__media', `is-${p.shape}`, `is-${p.ratio}`)}>
          <MediaFill imageUrl={p.imageUrl} videoUrl={p.videoUrl} alt={p.alt} className="he-fill" />
        </div>
        <div className="he-split__text">
          {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
          <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>
          {p.body && <p className="he-lbody">{p.body}</p>}
          <Actions links={p.links} />
        </div>
      </div>
    </section>
  );
}

/* ── CT2: text card over an image ─────────────────────────────────────────── */

export function OverlayCard(p: P<'overlayCard'>) {
  return (
    <section className={cn('he-ovc', `is-${p.placement}`)}>
      <div className="he-ovc__media">
        <MediaFill imageUrl={p.imageUrl} alt={p.alt} className="he-fill" />
      </div>
      <div className="shell he-ovc__shell">
        <div className="he-ovc__card">
          {p.eyebrow && <div className="he-ovc__eyebrow">{p.eyebrow}</div>}
          <span className="he-ovc__rule" aria-hidden="true" />
          <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>
          {p.body && <p className="he-lbody">{p.body}</p>}
          {p.link && <Actions links={[p.link]} />}
        </div>
      </div>
    </section>
  );
}

/* ── CT3: full-width media band ───────────────────────────────────────────── */

export function MediaBand(p: P<'mediaBand'>) {
  const media = <MediaFill imageUrl={p.imageUrl} mobileImageUrl={p.imageUrlMobile} videoUrl={p.videoUrl} alt={p.alt} className="he-band__bg" />;
  const hasText = Boolean(p.eyebrow || p.title || p.body || p.links.length);
  // Checked again: the colour lands in a style attribute.
  const fade = p.fade && (!p.fade.color || isColor(p.fade.color)) ? p.fade : undefined;
  return (
    <section
      className={cn(
        'he-band',
        `is-${p.position}`,
        `is-h-${p.height}`,
        `is-ov-${p.overlay}`,
        p.parallax !== 'none' && `has-parallax is-plx-${p.parallax} is-plx-${p.strength}`,
        fade && `has-fade is-fade-${fade.side} is-text-${fade.text}`,
        fade?.accentArrow && 'is-arrow-accent',
        // 3.15 — a phone picture of its own is shown whole there, without the fade.
        p.imageUrlMobile && !p.videoUrl && 'has-mobile-media',
        // 3.22 — a height of its own.
        p.heightCustom && 'has-h',
        p.heightCustomMobile && 'has-h-m',
      )}
      style={
        fade || p.heightCustom || p.heightCustomMobile
          ? ({
              ...(fade
                ? { ...(fade.color ? { '--he-fade-color': fade.color } : {}), ...(fade.ink ? { '--he-fade-ink': fade.ink } : {}), '--he-fade-solid': `${fade.solid}%`, '--he-fade-clear': `${Math.max(fade.solid, fade.clear)}%` }
                : {}),
              ...(p.heightCustom ? { '--he-band-h': p.heightCustom } : {}),
              ...(p.heightCustomMobile ? { '--he-band-h-m': p.heightCustomMobile } : {}),
            } as React.CSSProperties)
          : undefined
      }
    >
      {p.parallax !== 'none' ? <ParallaxLayer>{media}</ParallaxLayer> : media}
      {hasText && (
        <div className={cn('shell he-band__inner', p.textBox && 'has-text-box')} style={textBoxStyle(p.textBox)}>
          <div className="he-band__text">
            {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
            {p.title && <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>}
            {p.body && <p className="he-lbody">{p.body}</p>}
            <Actions links={p.links} />
          </div>
        </div>
      )}
    </section>
  );
}

/** 3.11 — a media band's text box as custom properties; only what was set. */
function textBoxStyle(box: P<'mediaBand'>['textBox']): React.CSSProperties | undefined {
  if (!box) return undefined;
  const style: Record<string, string> = {};
  if (box.paddingBlock) style['--he-band-py'] = box.paddingBlock;
  if (box.paddingBlockMobile) style['--he-band-py-m'] = box.paddingBlockMobile;
  if (box.inset) style['--he-band-inset'] = box.inset;
  if (box.bodyWidth) style['--he-band-body'] = box.bodyWidth;
  if (box.bodyGap) style['--he-band-body-gap'] = box.bodyGap;
  if (box.actionsGap) style['--he-band-actions-gap'] = box.actionsGap;
  return style as React.CSSProperties;
}

/** 3.13 — a figures row's number sizes, per screen, as custom properties; only what was set. */
function figureSizes(p: P<'stats'>): React.CSSProperties | undefined {
  const style: Record<string, string> = {};
  if (p.valueSize) style['--he-figs-size'] = p.valueSize;
  if (p.valueSizeTablet) style['--he-figs-size-tablet'] = p.valueSizeTablet;
  if (p.valueSizeMobile) style['--he-figs-size-mobile'] = p.valueSizeMobile;
  return Object.keys(style).length ? (style as React.CSSProperties) : undefined;
}

/* ── CT4 / CT5: card grid variants ────────────────────────────────────────── */

export function CardGridVariant(p: P<'cardGrid'> & { blockId?: string }) {
  const head = (p.title || p.eyebrow || p.intro) && (
    <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
  );
  /* An editor's gap rides along with the column count, so each of these
     grids gets it without four separate props. Unset leaves the layout's own
     spacing alone — they differ on purpose. */
  const gaps = gapTiers(p);
  const cols = {
    '--cols': p.columns,
    ...gaps.style,
    ...(p.mediaRatio ? { '--he-icard-ratio': p.mediaRatio.replace('/', ' / ') } : {}),
    // 3.22 — pictures that fit rather than fill, a cap on their height, and icons at a height of their own.
    ...(p.mediaFit === 'contain' ? { '--he-icard-fit': 'contain' } : {}),
    ...(p.mediaMaxHeight ? { '--he-icard-max': p.mediaMaxHeight } : {}),
    ...(p.iconSize ? { '--he-feat-size': p.iconSize } : {}),
    // 3.24 — the space between a card's parts, per tier.
    ...(p.partGap ? { '--he-fgrid-pg': p.partGap } : {}),
    ...(p.partGapTablet ? { '--he-fgrid-pg-t': p.partGapTablet } : {}),
    ...(p.partGapMobile ? { '--he-fgrid-pg-m': p.partGapMobile } : {}),
    // 3.26 — the space after the picture alone, per tier.
    ...(p.mediaGap ? { '--he-fgrid-mg': p.mediaGap } : {}),
    ...(p.mediaGapTablet ? { '--he-fgrid-mg-t': p.mediaGapTablet } : {}),
    ...(p.mediaGapMobile ? { '--he-fgrid-mg-m': p.mediaGapMobile } : {}),
  } as React.CSSProperties;
  // 3.24 — the card link's mark: the chevron as before, or the theme's "Read more" arrow (which Appearance → Buttons styles).
  const moreMark =
    p.moreArrow === 'theme' ? (
      <span className="he-more__icon" aria-hidden="true">
        →
      </span>
    ) : (
      '›'
    );

  /* The mosaic is the tile grid with two tile sizes, not a second component:
     same markup, same fields, same editor — the difference is which cells the
     tiles occupy, which is a stylesheet's job. */
  if (p.variant === 'tiles' || p.variant === 'mosaic') {
    const mosaic = p.variant === 'mosaic';
    return (
      <section className={cn('he-tiles', toneClass(p.tone))}>
        {head && <div className="shell he-tiles__head">{head}</div>}
        <div
          className={cn('he-tiles__grid he-swipe-track', mosaic ? 'is-mosaic' : p.columns > 2 && 'is-many', gaps.className)}
          style={cols}
        >
          {p.cards.map((c, i) => {
            const inner = (
              <>
                <MediaFill imageUrl={c.imageUrl} alt={c.alt} className="he-tile__bg" sizes="third" />
                {c.badge && <span className="he-badge">{c.badge}</span>}
                <div className="he-tile__text">
                  {c.eyebrow && <div className="he-tile__eyebrow">{c.eyebrow}</div>}
                  <h3 className="he-tile__title">{c.title}</h3>
                  {c.body && <p className="he-tile__body">{c.body}</p>}
                  {c.href && c.buttonLabel && <span className="he-tile__btn">{c.buttonLabel}</span>}
                </div>
              </>
            );
            return c.href ? (
              <Link key={c.title + i} href={c.href} className={cn('he-tile', itemClass(p.blockId, i, c.style))}>
                {inner}
              </Link>
            ) : (
              <div key={c.title + i} className={cn('he-tile', itemClass(p.blockId, i, c.style))}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // 2.22 (GG1) — one row per service: a large picture, a running number, the title, text and a link.
  if (p.variant === 'mediaRows') {
    const numbered = p.numbered !== false;
    return (
      <section className={cn('he-lsec', toneClass(p.tone))}>
        <div className="shell">
          {head}
          <ul
            className={cn('he-mrows he-swipe-track', head && 'has-head', `is-hover-${p.hover}`, p.mediaWidth && 'has-media-width', gapTiers(p).className)}
            style={
              p.gap || p.gapTablet || p.gapMobile || p.mediaWidth || p.mediaRatioMobile
                ? ({
                    ...gapTiers(p).style,
                    ...(p.mediaWidth ? { '--he-mrows-media': p.mediaWidth } : {}),
                    // 3.15 — the pictures' shape on phones.
                    ...(p.mediaRatioMobile ? { '--he-mrows-ratio-m': p.mediaRatioMobile.replace(/\s*\/\s*/, ' / ') } : {}),
                  } as React.CSSProperties)
                : undefined
            }
          >
            {p.cards.map((c, i) => (
              <li key={c.title + i} className={cn('he-mrows__item', !c.imageUrl && 'no-media', itemClass(p.blockId, i, c.style))}>
                {c.imageUrl && (
                  <div className="he-mrows__media">
                    <MediaFill imageUrl={c.imageUrl} mobileImageUrl={c.imageUrlMobile} alt={c.alt ?? ''} className="he-fill" sizes="half" />
                  </div>
                )}
                <div className="he-mrows__body">
                  {(numbered || c.eyebrow) && (
                    <p className="he-mrows__num">{[numbered ? `${p.numberStyle === 'slash' ? '/' : ''}${String(i + 1).padStart(2, '0')}` : null, c.eyebrow].filter(Boolean).join(' · ')}</p>
                  )}
                  <h3 className="he-mrows__title">{c.title}</h3>
                  {c.body && <p className="he-mrows__text">{c.body}</p>}
                  {c.href && (
                    <Link href={c.href} className="he-mrows__link he-more">
                      {c.buttonLabel || <MessageText k="block.readMore" />}
                      <span className="sr-only">: {c.title}</span>
                      <MoreIcon />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // V2 — one row per service: icon, text, a checklist and a button.
  if (p.variant === 'rows') {
    return (
      <section className={cn('he-lsec', toneClass(p.tone))}>
        <div className="shell">
          {head}
          <ul className={cn('he-rows he-swipe-track', head && 'has-head', p.shadow && 'has-shadow', `is-hover-${p.hover}`, gaps.className)} style={cols}>
            {p.cards.map((c, i) => (
              <li key={c.title + i} className={cn('he-rows__item', itemClass(p.blockId, i, c.style))}>
                {c.imageUrl && (
                  <div className="he-rows__icon">
                    <MediaFill imageUrl={c.imageUrl} alt="" className="he-feat__img" sizes="quarter" />
                  </div>
                )}
                <div className="he-rows__main">
                  {c.eyebrow && <div className="he-fgrid__eyebrow">{c.eyebrow}</div>}
                  <h3 className="he-rows__title">{c.title}</h3>
                  {c.body && <p className="he-rows__body">{c.body}</p>}
                </div>
                {c.points && c.points.length > 0 && (
                  <ul className="he-rows__points">
                    {c.points.map((point) => (
                      <li key={point}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
                {c.href && (
                  <Link href={c.href} className="he-cbtn is-outline is-small he-rows__btn">
                    {c.buttonLabel || <MessageText k="block.readMore" />}
                    <span className="sr-only">: {c.title}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const icons = p.variant === 'icons';
  const overlay = p.variant === 'overlay';
  const mods = cn(
    `is-hover-${p.hover}`,
    p.shadow && 'has-shadow',
    p.offset && !icons && `is-offset cols-${p.columns}`,
    icons && `is-icon-${p.iconStyle} is-pos-${p.iconPosition}`,
    icons && p.iconSize && 'has-icon-size',
    !icons && p.mediaRatio === 'auto' && 'is-media-auto',
    p.partGap && 'has-pg',
    p.partGapTablet && 'has-pg-t',
    p.partGapMobile && 'has-pg-m',
    p.mediaGap && 'has-mg',
    p.mediaGapTablet && 'has-mg-t',
    p.mediaGapMobile && 'has-mg-m',
    p.titleHover === 'none' && 'no-title-line',
  );
  return (
    <section className={cn('he-lsec', toneClass(p.tone))}>
      <div className="shell">
        {head}
        <ul className={cn('he-fgrid he-swipe-track', icons ? 'is-icons' : overlay ? 'is-overlay' : 'is-cards', head && 'has-head', mods, gaps.className)} style={cols}>
          {p.cards.map((c, i) => {
            // 3.6 — the words after the title, in their own colour.
            const after = c.titleAfter && (
              <span className="he-title-after" style={c.titleAfterColor ? { color: c.titleAfterColor } : undefined}>
                {` ${c.titleAfter}`}
              </span>
            );
            const title = c.href ? (
              <Link href={c.href} className="he-fgrid__link">
                {c.title}
                {after}
              </Link>
            ) : (
              <>
                {c.title}
                {after}
              </>
            );
            // V3 — the text sits on the picture, over a shade.
            if (overlay) {
              return (
                <li key={c.title + i} className={cn('he-fgrid__item he-ocard', itemClass(p.blockId, i, c.style))}>
                  <MediaFill imageUrl={c.imageUrl} alt={c.alt} className="he-fill he-ocard__bg" sizes="third" />
                  {c.badge && <span className="he-badge">{c.badge}</span>}
                  <div className="he-ocard__text">
                    {c.eyebrow && <div className="he-ocard__eyebrow">{c.eyebrow}</div>}
                    <h3 className="he-ocard__title">{title}</h3>
                    {c.body && <p className="he-ocard__body">{c.body}</p>}
                    {c.href && c.buttonLabel && (
                      <span className={cn('he-ocard__more', p.moreArrow === 'theme' && 'he-more')} aria-hidden="true">
                        {c.buttonLabel} {moreMark}
                      </span>
                    )}
                  </div>
                </li>
              );
            }
            return (
              <li key={c.title + i} className={cn('he-fgrid__item', itemClass(p.blockId, i, c.style))}>
                {c.badge && <span className="he-badge">{c.badge}</span>}
                <div className={icons ? 'he-feat__icon' : 'he-icard__media'}>
                  <MediaFill imageUrl={c.imageUrl} alt={icons ? '' : c.alt} className={icons ? 'he-feat__img' : 'he-fill'} sizes={icons ? 'thumb' : 'third'} />
                </div>
                {c.eyebrow && <div className="he-fgrid__eyebrow">{c.eyebrow}</div>}
                <h3 className="he-fgrid__title">{title}</h3>
                {c.body && <p className="he-fgrid__body">{c.body}</p>}
                {c.href && c.buttonLabel && (
                  <span className={cn('he-fgrid__more', p.moreArrow === 'theme' && 'he-more')} aria-hidden="true">
                    {c.buttonLabel} {moreMark}
                  </span>
                )}
                {/* 3.16 — a button of its own under the text (an outside address opens in a new tab). */}
                {c.button && (
                  <div className="he-fgrid__actions">
                    <Button
                      href={c.button.href}
                      variant={c.button.fill ? 'primary' : (c.button.variant ?? 'primary')}
                      withArrow={c.button.arrow === true || undefined}
                      style={c.button.fill && isColor(c.button.fill) ? buttonFill(c.button.fill) : undefined}
                    >
                      {c.button.label}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** 3.17 — a main button in a colour of its own: its fill, hover, edge and glow. */
function buttonFill(fill: string): React.CSSProperties {
  return {
    '--he-btn-primary-bg': fill,
    '--he-btn-primary-hover-bg': `color-mix(in srgb, ${fill} 85%, #fff)`,
    '--he-btn-primary-border': fill,
    '--he-btn-primary-hover-border': fill,
    '--he-btn-glow-c': `color-mix(in srgb, ${fill} 55%, transparent)`,
  } as React.CSSProperties;
}

/* ── CT8: figures row ─────────────────────────────────────────────────────── */

export function StatsFigures(p: P<'stats'>) {
  if (p.variant === 'counters') return <StatsCounters {...p} />;
  return (
    <section
      className={cn('he-lsec he-figs', toneClass(p.tone), p.glow && 'has-glow', p.dividers && 'has-dividers', p.dividers && p.dividersMobile === 'cross' && 'is-cross-sm')}
      style={figureSizes(p)}
    >
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.dividers ? 'left' : 'center'} />
        {p.imageUrl && (
          <div className="he-figs__media">
            <MediaFill imageUrl={p.imageUrl} alt={p.alt} className="he-fill" />
          </div>
        )}
        <div className="he-figs__grid he-swipe-track" style={{ '--n': Math.min(Math.max(p.items.length, 1), 4) } as React.CSSProperties}>
          {p.items.map((s, i) => (
            <div key={s.label + i} className="he-figs__item">
              <div className="he-figs__value">
                {s.value}
                {s.unit && <sup>{s.unit}</sup>}
              </div>
              <div className="he-figs__label">{s.label}</div>
            </div>
          ))}
        </div>
        {p.footnote && <p className="he-figs__foot">{p.footnote}</p>}
      </div>
    </section>
  );
}

/* ── V10: counters ────────────────────────────────────────────────────────── */

function StatsCounters(p: P<'stats'>) {
  return (
    <section className={cn('he-lsec he-counters', toneClass(p.tone), p.glow && 'has-glow', p.dividers && 'has-dividers', p.dividers && p.dividersMobile === 'cross' && 'is-cross-sm')}>
      <div className="shell">
        {(p.title || p.eyebrow || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.dividers ? 'left' : 'center'} />}
        <ul className={cn('he-counters__grid he-swipe-track', `is-icon-${p.iconPosition}`)} style={{ '--n': Math.min(Math.max(p.items.length, 1), 4) } as React.CSSProperties}>
          {p.items.map((s, i) => (
            <li key={s.label + i} className="he-counter">
              {s.iconUrl && (
                <span className="he-counter__icon">
                  <MediaFill imageUrl={s.iconUrl} alt="" className="he-feat__img" sizes="thumb" />
                </span>
              )}
              <div className="he-counter__text">
                <p className="he-counter__value">
                  <CountUp value={s.value} enabled={p.countUp} />
                  {s.unit && <span className="he-counter__unit">{s.unit}</span>}
                </p>
                <p className="he-counter__label">{s.label}</p>
              </div>
            </li>
          ))}
        </ul>
        {p.footnote && <p className="he-figs__foot">{p.footnote}</p>}
      </div>
    </section>
  );
}

/* ── CT9: logo wall ───────────────────────────────────────────────────────── */

export function LogoWall(p: P<'logoWall'>) {
  const cols = {
    '--cols': p.columns,
    '--cols-t': p.columnsTablet ?? Math.min(p.columns, 4),
    '--cols-m': p.columnsMobile ?? (p.columns >= 5 ? 3 : 2),
    // 3.22 — the logos' size, colour and rest opacity; each unset keeps the drawn value.
    ...(p.logoHeight ? { '--he-logo-h': p.logoHeight } : {}),
    ...(p.logoHeightTablet ? { '--he-logo-h-t': p.logoHeightTablet } : {}),
    ...(p.logoHeightMobile ? { '--he-logo-h-m': p.logoHeightMobile } : {}),
    ...(p.greyscale === false ? { '--he-logo-f': 'none' } : {}),
    ...(typeof p.opacity === 'number' ? { '--he-logo-o': p.opacity } : {}),
  } as React.CSSProperties;

  return (
    <section className={cn('he-lsec he-logos', toneClass(p.tone), `is-${p.align}`, p.logoHover && p.logoHover !== 'reveal' && `is-hover-${p.logoHover}`)}>
      <div className="shell">
        <div className={cn('he-logos__wrap', p.framed && 'is-framed', `is-style-${p.style}`, p.captions && 'has-captions')}>
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.align} />
          <ul className="he-logos__grid he-swipe-track" style={cols}>
            {p.logos.map((logo, i) => {
              const mark = logo.imageUrl ? (
                <>
                  <SiteImg src={logo.imageUrl} alt={p.captions ? '' : logo.name} className="he-logos__img" loading="lazy" sizes="thumb" />
                  {p.captions && <span className="he-logos__cap">{logo.name}</span>}
                </>
              ) : (
                <span className="he-logos__word">{logo.name}</span>
              );
              return (
                <li key={logo.name + i} className="he-logos__cell">
                  {logo.href ? <Link href={logo.href}>{mark}</Link> : mark}
                </li>
              );
            })}
          </ul>
          {p.link && (
            <div className="he-logos__foot">
              <Link href={p.link.href} className="he-textlink">
                {p.link.label} <span aria-hidden="true">›</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── CT10: quote / case study ─────────────────────────────────────────────── */

export function QuoteBlock(p: P<'quote'>) {
  const hasMedia = Boolean(p.imageUrl || p.videoUrl);
  return (
    <section className={cn('he-lsec he-quote', toneClass(p.tone), !hasMedia && 'is-solo')}>
      <div className="shell he-quote__grid">
        {hasMedia && <QuoteMedia imageUrl={p.imageUrl} videoUrl={p.videoUrl} alt={p.alt} label={p.mediaLabel} />}
        <figure className={cn('he-quote__fig', p.avatarPosition === 'above' && 'is-avatar-above')}>
          {p.avatarPosition === 'above' && p.avatarUrl && (
            <div className="he-quote__top">
              <SiteImg src={p.avatarUrl} alt="" className={cn('he-quote__avatar', `is-${p.avatarSize}`)} loading="lazy" sizes="thumb" />
            </div>
          )}
          {p.eyebrow && <Eyebrow className={!hasMedia ? 'justify-center' : undefined}>{p.eyebrow}</Eyebrow>}
          <blockquote className="he-quote__text">&ldquo;{p.quote}&rdquo;</blockquote>
          {(p.name || p.role) && (
            <figcaption className="he-quote__cap">
              {p.avatarPosition !== 'above' && p.avatarUrl && (
                <SiteImg src={p.avatarUrl} alt="" className={cn('he-quote__avatar', `is-${p.avatarSize}`)} loading="lazy" sizes="thumb" />
              )}
              <span>
                {p.name && <span className="he-quote__name">{p.name}</span>}
                {p.role && <span className="he-quote__role">{p.role}</span>}
              </span>
            </figcaption>
          )}
          <Actions links={p.links} />
        </figure>
      </div>
    </section>
  );
}

/* ── CT14: offset collage ─────────────────────────────────────────────────── */

export function Collage(p: P<'collage'>) {
  return (
    <section className={cn('he-lsec he-collage', toneClass(p.tone), p.textSide === 'right' && 'is-text-right')}>
      <div className="shell">
        <div className="he-collage__large">
          <MediaFill imageUrl={p.largeUrl} alt={p.largeAlt} className="he-fill" />
        </div>
        <div className="he-collage__row">
          <div className="he-collage__text">
            {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
            {p.title && <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>}
            {p.body && <p className="he-lbody">{p.body}</p>}
            {p.link && <Actions links={[p.link]} />}
          </div>
          <div className="he-collage__small">
            <MediaFill imageUrl={p.smallUrl} alt={p.smallAlt} className="he-fill" sizes="half" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CT16: app download ───────────────────────────────────────────────────── */

function StoreLink({ href, kicker, name }: { href: string; kicker: string; name: string }) {
  const external = /^https?:/i.test(href);
  return (
    <a href={href} className="he-store" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M12 7.5v7m-3-3 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <small>{kicker}</small>
        <strong>{name}</strong>
      </span>
    </a>
  );
}

export function AppPromo(p: P<'appPromo'>) {
  return (
    <section className={cn('he-lsec he-app', toneClass(p.tone))}>
      <div className="shell he-app__grid">
        <div className="he-app__text">
          {p.iconUrl && (
            <SiteImg src={p.iconUrl} alt="" className="he-app__icon" loading="lazy" sizes="thumb" />
          )}
          {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
          <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>
          {p.body && <p className="he-lbody">{p.body}</p>}
          {(p.appStoreHref || p.playStoreHref) && (
            <div className="he-app__stores">
              {p.appStoreHref && <StoreLink href={p.appStoreHref} kicker="Download on the" name="App Store" />}
              {p.playStoreHref && <StoreLink href={p.playStoreHref} kicker="Get it on" name="Google Play" />}
            </div>
          )}
        </div>
        {p.screens.length > 0 && (
          <div className={cn('he-app__phones', `is-${p.screens.length}`)}>
            {p.screens.map((s, i) => (
              <div key={s.imageUrl + i} className="he-phone">
                <SiteImg src={s.imageUrl} alt={s.alt ?? ''} loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
