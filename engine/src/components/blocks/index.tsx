import Link from 'next/link';
import type { z } from 'zod';
import { Accordion } from '@/components/ui/Accordion';
import { ArrowRight, Button } from '@/components/ui/Button';
import { Card, CardGrid, StatCard } from '@/components/ui/Card';
import { itemClass } from '@/lib/itemStyle';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Lede } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead, BlockTitle, Ordinal, Tick } from './parts';
import { ConvergeFigure } from './ConvergeFigure';
import { LayersFigure } from './LayersFigure';
import { LibraryHero } from './library/heroes';
import { CardGridVariant, StatsFigures } from './library/content';
import { MediaAccordion } from './library/MediaAccordion';

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

/* ── hero ─────────────────────────────────────────────────────────────────── */
export function HeroBlock(p: P<'hero'>) {
  // The library heroes (HR1–HR4, HR8); `classic` is the original below.
  if (p.variant !== 'classic') return <LibraryHero {...p} />;

  const hasFigure = p.figure === 'converge' || (p.figure === 'layers' && p.figureLabels.length > 0);
  const wide = !hasFigure;
  return (
    <Section size="lg">
      <div
        className={
          wide ? '' : 'grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16'
        }
      >
        <div className="animate-rise">
          {p.kicker && (
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-flare">{p.kicker}</div>
          )}
          {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
          <BlockTitle as={p.titleAs ?? 'h1'} className="mb-5 max-w-[15ch]">
            {p.title}
          </BlockTitle>
          {p.lede && <Lede className="mb-5 max-w-[34ch] text-bone">{p.lede}</Lede>}
          {p.body && <p className="mb-8 max-w-[58ch] text-[17px] text-ash">{p.body}</p>}
          {p.links.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {p.links.map((l, i) => (
                <Button key={l.href + i} href={l.href} variant={l.variant ?? (i === 0 ? 'primary' : 'outline')} withArrow={i === 0}>
                  {l.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {hasFigure && (
          <div className="hidden lg:block">
            {p.figure === 'converge' ? (
              <ConvergeFigure labels={p.figureLabels} />
            ) : (
              <LayersFigure labels={p.figureLabels} />
            )}
          </div>
        )}
      </div>
    </Section>
  );
}


/* ── stats ────────────────────────────────────────────────────────────────── */
export function StatsBlock(p: P<'stats'>) {
  if (p.variant !== 'tiles') return <StatsFigures {...p} />;

  return (
    <Section tone={p.tone ?? 'base'} size="md">
      {p.title || p.intro ? (
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-8" />
      ) : (
        p.eyebrow && <div className="mb-8 font-mono text-[11px] uppercase tracking-[0.14em] text-smoke">{p.eyebrow}</div>
      )}
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-4">
        {p.items.map((s) => (
          <StatCard key={s.label} value={s.unit ? `${s.value}${s.unit}` : s.value} label={s.label} />
        ))}
      </div>
      {p.footnote && (
        <div className="mt-[18px] font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{p.footnote}</div>
      )}
    </Section>
  );
}

/* ── prose ────────────────────────────────────────────────────────────────── */
export function ProseBlock(p: P<'prose'>) {
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <div
        className={cn(
          p.columns === 'two' && 'grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16',
          p.variant === 'footnotes' && 'he-footnotes',
        )}
      >
        <div>
          {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
          {p.title && (
            <BlockTitle as={p.titleAs} className="mb-4 max-w-[24ch]">
              {p.title}
            </BlockTitle>
          )}
          {p.columns === 'one' && p.html && <Prose html={p.html} className="mt-5" />}
          {p.columns === 'one' &&
            !p.html &&
            p.paragraphs.map((text, i) => (
              /* `whitespace-pre-line`: a line break typed in the editor is a
                 line break on the page. Without it HTML collapses it and the
                 text silently runs together — reported from real use. Runs of
                 spaces are still collapsed, so it does not turn prose into
                 preformatted text. */
              <p key={i} className="mt-4 max-w-[62ch] whitespace-pre-line text-[17px] text-ash first:mt-5">
                {text}
              </p>
            ))}
        </div>
        {p.columns === 'two' && (
          <div>
            {p.html ? (
              <Prose html={p.html} />
            ) : (
              p.paragraphs.map((text, i) => (
                <p key={i} className="mt-4 max-w-[62ch] whitespace-pre-line text-[17px] text-ash first:mt-0">
                  {text}
                </p>
              ))
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── splitPoints ──────────────────────────────────────────────────────────── */
export function SplitPointsBlock(p: P<'splitPoints'>) {
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        </div>
        <div className="flex flex-col">
          {p.points.map((pt, i) => (
            <div key={pt.title} className={i === 0 ? 'border-t-2 border-hairline pt-6' : 'mt-6 border-t-2 border-hairline pt-6'}>
              <h3 className="m-0 font-display text-[19px] font-extrabold leading-[1.2] tracking-[-0.02em] text-bone">
                {pt.title}
              </h3>
              <p className="mt-2.5 max-w-[54ch] text-[16px] text-ash">{pt.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ── cardGrid ─────────────────────────────────────────────────────────────── */
export function CardGridBlock(p: P<'cardGrid'> & { blockId?: string }) {
  // Image tiles (CT4), icon features and image cards (CT5); `cards` is below.
  if (p.variant !== 'cards') return <CardGridVariant {...p} />;

  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      <CardGrid cols={p.columns}>
        {p.cards.map((c, i) => (
          <Card
            key={c.title}
            eyebrow={c.eyebrow}
            title={c.title}
            href={c.href}
            badge={c.badge}
            className={itemClass(p.blockId, i, c.style)}
          >
            {c.body}
          </Card>
        ))}
      </CardGrid>
    </Section>
  );
}

/* ── numberedList ─────────────────────────────────────────────────────────── */
export function NumberedListBlock(p: P<'numberedList'>) {
  if (p.variant !== 'grid') {
    // EL16: numbered steps joined by a line, or a timeline under each item's label.
    return (
      <Section tone={p.tone ?? 'base'} size="lg">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
        <ol className={`he-steps is-${p.variant}`} style={{ '--cols': Math.min(Math.max(p.items.length, 1), 5) } as React.CSSProperties}>
          {p.items.map((item, i) => (
            <li key={`${item.title}-${i}`} className="he-steps__item">
              <span className="he-steps__dot" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="he-steps__text">
                {item.label && <p className="he-steps__label">{item.label}</p>}
                <h3 className="he-steps__title">{item.title}</h3>
                <p className="he-steps__body">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    );
  }
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      <ol className="m-0 grid list-none grid-cols-1 gap-0.5 p-0 md:grid-cols-2">
        {p.items.map((item, i) => (
          <li key={item.title} className="bg-surface px-6 py-7">
            <Ordinal n={i + 1} />
            <h3 className="mt-3 font-display text-[19px] font-extrabold leading-[1.2] tracking-[-0.02em] text-bone">
              {item.title}
            </h3>
            <p className="mt-2.5 text-[15px] text-ash">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ── checkLists ───────────────────────────────────────────────────────────── */
/* P3-B3 — the markers an icon list can use. */
const LIST_MARKS: Record<string, React.ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" fill="currentColor" stroke="none" />,
};

function ListMarker({ icon, iconUrl, n }: { icon: P<'checkLists'>['icon']; iconUrl?: string; n: number }) {
  if (icon === 'none') return null;
  if (icon === 'check' || (icon === 'custom' && !iconUrl)) return <Tick />;
  if (icon === 'number') return <span className="he-ilist__num">{String(n).padStart(2, '0')}</span>;
  if (icon === 'dot') return <span className="he-ilist__dot" aria-hidden="true" />;
  if (icon === 'custom') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={iconUrl} alt="" className="he-ilist__img" />;
  }
  return (
    <svg className="he-ilist__mark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {LIST_MARKS[icon]}
    </svg>
  );
}

export function CheckListsBlock(p: P<'checkLists'>) {
  const rows = p.layout === 'rows';
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      <div className={p.lists.length > 1 ? 'grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16' : ''}>
        {p.lists.map((list, li) => (
          <div key={li}>
            {list.title && (
              <h3 className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-smoke">{list.title}</h3>
            )}
            <ul className={cn('m-0 list-none p-0', `he-ilist is-${p.layout}`)}>
              {list.items.map((raw, i) => {
                const item: { text: string; href?: string; note?: string } = typeof raw === 'string' ? { text: raw } : raw;
                return (
                  <li
                    key={i}
                    className={cn('he-ilist__item', rows && 'flex gap-3.5 border-t-2 border-hairline py-3.5 text-[16px] text-ash last:border-b-2')}
                  >
                    <ListMarker icon={p.icon} iconUrl={p.iconUrl} n={i + 1} />
                    <span className="he-ilist__text">
                      {item.href ? (
                        <Link href={item.href} className="he-ilist__link">
                          {item.text}
                        </Link>
                      ) : (
                        item.text
                      )}
                      {item.note && <span className="he-ilist__note">{item.note}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── faq ──────────────────────────────────────────────────────────────────── */
export function FaqBlock(p: P<'faq'>) {
  if (p.variant === 'media') {
    return (
      <Section tone={p.tone ?? 'base'} size="lg" id="faq">
        <MediaAccordion items={p.items} eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} />
      </Section>
    );
  }

  return (
    <Section tone={p.tone ?? 'base'} size="lg" id="faq">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} />
        <Accordion items={p.items} look={p.style} icon={p.icon} />
      </div>
    </Section>
  );
}

/* ── cta ──────────────────────────────────────────────────────────────────── */
const CTA_TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

export function CtaBlock(p: P<'cta'>) {
  const buttons = p.links.length > 0 && (
    <div className="he-actions">
      {p.links.map((l, i) => (
        <Button key={l.href + i} href={l.href} variant={l.variant ?? (i === 0 ? 'primary' : 'outline')}>
          {l.label}
        </Button>
      ))}
    </div>
  );

  // CF1 — a huge centred headline with one or two buttons.
  if (p.variant === 'big') {
    return (
      <section className={cn('he-lsec he-cta-big', CTA_TONES[p.tone ?? 'base'])}>
        <div className="shell">
          {p.eyebrow && <Eyebrow className="justify-center">{p.eyebrow}</Eyebrow>}
          <BlockTitle as={p.titleAs} className="he-cta-big__title">
            {p.title}
          </BlockTitle>
          {p.body && <p className="he-lbody">{p.body}</p>}
          {buttons}
        </div>
      </section>
    );
  }

  // V7 — a framed strip: text on the left, buttons on the right.
  if (p.variant === 'inline') {
    return (
      <section className={cn('he-lsec he-cta-inline-sec', CTA_TONES[p.tone ?? 'base'])}>
        <div className="shell">
          <div className="he-cta-inline">
            <div className="he-cta-inline__text">
              {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
              <BlockTitle as={p.titleAs} className="he-cta-inline__title">
                {p.title}
              </BlockTitle>
              {p.body && <p className="he-cta-inline__body">{p.body}</p>}
            </div>
            {buttons}
          </div>
        </div>
      </section>
    );
  }

  // CF1 — a compact card aligned to one side, not a full-width band.
  if (p.variant === 'card') {
    return (
      <section className={cn('he-lsec', CTA_TONES[p.tone ?? 'base'])}>
        <div className="shell">
          <div className="he-cta-card">
            {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
            <BlockTitle as={p.titleAs} className="he-cta-card__title">
              {p.title}
            </BlockTitle>
            {p.body && <p className="he-lbody">{p.body}</p>}
            {buttons}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-flare text-ink">
      <div className="shell py-14 md:py-20">
        {p.eyebrow && (
          <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/70">{p.eyebrow}</div>
        )}
        <BlockTitle as={p.titleAs} className="max-w-[22ch] text-ink">
          {p.title}
        </BlockTitle>
        {p.body && <p className="mt-5 max-w-[58ch] text-[17px] text-ink/85">{p.body}</p>}
        {p.links.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {p.links.map((l, i) => (
              <Button key={l.href + i} href={l.href} variant="onFlare" withArrow={i === 0}>
                {l.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── pager ────────────────────────────────────────────────────────────────── */
export function PagerBlock(p: P<'pager'>) {
  return (
    <Section size="sm">
      <Link href={p.href} className="group flex flex-wrap items-center justify-between gap-4">
        <span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{p.label}</span>
          <span className="mt-2 block font-display text-[clamp(20px,3vw,27px)] font-extrabold tracking-[-0.03em] text-bone transition-colors group-hover:text-flare-soft">
            {p.title}
          </span>
        </span>
        <ArrowRight className="h-6 w-6 text-flare transition-transform duration-200 group-hover:translate-x-2" />
      </Link>
    </Section>
  );
}


/* ── image ────────────────────────────────────────────────────────────────── */
export function ImageBlock(p: P<'image'>) {
  const masked = p.mask !== 'none';
  const narrow = p.size !== 'full';
  return (
    <Section size="md">
      <figure className={cn(narrow && `he-img-size is-${p.size}`, narrow && p.align === 'center' ? 'mx-auto my-0' : 'm-0')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.url}
          alt={p.alt}
          width={p.width}
          height={p.height}
          className={cn(
            'block h-auto w-full',
            !masked && (p.rounded || p.captionStyle === 'lead') && 'he-rounded',
            masked && `he-img-mask is-${p.mask}`,
          )}
          loading="lazy"
        />
        {p.captionStyle === 'lead'
          ? (p.captionLead || p.caption) && (
              <figcaption className="he-imgcap">
                {p.captionLead && <strong>{p.captionLead}</strong>} {p.caption}
              </figcaption>
            )
          : p.caption && (
              <figcaption className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
                {p.caption}
              </figcaption>
            )}
      </figure>
    </Section>
  );
}

/* ── table ────────────────────────────────────────────────────────────────── */
export function TableBlock(p: P<'table'>) {
  return (
    <Section tone={p.tone ?? 'base'} size="md">
      {p.title && (
        <BlockTitle as={p.titleAs} className="mb-7">
          {p.title}
        </BlockTitle>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[15px]">
          <thead>
            <tr>
              {p.head.map((h) => (
                <th
                  key={h}
                  className="border border-hairline bg-surface px-3.5 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-bone"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border border-hairline px-3.5 py-2.5 text-ash">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ── infoPanel ────────────────────────────────────────────────────────────── */
export function InfoPanelBlock(p: P<'infoPanel'>) {
  return (
    <Section tone={p.tone ?? 'raised'} size="md">
      {p.title && (
        <BlockTitle as={p.titleAs ?? 'h3'} className="mb-6">
          {p.title}
        </BlockTitle>
      )}
      <dl className="m-0 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {p.items.map((item) => (
          <div key={item.label} className="bg-ink px-6 py-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{item.label}</dt>
            <dd className="m-0 mt-2 text-[16px] text-bone">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/**
 * Vertical space, optionally with a rule across it.
 *
 * The heights travel as custom properties rather than as a `height` in the
 * style attribute, because an inline style cannot carry a media query and the
 * mobile height has to be a real breakpoint rather than a guess.
 */
/* P3-B4 — what can sit in the middle of a divider. */
const ORNAMENTS: Record<string, React.ReactNode> = {
  dot: <span className="he-div__dot" />,
  diamond: <span className="he-div__diamond" />,
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
    </svg>
  ),
  asterisk: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
    </svg>
  ),
};

export function SpacerBlock(p: P<'spacer'>) {
  const hasLine = p.line !== 'none';
  const middle = Boolean(p.label) || p.ornament !== 'none';
  // The original solid, full-width rule renders exactly as it always has.
  const original = p.lineStyle === 'solid' && p.lineWidth === 'full' && !middle;
  return (
    <div
      aria-hidden={!hasLine && !p.label ? 'true' : undefined}
      className="he-spacer"
      style={
        {
          '--he-spacer-h': p.height,
          ...(p.heightMobile ? { '--he-spacer-hm': p.heightMobile } : {}),
        } as React.CSSProperties
      }
    >
      {original
        ? hasLine && (
            <div className="shell">
              <hr className={cn('m-0 border-0 border-t-2', LINE_TONE[p.line as keyof typeof LINE_TONE])} />
            </div>
          )
        : (hasLine || middle) && (
            <div className="shell">
              <div
                className={cn('he-div', `is-${p.lineStyle}`, `is-w-${p.lineWidth}`, `is-${p.align}`, `is-c-${p.line}`, middle && 'has-middle')}
                role={p.label ? 'separator' : undefined}
                aria-label={p.label || undefined}
              >
                {hasLine && <span className="he-div__line" />}
                {middle && (
                  <span className="he-div__mid" aria-hidden="true">
                    {p.ornament !== 'none' && <span className="he-div__orn">{ORNAMENTS[p.ornament]}</span>}
                    {p.label && <span>{p.label}</span>}
                  </span>
                )}
                {hasLine && middle && <span className="he-div__line" />}
              </div>
            </div>
          )}
    </div>
  );
}

const LINE_TONE = {
  hairline: 'border-hairline',
  rule: 'border-rule',
  accent: 'border-flare',
} as const;

/**
 * A diagram as its own block.
 *
 * Rendered inside a Section so it behaves at the top level of a page; inside a
 * column the `.he-nested` rules strip that chrome, so it fills the column.
 */
export function FigureBlock(p: P<'figure'>) {
  if (p.kind === 'layers' && p.labels.length === 0) return null;
  return (
    <Section size="md" rule={false}>
      {p.kind === 'converge' ? <ConvergeFigure labels={p.labels} /> : <LayersFigure labels={p.labels} />}
    </Section>
  );
}
