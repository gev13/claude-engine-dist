import Link from '@/components/ui/SiteLink';
import { messageReader } from '@/lib/messages';
import { getPermalinks } from '@/server/routing/config';
import { blogIndexPath, withSlash } from '@/lib/permalinks';
import { Fragment } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import type { TextTag } from '@/lib/blockStyle';
import { areaPath, formatChartValue, linePath, linePoints, niceScale, percentOf, pieSlices } from '@/lib/chart';
import type { Crumb } from '@/lib/seo/jsonld';
import { getMessages } from '@/server/content/messages';
import { isColor } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { getSiteSettings } from '@/server/content/siteSettings';
import { BlockHead } from '../parts';
import { MediaFill } from './media';
import { SmartLink } from './SmartLink';
import { Stars } from './Stars';
import { ChartGrow, HoursPanel, PriceTabs } from './widgets-client';

/* ═══════════════════════════════════════════════════════════════════════════
   Package 3 widgets, server half
   P3-A1 chart · P3-A4 price list · P3-A5 opening hours (its live status is
   the client half) · P3-A7 reviews · P3-A9 breadcrumbs · P3-A10 text on a
   path · P3-A11 search. Hotspots, flip cards, share buttons and the table of
   contents are in widgets-client.tsx.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

function Head({ eyebrow, title, titleAs, intro }: { eyebrow?: string; title?: string; titleAs?: TextTag; intro?: string }) {
  if (!eyebrow && !title && !intro) return null;
  return <BlockHead eyebrow={eyebrow} title={title} titleAs={titleAs} intro={intro} className="mb-9" />;
}

/* ── P3-A1: chart ─────────────────────────────────────────────────────────── */

/** Eight colours per palette, repeated beyond that; the palettes live in CSS. */
const colour = (i: number) => ({ '--c': `var(--he-chart-${(i % 8) + 1})` }) as React.CSSProperties;

