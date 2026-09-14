'use client';

import { usePathname } from 'next/navigation';
import { Children, type CSSProperties, useEffect, useId, useRef, useState } from 'react';
import type { z } from 'zod';
import { Icon, ShareIcon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { type Moment, WEEKDAYS, WEEKDAY_LABELS, type Weekday, formatClock, formatTime, groupDays, openStatus, zonedMoment } from '@/lib/hours';
import { motionReduced } from '@/lib/motion';
import { SHARE_BRAND, SHARE_LABELS, type ShareNetwork, shareHref } from '@/lib/share';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { arrowKeys } from './keys';
import { MediaFill } from './media';
import { SmartLink } from './SmartLink';

/* ═══════════════════════════════════════════════════════════════════════════
   Package 3 widgets, client half
   P3-A1 chart drawing-in · P3-A2 hotspots · P3-A3 flip cards · P3-A4 price
   tabs · P3-A5 live opening status · P3-A6 share buttons
   Each renders a complete resting state on the server; nothing is hidden
   waiting for a script, and nothing moves under reduced motion.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

/* ── P3-A1: chart drawing in ──────────────────────────────────────────────── */

/**
 * Draws the chart in when it scrolls into view. Only a chart that starts
 * below the fold, in a browser that allows motion, is ever held back — so a
 * thumbnail, a crawler or a visitor who asked for less motion sees it drawn.
 */
export function ChartGrow({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!animate || !el || motionReduced() || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setPending(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPending(false);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <div ref={ref} className={cn('he-chart__visual', pending && 'is-pending')} aria-hidden="true">
      {children}
    </div>
  );
}

/* ── P3-A2: hotspots ──────────────────────────────────────────────────────── */

export function HotspotsBlock(p: P<'hotspots'>) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const spots = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const hover = p.trigger === 'hover';

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      spots.current[open]?.focus();
      setOpen(null);
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const point = open === null ? undefined : p.points[open];
  const name = (i: number) => (p.marker === 'number' ? `${i + 1}. ${p.points[i]?.title}` : p.points[i]?.title);

  /* The card is drawn twice: floating by its pin on wide screens, and under
     the picture on phones, where a floating card would cover what it names.
     CSS shows one or the other. */
  const card = (where: 'float' | 'below') =>
    point && (
      <div
        id={`${id}-${where}`}
        className={cn('he-hs__card', `is-${where}`, point.x > 58 && 'is-flip-x')}
        style={{ '--x': `${point.x}%`, '--y': `${point.y}%` } as CSSProperties}
      >
        <button type="button" className="he-hs__close" aria-label="Close" onClick={() => setOpen(null)}>
          <Icon.Close size={14} />
        </button>
        {point.imageUrl && (
          <div className="he-hs__cardimg">
            <MediaFill imageUrl={point.imageUrl} alt="" className="he-fill" />
          </div>
        )}
        <p className="he-hs__title">
          {p.marker === 'number' && <span className="he-hs__num">{(open ?? 0) + 1}</span>}
          {point.title}
        </p>
        {point.body && <p className="he-hs__body">{point.body}</p>}
        {point.link && (
          <SmartLink href={point.link.href} className="he-hs__link">
            {point.link.label} →
          </SmartLink>
        )}
      </div>
    );

  return (
    <section ref={root} className={cn('he-lsec he-hs', toneClass(p.tone))}>
      <div className="shell">
        {(p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />}
        <div className={cn('he-hs__wrap', p.list && 'has-list')}>
          <figure className={cn('he-hs__fig', `is-w-${p.width}`)}>
            <div className="he-hs__stage" onMouseLeave={hover ? () => setOpen(null) : undefined}>
              {p.imageUrl ? (
                // The pins are placed in percentages of the picture, so it keeps its own shape.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.alt ?? ''} className="he-hs__img" loading="lazy" decoding="async" />
              ) : (
                <div className="he-hs__img is-empty" />
              )}
              {p.points.map((pt, i) => (
                <button
                  key={i}
                  ref={(el) => {
                    spots.current[i] = el;
                  }}
                  type="button"
                  className={cn('he-hs__spot', `is-${p.marker}`, p.pulse && 'is-pulse', open === i && 'is-open')}
                  style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                  aria-label={name(i)}
                  aria-expanded={open === i}
                  aria-controls={open === i ? `${id}-float ${id}-below` : undefined}
                  onClick={() => setOpen(open === i && !hover ? null : i)}
                  onMouseEnter={hover ? () => setOpen(i) : undefined}
                  onFocus={hover ? () => setOpen(i) : undefined}
                >
                  {p.marker === 'number' ? i + 1 : p.marker === 'plus' ? <Icon.Plus size={14} /> : <span className="he-hs__core" />}
                </button>
              ))}
              {card('float')}
            </div>
            {card('below')}
            {p.caption && <figcaption className="he-hs__caption">{p.caption}</figcaption>}
          </figure>
          {p.list && (
            <ol className="he-hs__list">
              {p.points.map((pt, i) => (
                <li key={i}>
                  <button type="button" className={cn('he-hs__litem', open === i && 'is-active')} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span className="he-hs__lmark" aria-hidden="true">
                      {p.marker === 'number' ? i + 1 : ''}
                    </span>
                    <span>
                      {pt.title}
                      {pt.body && <span className="he-hs__ltext">{pt.body}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── P3-A3: flip cards ────────────────────────────────────────────────────── */

export function FlipBoxBlock(p: P<'flipBox'>) {
  const [turned, setTurned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className={cn('he-lsec he-flip-sec', toneClass(p.tone))}>
      <div className="shell">
        {(p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />}
        <ul className={cn('he-flip', `is-${p.effect}`, `is-${p.direction}`, `is-${p.height}`, `is-${p.align}`, `is-cols-${p.columns}`)} style={{ '--cols': p.columns } as CSSProperties}>
          {p.cards.map((c, i) => {
            const shown = turned === i || hovered === i;
            return (
              <li
                key={c.title + i}
                className={cn('he-flip__card', shown && 'is-shown')}
                // A mouse turns the card on hover; touch and keyboard use the buttons.
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(null)}
              >
                <div className="he-flip__inner">
                  <div className={cn('he-flip__face is-front', c.imageUrl && 'has-image')} inert={shown}>
                    {c.imageUrl && <MediaFill imageUrl={c.imageUrl} alt="" className="he-fill" />}
                    <div className="he-flip__content">
                      {c.iconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.iconUrl} alt="" className="he-flip__icon" />
                      )}
                      <h3 className="he-flip__title">{c.title}</h3>
                      {c.text && <p className="he-flip__text">{c.text}</p>}
                    </div>
                    <span className="he-flip__hint" aria-hidden="true">
                      <Icon.Plus size={16} />
                    </span>
                    <button type="button" className="he-flip__cover" aria-expanded={shown} aria-label={`Turn over: ${c.title}`} onClick={() => setTurned(i)} />
                  </div>
                  <div className="he-flip__face is-back" inert={!shown}>
                    <div className="he-flip__content">
                      <p className="he-flip__title">{c.backTitle || c.title}</p>
                      {c.backText && <p className="he-flip__text">{c.backText}</p>}
                      {c.link && (
                        <SmartLink href={c.link.href} className="he-cbtn is-small is-outline he-flip__btn">
                          {c.link.label}
                        </SmartLink>
                      )}
                    </div>
                    <button
                      type="button"
                      className="he-flip__back"
                      aria-label={`Turn back: ${c.title}`}
                      onClick={() => {
                        setTurned(null);
                        setHovered(null);
                      }}
                    >
                      <Icon.Close size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ── P3-A4: price list tabs ───────────────────────────────────────────────── */

export function PriceTabs({ labels, children }: { labels: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const panels = Children.toArray(children);

  return (
    <>
      <div className="he-prl__tabs" role="tablist" aria-label="Groups" onKeyDown={arrowKeys(labels.length, active, setActive)}>
        {labels.map((label, i) => (
          <button
            key={label + i}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            className={cn('he-prl__tab', i === active && 'is-active')}
            onClick={() => setActive(i)}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={i} id={`${id}-panel-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} hidden={i !== active}>
          {panel}
        </div>
      ))}
    </>
  );
}

/* ── P3-A5: opening hours ─────────────────────────────────────────────────── */

export function HoursPanel(p: P<'businessHours'> & { zone: string }) {
  // Unknown on the server and in the first client render, so both agree.
  const [now, setNow] = useState<Moment | null>(null);

  useEffect(() => {
    const tick = () => setNow(zonedMoment(new Date(), p.zone));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [p.zone]);

  const closed = p.closedLabel || 'Closed';
  const compact = p.style === 'compact';
  const rows = groupDays(p.week, p.firstDay, p.merge);
  const today: Weekday | null = now ? WEEKDAYS[now.day]! : null;
  const status = now && p.status ? openStatus(p.week, now) : null;

  const when = (m: Moment) => {
    if (!now) return '';
    if (m.minute === 0 && m.day === (now.day + 1) % 7) return 'at midnight';
    const at = `at ${formatClock(m.minute, p.clock)}`;
    if (m.day === now.day) return at;
    if (m.day === (now.day + 1) % 7) return `tomorrow ${at}`;
    return `${WEEKDAY_LABELS[WEEKDAYS[m.day]!].long} ${at}`;
  };
  const statusText = !status
    ? ' '
    : status.open
      ? status.always
        ? 'Open 24 hours'
        : `Open now · closes ${when(status.closes!)}`
      : status.opens
        ? `Closed now · opens ${when(status.opens)}`
        : 'Closed';

  const dayName = (days: Weekday[]) => {
    const label = (d: Weekday) => (compact || days.length > 1 ? WEEKDAY_LABELS[d].short : WEEKDAY_LABELS[d].long);
    return days.length === 1 ? label(days[0]!) : `${label(days[0]!)} – ${label(days[days.length - 1]!)}`;
  };

  return (
    <div className="he-hours__panel">
      {p.status && (
        <p className={cn('he-hours__status', !status ? 'is-pending' : status.open ? 'is-open' : 'is-closed')} aria-live="polite">
          {statusText}
        </p>
      )}
      {/* Compact hours read down each column, so the week stays in order. */}
      <dl className="he-hours__list" style={compact ? ({ '--rows': Math.ceil(rows.length / 2) } as CSSProperties) : undefined}>
        {rows.map((row) => (
          <div key={row.days.join()} className={cn('he-hours__row', p.today && today && row.days.includes(today) && 'is-today', row.slots.length === 0 && 'is-closed')}>
            <dt>
              {dayName(row.days)}
              {p.today && today && row.days.includes(today) && <span className="he-hours__todaytag">Today</span>}
            </dt>
            <dd>{row.slots.length === 0 ? closed : row.slots.map((s) => `${formatTime(s.open, p.clock)} – ${formatTime(s.close, p.clock)}`).join(', ')}</dd>
          </div>
        ))}
      </dl>
      {p.notes.length > 0 && (
        <dl className="he-hours__notes">
          {p.notes.map((note) => (
            <div key={note.label}>
              <dt>{note.label}</dt>
              <dd>{note.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.link && (
        <SmartLink href={p.link.href} className="he-cbtn is-medium is-outline he-hours__link">
          {p.link.label}
        </SmartLink>
      )}
    </div>
  );
}

/* ── P3-A8: table of contents ─────────────────────────────────────────────── */

type TocItem = { id: string; text: string; level: 2 | 3 };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

/**
 * Reads the headings once the page is running and gives any heading without
 * an id one made from its words, so every entry is a real link. The list is
 * empty in the server's HTML; a page with no headings loses the block.
 */
export function TocBlock(p: P<'toc'>) {
  const ref = useRef<HTMLElement>(null);
  const [items, setItems] = useState<TocItem[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const title = p.title || 'On this page';

  useEffect(() => {
    const self = ref.current;
    const main = document.querySelector('main');
    const scope = p.scope === 'row' ? (self?.closest('.he-row') ?? main) : main;
    if (!self || !scope) return;

    const found: TocItem[] = [];
    scope.querySelectorAll<HTMLHeadingElement>(p.levels === 'h2' ? 'h2' : 'h2, h3').forEach((h) => {
      const text = h.textContent?.trim();
      if (!text || h.closest('.he-toc-sec') || h.getClientRects().length === 0) return;
      if (!h.id) {
        const base = slugify(text);
        let candidate = base;
        for (let n = 2; document.getElementById(candidate); n++) candidate = `${base}-${n}`;
        h.id = candidate;
      }
      found.push({ id: h.id, text, level: h.tagName === 'H3' ? 3 : 2 });
    });
    setItems(found);
    if (p.collapsible && window.matchMedia('(width <= 48rem)').matches) setOpen(false);
    if (!p.highlight || found.length === 0) return;

    // The heading nearest the top of the screen is the section being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: '0px 0px -65% 0px' },
    );
    found.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [p.scope, p.levels, p.highlight, p.collapsible]);

  if (items && items.length === 0) return null;

  const list = (
    <ol className={cn('he-toc__list', `is-${p.style}`)}>
      {(items ?? []).map((item) => (
        <li key={item.id} className={item.level === 3 ? 'is-sub' : undefined}>
          <a href={`#${item.id}`} className={active === item.id ? 'is-active' : undefined} aria-current={active === item.id ? 'location' : undefined}>
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <section ref={ref} className={cn('he-lsec he-toc-sec', toneClass(p.tone), p.sticky && 'is-sticky')}>
      <div className="shell">
        <nav className={cn('he-toc', `is-${p.style}`)} aria-label={title}>
          {p.collapsible ? (
            <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
              <summary className="he-toc__title">
                {title}
                <Icon.Chevron size={16} />
              </summary>
              {list}
            </details>
          ) : (
            <>
              <p className="he-toc__title">{title}</p>
              {list}
            </>
          )}
        </nav>
      </div>
    </section>
  );
}

/* ── P3-A6: share buttons ─────────────────────────────────────────────────── */

const BRAND_ON: Partial<Record<ShareNetwork, string>> = { x: '#0f1419' };
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

function shareLabel(network: ShareNetwork, copied: boolean) {
  if (network === 'copy') return copied ? 'Link copied' : 'Copy link';
  if (network === 'native') return 'More ways to share';
  if (network === 'email') return 'Share by email';
  return `Share on ${SHARE_LABELS[network]}`;
}

export function ShareBlock(p: P<'share'>) {
  const path = usePathname();
  // The configured origin on the server and in the first render, so both agree;
  // the address actually in the bar once the page is running.
  const [url, setUrl] = useState(SITE_ORIGIN + path);
  const [message, setMessage] = useState(p.text ?? '');
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.origin + window.location.pathname);
    setMessage(p.text || document.title);
    setCanShare(typeof navigator.share === 'function');
  }, [p.text, path]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard permission: the link is still in the address bar.
    }
  };
  const native = () => navigator.share?.({ title: message, url }).catch(() => undefined);

  const networks = p.networks.filter((n) => n !== 'native' || canShare);
  const named = p.style === 'buttons' || p.style === 'text';
  const floating = p.position === 'floating';

  return (
    <section className={cn('he-lsec he-shr-sec', toneClass(p.tone), `is-${p.align}`, `is-${p.position}`)}>
      <div className="shell">
        {p.title && <p className="he-shr__title">{p.title}</p>}
        <ul
          className={cn('he-shr', `is-${p.style}`, `is-${p.size}`, p.brandColors && 'is-brand')}
          aria-label={!p.title || floating ? p.title || 'Share this page' : undefined}
        >
          {networks.map((network) => {
            const href = shareHref(network, url, message);
            const brand = p.brandColors ? SHARE_BRAND[network] : undefined;
            const attrs = {
              className: 'he-shr__a',
              'aria-label': shareLabel(network, copied),
              style: brand ? ({ '--brand': brand, '--brand-on': BRAND_ON[network] ?? '#fff' } as CSSProperties) : undefined,
            };
            const content = (
              <>
                {p.style !== 'text' && <ShareIcon network={network} />}
                {named && <span>{network === 'copy' && copied ? 'Copied' : SHARE_LABELS[network]}</span>}
              </>
            );
            return (
              <li key={network}>
                {href ? (
                  <a href={href} {...attrs} {...(network === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
                    {content}
                  </a>
                ) : (
                  <button type="button" {...attrs} onClick={network === 'copy' ? copy : native}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <span className="sr-only" role="status">
          {copied ? 'Link copied' : ''}
        </span>
      </div>
    </section>
  );
}
