'use client';

import { useMessages } from '@/components/site/Messages';

import Link from '@/components/ui/SiteLink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import type { CarouselSlide, blockSchemas } from '@/lib/blocks';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BlockHead, BlockTitle } from '../parts';
import { MediaFill } from './media';
import { Stars } from './Stars';

/* ═══════════════════════════════════════════════════════════════════════════
   Carousel
   ───────────────────────────────────────────────────────────────────────────
   Six slider patterns on one set of controls (SL5):

     cards · products · heroCards   a scroll-snap track; the browser does the
                                    swiping, the arrows and dots drive it
     hero · media                   stacked slides that fade or slide in
     coverflow                      stacked slides placed in 3D by offset

   Autoplay stops on hover and focus, off screen, when the visitor asks for
   less motion, and whenever they press the pause button — which is always
   shown while autoplay is on.
   ═══════════════════════════════════════════════════════════════════════════ */

type P = z.output<(typeof blockSchemas)['carousel']>;

const DEFAULT_VIEW: Record<'cards' | 'products' | 'heroCards', [number, number, number, number]> = {
  cards: [4, 3, 2, 1.15],
  products: [4, 3, 2, 1.25],
  heroCards: [1.12, 1.1, 1.06, 1.04],
};

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const update = () => setReduced(motionReduced());
    update();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', update);
    window.addEventListener(MOTION_EVENT, update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener(MOTION_EVENT, update);
    };
  }, []);
  return reduced;
}

function useAutoplay(enabled: boolean, interval: number, next: () => void, rootRef: React.RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !enabled) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef, enabled]);

  const playing = enabled && !reduced && !userPaused;
  const running = playing && !held && visible;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(next, interval * 1000);
    return () => window.clearInterval(timer);
  }, [running, interval, next]);

  return {
    playing,
    running,
    togglePause: () => setUserPaused((v) => !v),
    hold: {
      onPointerEnter: () => setHeld(true),
      onPointerLeave: () => setHeld(false),
      onFocus: () => setHeld(true),
      onBlur: () => setHeld(false),
    },
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

function Indicator({
  kind,
  count,
  active,
  onGo,
  onPrev,
  onNext,
  running,
  interval,
  slides,
}: {
  kind: P['indicator'];
  count: number;
  active: number;
  onGo: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  running: boolean;
  interval: number;
  /** P4-A2 — thumbnails and chapter lists name their slides, so they need them. */
  slides?: readonly CarouselSlide[];
}) {
  const t = useMessages();
  if (kind === 'none' || count < 2) return null;

  // A filmstrip of the slides; a slide without a picture shows its number.
  if (kind === 'thumbs' && slides && slides.length > 0) {
    return (
      <div className="he-ind he-ind--thumbs" role="tablist" aria-label={t('block.slides')}>
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={s.title || s.caption || `Slide ${i + 1}`}
            className={cn('he-ind__thumb', i === active && 'is-active')}
            onClick={() => onGo(i)}
          >
            {s.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={s.imageUrl} alt="" loading="lazy" />
            ) : (
              <span className="he-ind__thumbnum">{pad(i + 1)}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // The slide titles as the navigation, the way a chaptered slider reads.
  if (kind === 'chapters' && slides && slides.length > 0) {
    return (
      <div className="he-ind he-ind--chapters" role="tablist" aria-label={t('block.slides')}>
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={cn('he-ind__chapter', i === active && 'is-active')}
            onClick={() => onGo(i)}
          >
            <span className="he-ind__chapternum">{pad(i + 1)}</span>
            <span className="he-ind__chaptertext">{s.title || s.caption || `Slide ${i + 1}`}</span>
          </button>
        ))}
      </div>
    );
  }
  if (kind === 'counter') {
    return (
      <span className="he-ind he-ind--counter" aria-live="polite">
        {pad(active + 1)} / {pad(count)}
      </span>
    );
  }
  if (kind === 'numbers') {
    return (
      <div className="he-ind he-ind--numbers">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className={cn('he-ind__num', i === active && 'is-active')}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => onGo(i)}
          >
            {pad(i + 1)}
          </button>
        ))}
      </div>
    );
  }

  const dots = Array.from({ length: count }, (_, i) => (
    <button
      key={i}
      type="button"
      className={cn('he-ind__dot', i === active && 'is-active')}
      aria-label={`Go to slide ${i + 1}`}
      aria-current={i === active ? 'true' : undefined}
      onClick={() => onGo(i)}
    >
      {kind === 'progress' && (
        <span
          key={`${active}-${running}`}
          className={cn('he-ind__fill', i === active && running && 'is-running', i < active && 'is-done')}
          style={i === active && running ? { animationDuration: `${interval}s` } : undefined}
        />
      )}
    </button>
  ));

  if (kind === 'capsule') {
    return (
      <div className="he-ind he-ind--capsule">
        <button type="button" className="he-ind__step" aria-label={t('block.previousSlide')} onClick={onPrev}>
          <Icon.Chevron dir="left" size={15} />
        </button>
        {dots}
        <button type="button" className="he-ind__step" aria-label={t('block.nextSlide')} onClick={onNext}>
          <Icon.Chevron dir="right" size={15} />
        </button>
      </div>
    );
  }

  return <div className={cn('he-ind', `he-ind--${kind}`)}>{dots}</div>;
}

function PauseButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="he-pause" onClick={onToggle} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>
      {playing ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
    </button>
  );
}

function Arrows({
  onPrev,
  onNext,
  atStart,
  atEnd,
  className,
}: {
  onPrev: () => void;
  onNext: () => void;
  atStart: boolean;
  atEnd: boolean;
  className?: string;
}) {
  const t = useMessages();
  return (
    <div className={cn('he-arrows', className)}>
      <button type="button" className="he-arrow is-prev" aria-label={t('block.previousSlide')} onClick={onPrev} disabled={atStart}>
        <Icon.Chevron dir="left" size={20} />
      </button>
      <button type="button" className="he-arrow is-next" aria-label={t('block.nextSlide')} onClick={onNext} disabled={atEnd}>
        <Icon.Chevron dir="right" size={20} />
      </button>
    </div>
  );
}

/**
 * P4-A7 — drag a scroll-snap track sideways with a mouse. Touch screens and
 * trackpads already scroll it themselves, so only a mouse is caught here, and
 * a drag of more than a few pixels swallows the click it would otherwise make.
 */
function useDrag(enabled: boolean, trackRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !enabled) return;

    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startLeft = track.scrollLeft;
      track.classList.add('is-grabbing');
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startLeft - dx;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-grabbing');
    };
    const click = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      }
    };

    track.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    track.addEventListener('click', click, true);
    return () => {
      track.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      track.removeEventListener('click', click, true);
    };
  }, [enabled, trackRef]);
}

/** Active index plus step functions that respect `loop`. */
function useIndex(count: number, loop: boolean) {
  const [active, setActive] = useState(0);
  const go = useCallback((i: number) => setActive(loop ? (i + count) % count : Math.min(Math.max(i, 0), count - 1)), [count, loop]);
  const next = useCallback(() => setActive((a) => (a + 1 < count ? a + 1 : loop ? 0 : a)), [count, loop]);
  const prev = useCallback(() => setActive((a) => (a > 0 ? a - 1 : loop ? count - 1 : a)), [count, loop]);
  return { active, setActive, go, next, prev };
}

export function Carousel(p: P) {
  if (p.mode === 'hero') return <HeroSlider {...p} />;
  if (p.mode === 'media') return <MediaSlider {...p} />;
  if (p.mode === 'coverflow') return <CoverFlow {...p} />;
  if (p.mode === 'quotes') return <QuoteSlider {...p} />;
  if (p.mode === 'splitScreen') return <SplitScreenSlider {...p} />;
  if (p.mode === 'filmstrip') return <FilmstripSlider {...p} />;
  return <TrackCarousel {...p} />;
}