export function ChartBlock(p: P<'chart'>) {
  const round = p.kind === 'pie' || p.kind === 'doughnut';
  const series = round ? p.series.slice(0, 1) : p.series;
  const value = (row: P<'chart'>['rows'][number], s: number) => row.values[s] ?? 0;
  const fmt = (v: number) => formatChartValue(v, p.prefix, p.suffix);
  const scale = niceScale(Math.max(0, ...p.rows.flatMap((row) => series.map((_, s) => value(row, s)))));
  const marks = p.rows.length * series.length;
  // Values over every bar turn to noise past a dozen marks; the data table still has them.
  const showValues = p.values && marks <= 12;
  const gutter = `${Math.max(...scale.ticks.map((t) => fmt(t).length)) + 1}ch`;

  let visual: React.ReactNode;
  if (round) {
    const values = p.rows.map((row) => value(row, 0));
    const total = values.reduce((sum, v) => sum + v, 0);
    const slices = pieSlices(values);
    const doughnut = p.kind === 'doughnut';
    visual = (
      <div className={cn('he-chart__round', `is-${p.kind}`)}>
        <div className="he-chart__piewrap">
          <svg className="he-chart__pie" viewBox="0 0 42 42">
            {slices.map((slice, i) => {
              if (slice.share <= 0) return null;
              const dash = doughnut && slices.length > 1 ? Math.max(0.2, slice.share - 0.8) : slice.share;
              return (
                <circle
                  key={i}
                  className="he-chart__slice"
                  cx="21"
                  cy="21"
                  r={doughnut ? 15.9155 : 10.5}
                  fill="none"
                  pathLength={100}
                  strokeDasharray={`${dash} ${100 - dash}`}
                  strokeDashoffset={-slice.start}
                  transform="rotate(-90 21 21)"
                  style={colour(i)}
                />
              );
            })}
          </svg>
          {doughnut && (
            <div className="he-chart__center">
              <span className="he-chart__total">{fmt(total)}</span>
              <span className="he-chart__totlabel">{series[0]?.name}</span>
            </div>
          )}
        </div>
        {p.legend && (
          <ul className="he-chart__keys">
            {p.rows.map((row, i) => (
              <li key={row.label + i} style={colour(i)}>
                <span className="he-chart__swatch" />
                <span className="he-chart__keyname">{row.label}</span>
                {p.values && (
                  <span className="he-chart__keyval">
                    {/* Values already in per cent would only repeat themselves. */}
                    {p.suffix?.trim() === '%' ? fmt(value(row, 0)) : `${fmt(value(row, 0))} · ${Math.round(slices[i]?.share ?? 0)}%`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  } else if (p.kind === 'bar') {
    const n = p.rows.length;
    visual = (
      <div className={cn('he-chart__hplot', showValues && 'has-values')}>
        {p.grid && (
          <div className="he-chart__vticks" style={{ gridRow: `1 / span ${n}` }}>
            {scale.ticks.map((t) => (
              <span key={t} className="he-chart__vtick" style={{ left: `${percentOf(t, scale.max)}%` }} />
            ))}
          </div>
        )}
        {p.rows.map((row, r) => (
          <Fragment key={row.label + r}>
            <span className="he-chart__rlabel" style={{ gridRow: r + 1 }}>
              {row.label}
            </span>
            <div className="he-chart__hbars" style={{ gridRow: r + 1 }}>
              {series.map((s, i) => (
                <div key={s.name + i} className="he-chart__hbar" style={{ ...colour(i), '--v': `${percentOf(value(row, i), scale.max)}%` } as React.CSSProperties} title={`${row.label} · ${s.name}: ${fmt(value(row, i))}`}>
                  {showValues && <span className="he-chart__val">{fmt(value(row, i))}</span>}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
        {p.grid && (
          <div className="he-chart__vaxis" style={{ gridRow: n + 1 }}>
            {scale.ticks.map((t) => (
              <span key={t} style={{ left: `${percentOf(t, scale.max)}%` }}>
                {fmt(t)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  } else {
    const line = p.kind === 'line' || p.kind === 'area';
    const pointsOf = (s: number) => linePoints(p.rows.map((row) => value(row, s)), scale.max);
    visual = (
      <div className="he-chart__frame" style={p.grid ? ({ '--gutter': gutter } as React.CSSProperties) : undefined}>
        <div className="he-chart__plot">
          {p.grid && (
            <div className="he-chart__ticks">
              {scale.ticks.map((t) => (
                <span key={t} className="he-chart__tick" style={{ bottom: `${percentOf(t, scale.max)}%` }}>
                  <span className="he-chart__tickval">{fmt(t)}</span>
                </span>
              ))}
            </div>
          )}
          {line ? (
            <>
              <svg className="he-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {series.map((s, i) => {
                  const points = pointsOf(i);
                  return (
                    <g key={s.name + i} style={colour(i)}>
                      {p.kind === 'area' && <path className="he-chart__area" d={areaPath(points)} />}
                      <path className="he-chart__line" d={linePath(points)} fill="none" vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </svg>
              {series.map((s, i) =>
                pointsOf(i).map((point, k) => (
                  <span
                    key={`${i}-${k}`}
                    className="he-chart__dot"
                    style={{ ...colour(i), left: `${point.x}%`, top: `${point.y}%` }}
                    title={`${p.rows[k]?.label} · ${s.name}: ${fmt(value(p.rows[k]!, i))}`}
                  >
                    {showValues && <span className="he-chart__val">{fmt(value(p.rows[k]!, i))}</span>}
                  </span>
                )),
              )}
            </>
          ) : (
            <div className="he-chart__cols">
              {p.rows.map((row, r) => (
                <div key={row.label + r} className="he-chart__group">
                  {series.map((s, i) => (
                    <div key={s.name + i} className="he-chart__col" style={{ ...colour(i), '--v': `${percentOf(value(row, i), scale.max)}%` } as React.CSSProperties} title={`${row.label} · ${s.name}: ${fmt(value(row, i))}`}>
                      {showValues && <span className="he-chart__val">{fmt(value(row, i))}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn('he-chart__x', p.rows.length > 8 && 'is-dense')}>
          {p.rows.map((row, r) => (
            <span key={row.label + r}>{row.label}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className={cn('he-lsec he-chart', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <figure className={cn('he-chart__fig', `is-${p.kind}`, `is-${p.height}`, `is-${p.palette}`, marks > 6 && 'is-crowded')}>
          {p.legend && !round && series.length > 1 && (
            <ul className="he-chart__legend" aria-hidden="true">
              {series.map((s, i) => (
                <li key={s.name + i} style={colour(i)}>
                  <span className="he-chart__swatch" />
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          <ChartGrow animate={p.animate}>{visual}</ChartGrow>
          {/* The drawing is for the eye; the same numbers as a table are for everyone else. */}
          <table className="sr-only">
            <caption>{p.title || series.map((s) => s.name).join(', ')}</caption>
            <thead>
              <tr>
                <td />
                {series.map((s, i) => (
                  <th key={s.name + i} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.rows.map((row, r) => (
                <tr key={row.label + r}>
                  <th scope="row">{row.label}</th>
                  {series.map((s, i) => (
                    <td key={s.name + i}>{fmt(value(row, i))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {p.caption && <figcaption className="he-chart__caption">{p.caption}</figcaption>}
        </figure>
      </div>
    </section>
  );
}

/* ── P3-A4: price list ────────────────────────────────────────────────────── */

export function PriceListBlock(p: P<'priceList'>) {
  const tabs = p.groupNav === 'tabs' && p.groups.length > 1;
  const groups = p.groups.map((group, g) => (
    <div key={g} className="he-prl__group">
      {!tabs && group.title && <h3 className="he-prl__gtitle">{group.title}</h3>}
      {group.note && <p className="he-prl__gnote">{group.note}</p>}
      <ul className={cn('he-prl__items', `is-${p.layout}`)}>
        {group.items.map((item, i) => (
          <li key={item.name + i} className="he-prl__item">
            {item.imageUrl && (
              <div className="he-prl__photo">
                <MediaFill imageUrl={item.imageUrl} alt="" className="he-fill" sizes="third" />
              </div>
            )}
            <div className="he-prl__body">
              <div className="he-prl__line">
                <span className="he-prl__name">{item.name}</span>
                {item.badge && <span className="he-prl__badge">{item.badge}</span>}
                {p.leader !== 'none' && <span className={cn('he-prl__leader', `is-${p.leader}`)} aria-hidden="true" />}
                {item.price && <span className="he-prl__price">{item.price}</span>}
              </div>
              {item.description && <p className="he-prl__desc">{item.description}</p>}
              {item.tags.length > 0 && (
                <ul className="he-prl__tags">
                  {item.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  ));

  return (
    <section className={cn('he-lsec he-prl', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        {tabs ? (
          <PriceTabs labels={p.groups.map((group, g) => group.title || `Group ${g + 1}`)}>{groups}</PriceTabs>
        ) : (
          <div className="he-prl__groups">{groups}</div>
        )}
        {p.footnote && <p className="he-prl__foot">{p.footnote}</p>}
      </div>
    </section>
  );
}

/* ── P3-A5: opening hours ─────────────────────────────────────────────────── */

/**
 * The hours are printed on the server; which day is today and whether the
 * doors are open are worked out in the visitor's browser, in the block's (or
 * the site's) time zone, so an ISR-cached page never shows a stale status.
 */
export async function BusinessHoursBlock(p: P<'businessHours'>) {
  const zone = p.timeZone || (await getSiteSettings()).timeZone || 'UTC';
  const head = p.eyebrow || p.title || p.intro;

  return (
    <section className={cn('he-lsec', toneClass(p.tone))}>
      <div className={cn('shell he-hours', `is-${p.style}`)}>
        {head && (
          <div className="he-hours__head">
            <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
          </div>
        )}
        <HoursPanel {...p} zone={zone} />
      </div>
    </section>
  );
}

/* ── P3-A7: reviews ───────────────────────────────────────────────────────── */

export function ReviewsBlock(p: P<'reviews'>) {
  const head = (p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />;
  const summary = p.summary && (
    <div className="he-rev__summary">
      <span className="he-rev__score">{p.summary.rating.toFixed(1)}</span>
      <div>
        <Stars value={p.summary.rating} className="he-rev__sstars" />
        {(p.summary.count || p.summary.label) && <p className="he-rev__count">{[p.summary.count, p.summary.label].filter(Boolean).join(' ')}</p>}
        {p.summary.link && (
          <SmartLink href={p.summary.link.href} className="he-rev__slink">
            {p.summary.link.label} →
          </SmartLink>
        )}
      </div>
    </div>
  );
  /* 2.19 — the cards' own look, as custom properties. Each value has passed
     the schema's colour grammar or is a bounded integer; checked again here
     because it lands in a style attribute. */
  const card = p.card ?? {};
  const cardVars: Record<string, string> = {};
  if (card.background && isColor(card.background)) cardVars['--he-rev-bg'] = card.background;
  if (typeof card.radius === 'number' && card.radius >= 0 && card.radius <= 40) cardVars['--he-rev-radius'] = `${card.radius}px`;
  const circle = (color?: string) => (color && isColor(color) ? { background: color } : undefined);
  const list = (
    <ul
      className={cn('he-rev__list', `is-${p.layout}`, card.border === false && 'no-border', card.quoteMark && 'has-mark')}
      style={{ '--cols': p.columns, ...cardVars } as React.CSSProperties}
    >
      {p.items.map((r, i) => {
        const rating = p.hideRatings ? undefined : r.rating;
        const line = [[r.role, r.company].filter(Boolean).join(' · ') || r.meta, r.date].filter(Boolean).join(' · ');
        return (
          <li key={r.name + i} className="he-rev__item">
            <figure className="he-rev__card">
              {(rating !== undefined || r.source) && (
                <div className="he-rev__top">
                  {rating !== undefined && <Stars value={rating} />}
                  {r.source && <span className="he-rev__source">{r.source}</span>}
                </div>
              )}
              {r.title && <p className="he-rev__title">{r.title}</p>}
              <blockquote className="he-rev__text">
                <p>{r.text}</p>
              </blockquote>
              <figcaption className="he-rev__who">
                {r.avatarUrl ? (
                  <span className={cn('he-rev__avatar', r.avatarColor && 'is-logo')} style={circle(r.avatarColor)}>
                    <MediaFill imageUrl={r.avatarUrl} alt="" className="he-fill" sizes="thumb" />
                  </span>
                ) : (
                  <span className="he-rev__avatar is-initial" aria-hidden="true" style={circle(r.avatarColor)}>
                    {r.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span>
                  <span className="he-rev__name">{r.name}</span>
                  {line && <span className="he-rev__meta">{line}</span>}
                </span>
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className={cn('he-lsec he-rev', toneClass(p.tone))}>
      <div className="shell">
        {p.summaryPosition === 'side' && summary ? (
          <div className="he-rev__split">
            <div className="he-rev__aside">
              {head}
              {summary}
            </div>
            {list}
          </div>
        ) : (
          <>
            {(head || summary) && (
              <div className="he-rev__head">
                {head}
                {summary}
              </div>
            )}
            {list}
          </>
        )}
        {p.link && (
          <div className="he-rev__more">
            <SmartLink href={p.link.href} className="he-cbtn is-medium is-outline">
              {p.link.label}
            </SmartLink>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── P3-A9: breadcrumbs ───────────────────────────────────────────────────── */

/**
 * The renderer hands this block the page's own trail — the one the page's
 * BreadcrumbList structured data is built from — so what visitors see and
 * what search engines are told cannot drift apart. The block adds no
 * structured data of its own for the same reason.
 */
/* Async because it reads the engine's own words, which live in the database.
   The registry already accepts a component that returns a promise.

   `getMessages()` is called without a locale: a block is not told which one
   the page is in. On a site whose default language is the one being read —
   every single-language site — that is exact; elsewhere the label falls back
   to the default language rather than the reader's. Still better than the
   English that was compiled in, and the plumbing to do better is a locale
   threaded through `BlockRenderer`, which is its own change. */
export async function BreadcrumbsBlock(p: P<'breadcrumbs'> & { trail?: Crumb[] }) {
  const t = messageReader(await getMessages());
  const trail = p.trail ?? [];
  const current = p.current || trail[trail.length - 1]?.name;
  const steps: Crumb[] =
    p.source === 'custom'
      ? [...p.items.map((l) => ({ name: l.label, path: l.href })), ...(current ? [{ name: current, path: '' }] : [])]
      : trail.slice(1).map((c, i, all) => (i === all.length - 1 && p.current ? { ...c, name: p.current } : c));
  if (steps.length === 0) return null;
  const all = p.showHome ? [{ name: p.homeLabel || 'Home', path: '/' }, ...steps] : steps;

  return (
    <div className={cn('he-crumbs-sec', toneClass(p.tone), `is-${p.align}`)}>
      <div className="shell">
        <nav aria-label={t('block.breadcrumb')} className={cn('he-crumbs', `is-${p.style}`, `is-${p.separator}`)}>
          <ol>
            {all.map((c, i) => {
              const last = i === all.length - 1;
              return (
                <li key={c.path + i}>
                  {last || !c.path ? (
                    <span aria-current={last ? 'page' : undefined}>{c.name}</span>
                  ) : (
                    <SmartLink href={c.path}>
                      {i === 0 && p.showHome && <Icon.Home size={15} className="he-crumbs__home" />}
                      {c.name}
                    </SmartLink>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}

/* ── P3-A10: text on a path ───────────────────────────────────────────────── */

/** A stable id for the path from what shapes it, so the server and browser agree. */
const pathId = (seed: string) => `he-tp-${[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`;

const CIRCUMFERENCE = 2 * Math.PI * 80;

export function TextPathBlock(p: P<'textPath'>) {
  const id = pathId(p.shape + p.text);
  let text = p.text.trim();
  let path: string;
  let viewBox: string;
  let fontSize: number;
  let textProps: React.SVGProps<SVGTextPathElement>;

  if (p.shape === 'circle') {
    // A circle is filled all the way round: short text repeats, joined by a dot.
    const unit = /[·•*|—-]$/.test(text) ? `${text} ` : `${text} · `;
    text = unit;
    while (text.length < 34) text += unit;
    viewBox = '0 0 200 200';
    path = 'M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0';
    fontSize = Math.min(17, Math.max(8, (CIRCUMFERENCE * 0.97) / (text.length * 0.72)));
    textProps = { textLength: (CIRCUMFERENCE * 0.97).toFixed(1), lengthAdjust: 'spacing' };
  } else if (p.shape === 'arc') {
    viewBox = '0 0 400 190';
    path = 'M30,176 A170,150 0 0,1 370,176';
    fontSize = Math.min(30, 480 / (text.length * 0.72));
    textProps = { startOffset: '50%', textAnchor: 'middle' };
  } else {
    viewBox = '0 0 800 160';
    path = 'M0,80 C100,10 200,10 300,80 S500,150 600,80 S700,10 800,80';
    fontSize = Math.min(40, 860 / (text.length * 0.72));
    textProps = { startOffset: '50%', textAnchor: 'middle' };
  }

  const drawing = (
    <>
      <svg className="he-tp__svg" viewBox={viewBox} aria-hidden="true" focusable="false">
        <defs>
          <path id={id} d={path} fill="none" />
        </defs>
        <text className="he-tp__text" fontSize={fontSize.toFixed(1)}>
          <textPath href={`#${id}`} {...textProps}>
            {text}
          </textPath>
        </text>
      </svg>
      {p.shape === 'circle' && (p.centerImageUrl || p.centerText) && (
        <span className={cn('he-tp__center', p.centerImageUrl ? 'has-image' : 'is-text')} aria-hidden="true">
          {p.centerImageUrl ? <MediaFill imageUrl={p.centerImageUrl} alt="" className="he-fill" /> : p.centerText}
        </span>
      )}
    </>
  );
  const className = cn('he-tp', `is-${p.shape}`, `is-${p.size}`, `is-${p.color === 'accent' ? 'accent' : 'ink'}`, p.shape === 'circle' && p.spin !== 'none' && `is-spin-${p.spin}`);

  return (
    <div className={cn('he-lsec he-tp-sec', toneClass(p.tone), `is-${p.align}`)}>
      <div className="shell">
        {p.href ? (
          <SmartLink href={p.href} className={className} label={p.text}>
            {drawing}
          </SmartLink>
        ) : (
          <div className={className} role="img" aria-label={p.text}>
            {drawing}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── P3-A11: search ───────────────────────────────────────────────────────── */

/** A plain GET form to the blog — it works before any script has loaded. */
export async function SearchBlock(p: P<'search'>) {
  const [messages, permalinks] = await Promise.all([getMessages(), getPermalinks()]);
  const t = messageReader(messages);
  const action = withSlash(blogIndexPath(permalinks));
  const minimal = p.style === 'minimal';
  return (
    <section className={cn('he-lsec he-srch-sec', toneClass(p.tone), `is-${p.align}`)}>
      <div className="shell">
        {(p.title || p.intro) && <BlockHead title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.align} className="mb-7" />}
        <form role="search" action={action} method="get" className={cn('he-srch', `is-${p.style}`, `is-${p.size}`)}>
          <Icon.Search size={20} className="he-srch__icon" />
          <input
            type="search"
            name="q"
            required
            maxLength={120}
            className="he-srch__input"
            placeholder={p.placeholder || 'Search articles'}
            aria-label={t('block.searchTheBlog')}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="he-srch__btn" aria-label={minimal ? p.buttonLabel || 'Search' : undefined}>
            {minimal ? <Icon.ArrowRight size={18} /> : p.buttonLabel || 'Search'}
          </button>
        </form>
        {p.suggestions.length > 0 && (
          <div className="he-srch__tips">
            <span>{p.suggestionsLabel || 'Popular:'}</span>
            <ul>
              {p.suggestions.map((s) => (
                <li key={s}>
                  <Link href={`${action}?q=${encodeURIComponent(s)}`}>{s}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}