/* ── P4-A1: split screen ──────────────────────────────────────────────────── */

/**
 * Two halves that move in opposite directions: the words rise as the picture
 * falls. The slide number and worded steps sit in the corner, where a split
 * screen has no room for a heading of its own.
 */
function SplitScreenSlider(p: P) {
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);

  return (
    <section
      ref={rootRef}
      className={cn('he-split he-bleed-top', TONES[p.tone ?? 'base'], p.kenBurns && 'is-kenburns')}
      aria-roledescription="carousel"
      aria-label={p.title || 'Slider'}
      {...auto.hold}
    >
      <div className="he-split__stage">
        <div className="he-split__half is-text">
          {p.slides.map((s, i) => (
            <div
              key={i}
              className={cn('he-split__panel', i === active && 'is-active', i < active && 'is-before')}
              aria-hidden={i !== active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              {s.eyebrow && <div className="he-split__eyebrow">{s.eyebrow}</div>}
              {s.title && (
                <BlockTitle as={i === 0 ? (p.titleAs ?? 'h2') : 'h2'} className="he-split__title">
                  {s.title}
                </BlockTitle>
              )}
              {s.body && <p className="he-split__body">{s.body}</p>}
              {s.href && (
                <Link href={s.href} className="he-split__cta" tabIndex={i === active ? 0 : -1}>
                  {s.buttonLabel || 'Discover'}
                  <span aria-hidden="true">›</span>
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="he-split__half is-media">
          {p.slides.map((s, i) => (
            <div key={i} className={cn('he-split__pane', i === active && 'is-active', i < active && 'is-before')} aria-hidden={i !== active}>
              <MediaFill
                imageUrl={s.imageUrl}
                videoUrl={s.videoUrl}
                alt={i === active ? s.alt : ''}
                className="he-split__media"
                eager={i === 0}
                paused={!auto.playing || i !== active}
                showControl={false}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="he-split__controls">
        <span className="he-split__count" aria-live="polite">
          {pad(active + 1)} <span aria-hidden="true">/</span> {pad(count)}
        </span>
        {count > 1 && (
          <div className="he-split__nav">
            <button type="button" className="he-split__step" onClick={prev} disabled={!p.loop && active === 0}>
              <Icon.Chevron dir="left" size={15} /> Prev
            </button>
            <button type="button" className="he-split__step" onClick={next} disabled={!p.loop && active === count - 1}>
              Next <Icon.Chevron dir="right" size={15} />
            </button>
          </div>
        )}
        {p.indicator !== 'none' && p.indicator !== 'counter' && count > 1 && (
          <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
        )}
        {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
      </div>
    </section>
  );
}

/* ── P4-A6: filmstrip ─────────────────────────────────────────────────────── */

/** Frames drifting past in perspective; the middle one is sharp, its neighbours lean away. */
function FilmstripSlider(p: P) {
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);
  const current = p.slides[active];

  return (
    <section ref={rootRef} className={cn('he-film', TONES[p.tone ?? 'base'])} aria-roledescription="carousel" aria-label={p.title || 'Gallery'} {...auto.hold}>
      {(p.title || p.eyebrow || p.intro) && (
        <div className="shell he-film__head">
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" />
        </div>
      )}

      <div className="he-film__stage">
        {p.slides.map((s, i) => {
          const offset = i - active;
          const distance = Math.abs(offset);
          // Computed numbers only — nothing from the editor reaches this style.
          const style = {
            '--x': `${offset * 64}%`,
            '--r': `${offset * -14}deg`,
            '--s': distance === 0 ? 1 : Math.max(0.62, 0.86 - (distance - 1) * 0.12),
            '--o': distance > 2 ? 0 : 1,
            '--blur': distance === 0 ? '0px' : `${Math.min(5, distance * 2)}px`,
            zIndex: 10 - distance,
          } as React.CSSProperties;
          return (
            <button
              key={i}
              type="button"
              className={cn('he-film__frame', distance === 0 && 'is-active')}
              style={style}
              aria-hidden={distance > 2}
              tabIndex={distance === 0 ? -1 : 0}
              aria-label={distance === 0 ? undefined : `Show ${s.title || `frame ${i + 1}`}`}
              onClick={() => go(i)}
            >
              <MediaFill
                imageUrl={s.imageUrl}
                videoUrl={s.videoUrl}
                alt={distance === 0 ? s.alt : ''}
                className="he-film__media"
                showControl={false}
                paused={distance !== 0}
              />
            </button>
          );
        })}
      </div>

      <div className="shell he-film__foot">
        <p className="he-film__caption" aria-live="polite">
          {current?.title || current?.caption || ''}
        </p>
        <div className="he-film__controls">
          {p.arrows !== 'none' && count > 1 && (
            <Arrows onPrev={prev} onNext={next} atStart={!p.loop && active === 0} atEnd={!p.loop && active === count - 1} className="is-inline" />
          )}
          <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
          {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
        </div>
      </div>
    </section>
  );
}

/* ── Cards, products, promo cards ─────────────────────────────────────────── */

function CardSlide({ s, mode }: { s: CarouselSlide; mode: P['mode'] }) {
  if (mode === 'heroCards') {
    return (
      <div className="he-hcard">
        <div className="he-hcard__head">
          <div>
            {s.eyebrow && <div className="he-hcard__eyebrow">{s.eyebrow}</div>}
            {s.title && <h3 className="he-hcard__title">{s.title}</h3>}
            {s.body && <p className="he-hcard__body">{s.body}</p>}
          </div>
          {s.href && (
            <Link href={s.href} className="he-btn he-btn-primary he-hcard__cta">
              {s.buttonLabel || 'Learn more'}
            </Link>
          )}
        </div>
        <div className="he-hcard__media">
          <MediaFill imageUrl={s.imageUrl} videoUrl={s.videoUrl} alt={s.alt} className="he-hcard__img" />
        </div>
      </div>
    );
  }

  const inner = (
    <>
      <div className="he-card__media">
        <MediaFill imageUrl={s.imageUrl} videoUrl={s.videoUrl} alt={s.alt} className="he-card__img" showControl={false} />
        {s.badge && <span className="he-card__badge">{s.badge}</span>}
      </div>
      <div className="he-card__body">
        {s.eyebrow && <div className="he-card__eyebrow">{s.eyebrow}</div>}
        {s.title && <h3 className="he-card__title">{s.title}</h3>}
        {s.rating !== undefined && <Stars value={s.rating} className="he-card__stars" />}
        {s.body && <p className="he-card__text">{s.body}</p>}
        {mode === 'products' && s.swatches && s.swatches.length > 0 && (
          <ul className="he-card__swatches" aria-label={`${s.swatches.length} colours`}>
            {s.swatches.map((c, i) => (
              <li key={c + i} style={{ background: c }} />
            ))}
          </ul>
        )}
        {s.price && <div className="he-card__price">{s.price}</div>}
        {s.href && (
          <span className="he-card__more">
            {s.buttonLabel || 'Learn more'} <span aria-hidden="true">›</span>
          </span>
        )}
      </div>
    </>
  );

  return s.href ? (
    <Link href={s.href} className={cn('he-card', `he-card--${mode}`)}>
      {inner}
    </Link>
  ) : (
    <div className={cn('he-card', `he-card--${mode}`)}>{inner}</div>
  );
}

function TrackCarousel(p: P) {
  const t = useMessages();
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = p.slides.length;
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: count <= 1 });

  const mode = p.mode as 'cards' | 'products' | 'heroCards';
  const d = DEFAULT_VIEW[mode] ?? DEFAULT_VIEW.cards;
  const view = {
    base: p.perView?.base ?? d[0],
    laptop: p.perView?.laptop ?? p.perView?.base ?? d[1],
    tablet: p.perView?.tablet ?? d[2],
    mobile: p.perView?.mobile ?? d[3],
  };

  const scrollToIndex = useCallback(
    (i: number) => {
      const track = trackRef.current;
      const target = track?.children[i] as HTMLElement | undefined;
      if (!track || !target) return;
      const padding = parseFloat(getComputedStyle(track).scrollPaddingInlineStart || '0') || 0;
      track.scrollTo({ left: target.offsetLeft - padding, behavior: motionReduced() ? 'auto' : 'smooth' });
    },
    [],
  );

  const go = useCallback((i: number) => scrollToIndex(p.loop ? (i + count) % count : Math.max(0, Math.min(i, count - 1))), [count, p.loop, scrollToIndex]);
  const next = useCallback(() => (edges.end ? (p.loop ? scrollToIndex(0) : undefined) : scrollToIndex(active + 1)), [edges.end, p.loop, active, scrollToIndex]);
  const prev = useCallback(() => (edges.start ? (p.loop ? scrollToIndex(count - 1) : undefined) : scrollToIndex(active - 1)), [edges.start, p.loop, active, count, scrollToIndex]);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const padding = parseFloat(getComputedStyle(track).scrollPaddingInlineStart || '0') || 0;
    const x = track.scrollLeft + padding;
    let best = 0;
    let bestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);
    setEdges({ start: track.scrollLeft <= 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    onScroll();
    window.addEventListener('resize', onScroll);
    return () => window.removeEventListener('resize', onScroll);
  }, [onScroll]);

  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);
  useDrag(p.drag, trackRef);
  const arrows = <Arrows onPrev={prev} onNext={next} atStart={!p.loop && edges.start} atEnd={!p.loop && edges.end} className={`is-${p.arrows}`} />;

  return (
    <section
      ref={rootRef}
      className={cn('he-car', `he-car--${mode}`, TONES[p.tone ?? 'base'], p.drag && 'is-draggable', p.kenBurns && 'is-kenburns')}
      aria-roledescription="carousel"
      aria-label={p.title || 'Carousel'}
      style={
        {
          '--pv-base': view.base,
          '--pv-laptop': view.laptop,
          '--pv-tablet': view.tablet,
          '--pv-mobile': view.mobile,
        } as React.CSSProperties
      }
      {...auto.hold}
    >
      {(p.title || p.eyebrow || p.intro || p.link || p.arrows === 'corner') && (
        <div className="shell he-car__head">
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
          <div className="he-car__headside">
            {p.link && (
              <Link href={p.link.href} className="he-car__link">
                {p.link.label} <span aria-hidden="true">›</span>
              </Link>
            )}
            {p.arrows === 'corner' && count > 1 && arrows}
          </div>
        </div>
      )}

      <div className={cn('he-car__viewport', p.arrows === 'edge' && 'is-edge')}>
        {(p.arrows === 'side' || p.arrows === 'edge') && count > 1 && arrows}
        <div ref={trackRef} className="he-car__track" onScroll={onScroll} tabIndex={0} aria-label={t('block.slidesScroll')}>
          {p.slides.map((s, i) => (
            <div key={i} className="he-car__slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <CardSlide s={s} mode={mode} />
            </div>
          ))}
        </div>
      </div>

      {(p.indicator !== 'none' || p.autoplay) && count > 1 && (
        <div className="shell he-car__foot">
          <Indicator
            kind={p.indicator}
            count={count}
            active={active}
            onGo={go}
            onPrev={prev}
            onNext={next}
            running={auto.running}
            interval={p.interval}
            slides={p.slides}
          />
          {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
        </div>
      )}
    </section>
  );
}

/* ── HR6: full-screen slider ──────────────────────────────────────────────── */

function HeroSlider(p: P) {
  const t = useMessages();
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);

  return (
    <section
      ref={rootRef}
      className={cn('he-cslide he-bleed-top', `is-${p.transition}`, p.direction === 'vertical' && 'is-vertical', p.kenBurns && 'is-kenburns')}
      aria-roledescription="carousel"
      aria-label={p.title || 'Featured'}
      {...auto.hold}
    >
      <div className="he-cslide__stage">
        {p.slides.map((s, i) => (
          <div
            key={i}
            className={cn('he-cslide__slide', i === active && 'is-active', i < active && 'is-before')}
            aria-hidden={i !== active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <MediaFill
              imageUrl={s.imageUrl}
              videoUrl={s.videoUrl}
              alt={s.alt}
              className="he-cslide__media"
              eager={i === 0}
              paused={!auto.playing || i !== active}
              showControl={false}
            />
            <div className="he-cslide__text">
              {s.eyebrow && <div className="he-cslide__eyebrow">{s.eyebrow}</div>}
              {s.title && (
                <BlockTitle as={i === 0 ? (p.titleAs ?? 'h2') : 'h2'} className="he-cslide__title">
                  {s.title}
                </BlockTitle>
              )}
              {s.body && <p className="he-cslide__body">{s.body}</p>}
              {s.href && (
                <Link href={s.href} className="he-cslide__cta" tabIndex={i === active ? 0 : -1}>
                  {s.buttonLabel || 'Discover'}
                  <span className="he-cslide__ring" aria-hidden="true">
                    <Icon.ArrowRight size={14} />
                  </span>
                </Link>
              )}
            </div>
          </div>
        ))}

        {p.arrows !== 'none' && count > 1 && (
          <Arrows onPrev={prev} onNext={next} atStart={!p.loop && active === 0} atEnd={!p.loop && active === count - 1} className="is-side" />
        )}

        <div className="he-cslide__controls">
          <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
          {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
        </div>
      </div>

      {p.strip.length > 0 && (
        <nav className="he-cslide__strip" aria-label={t('block.sections')}>
          {p.strip.map((link) => (
            <Link key={link.href + link.label} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

/* ── SL2: one image at a time beside fixed text ───────────────────────────── */

function MediaSlider(p: P) {
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);
  const current = p.slides[active];

  return (
    <section ref={rootRef} className={cn('he-mslide', TONES[p.tone ?? 'base'], p.kenBurns && 'is-kenburns')} aria-roledescription="carousel" aria-label={p.title || 'Gallery'} {...auto.hold}>
      <div className="shell he-mslide__grid">
        <div className="he-mslide__text">
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
          {p.link && (
            <Link href={p.link.href} className="he-btn he-btn-outline he-mslide__link">
              {p.link.label}
            </Link>
          )}
        </div>
        <div className="he-mslide__main">
          <div className={cn('he-mslide__stage', `is-${p.transition}`)}>
            {p.slides.map((s, i) => (
              <div key={i} className={cn('he-mslide__slide', i === active && 'is-active')} aria-hidden={i !== active}>
                <MediaFill imageUrl={s.imageUrl} videoUrl={s.videoUrl} alt={s.alt} className="he-mslide__media" paused={i !== active} showControl={false} />
              </div>
            ))}
            {p.arrows !== 'none' && count > 1 && (
              <Arrows onPrev={prev} onNext={next} atStart={!p.loop && active === 0} atEnd={!p.loop && active === count - 1} className="is-side" />
            )}
          </div>
          {current?.specs && current.specs.length > 0 && (
            <dl className="he-mslide__specs">
              {current.specs.map((spec) => (
                <div key={spec.label} className="he-mslide__spec">
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="he-mslide__foot">
            <p className="he-mslide__caption" aria-live="polite">
              {current?.caption || current?.title || ''}
            </p>
            <div className="he-mslide__controls">
              <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
              {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── V8: testimonials, one at a time ──────────────────────────────────────── */

/**
 * Text slides: the quote is the slide's text, the name its title, the role its
 * caption and the photo its image. Every slide sits in the same grid cell, so
 * the block is as tall as its longest quote and never jumps between slides.
 */
function QuoteSlider(p: P) {
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);

  return (
    <section
      ref={rootRef}
      className={cn('he-lsec he-qslide', TONES[p.tone ?? 'base'])}
      aria-roledescription="carousel"
      aria-label={p.title || 'Testimonials'}
      {...auto.hold}
    >
      <div className="shell">
        {(p.title || p.eyebrow || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" />}
        <div className="he-qslide__stage">
          {p.slides.map((s, i) => (
            <figure
              key={i}
              className={cn('he-qslide__slide', i === active && 'is-active')}
              aria-hidden={i !== active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              <span className="he-qslide__mark" aria-hidden="true">
                &ldquo;
              </span>
              {s.rating !== undefined && <Stars value={s.rating} className="he-qslide__stars" />}
              {s.body && <blockquote className="he-qslide__text">{s.body}</blockquote>}
              {(s.title || s.caption) && (
                <figcaption className="he-qslide__cap">
                  {s.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.imageUrl} alt="" className="he-qslide__avatar" loading="lazy" />
                  )}
                  <span>
                    {s.title && <span className="he-qslide__name">{s.title}</span>}
                    {s.caption && <span className="he-qslide__role">{s.caption}</span>}
                  </span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        {count > 1 && (
          <div className="he-qslide__controls">
            {p.arrows !== 'none' && (
              <Arrows onPrev={prev} onNext={next} atStart={!p.loop && active === 0} atEnd={!p.loop && active === count - 1} className="is-inline" />
            )}
            <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
            {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── SL4: cover-flow ──────────────────────────────────────────────────────── */

function CoverFlow(p: P) {
  const rootRef = useRef<HTMLElement>(null);
  const count = p.slides.length;
  const { active, go, next, prev } = useIndex(count, p.loop);
  const auto = useAutoplay(p.autoplay, p.interval, next, rootRef);
  const current = p.slides[active];

  return (
    <section ref={rootRef} className={cn('he-cover', TONES[p.tone ?? 'base'])} aria-roledescription="carousel" aria-label={p.title || 'Gallery'} {...auto.hold}>
      <div className="shell">
        <div className="he-car__head">
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        </div>
        <div className="he-cover__stage">
          {p.slides.map((s, i) => {
            const offset = i - active;
            const distance = Math.abs(offset);
            const side = Math.sign(offset);
            // Computed numbers only — nothing from the editor reaches this style.
            const style = {
              '--x': distance === 0 ? '0%' : `${side * (58 + (distance - 1) * 22)}%`,
              '--r': distance === 0 ? '0deg' : `${side * -38}deg`,
              '--s': distance === 0 ? 1 : Math.max(0.6, 0.84 - (distance - 1) * 0.1),
              '--o': distance > 2 ? 0 : 1,
              zIndex: 10 - distance,
            } as React.CSSProperties;
            return (
              <button
                key={i}
                type="button"
                className={cn('he-cover__item', distance === 0 && 'is-active')}
                style={style}
                aria-hidden={distance > 2}
                tabIndex={distance === 0 ? -1 : 0}
                aria-label={distance === 0 ? undefined : `Show ${s.title || `image ${i + 1}`}`}
                onClick={() => go(i)}
              >
                <MediaFill imageUrl={s.imageUrl} videoUrl={s.videoUrl} alt={distance === 0 ? s.alt : ''} className="he-cover__media" showControl={false} paused={distance !== 0} />
              </button>
            );
          })}
        </div>
        <div className="he-cover__foot">
          <p className="he-cover__caption" aria-live="polite">
            {current?.caption || current?.title || ''}
          </p>
          <div className="he-cover__controls">
            <Indicator kind={p.indicator} count={count} active={active} onGo={go} onPrev={prev} onNext={next} running={auto.running} interval={p.interval} slides={p.slides} />
            {p.autoplay && <PauseButton playing={auto.playing} onToggle={auto.togglePause} />}
            {p.arrows !== 'none' && count > 1 && (
              <Arrows onPrev={prev} onNext={next} atStart={!p.loop && active === 0} atEnd={!p.loop && active === count - 1} className="is-inline" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
