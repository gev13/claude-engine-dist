'use client';

import { useMessages } from '@/components/site/Messages';

import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import { blockSchemas } from '@/lib/blocks';
import type { TextTag } from '@/lib/blockStyle';
import {
  type VideoSource,
  MAP_PROVIDER_LABEL,
  VIDEO_HOST_LABEL,
  mapEmbedUrl,
  mapLinkUrl,
  parseVideoUrl,
  videoEmbedUrl,
} from '@/lib/embeds';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { Carousel } from './Carousel';
import { BgVideo, MediaFill } from './media';
import { SmartLink } from './SmartLink';
import { SiteImg } from '@/components/ui/SiteImg';

/* ═══════════════════════════════════════════════════════════════════════════
   Package 2 media and showcase (EL9 compare, EL10 video, EL11 gallery,
   EL12 horizontal accordion, EL13 projects, EL14 map). The EL15 parallax
   band is an option on the media band (ParallaxLayer).
   ───────────────────────────────────────────────────────────────────────────
   Every one renders a complete, readable resting state on the server. Video
   players and maps are third-party frames, so they load only when a visitor
   presses play or asks for the map.
   ═══════════════════════════════════════════════════════════════════════════ */

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const toneClass = (tone?: keyof typeof TONES) => TONES[tone ?? 'base'];

/** '16/9' → the CSS aspect-ratio and its numeric value. */
function ratioStyle(ratio: string): CSSProperties {
  // `auto` is resolved from the file by the ambient player; a player falls back to 16:9.
  const [w = 16, h = 9] = /^\d+\/\d+$/.test(ratio) ? ratio.split('/').map(Number) : [];
  return { aspectRatio: `${w} / ${h}`, '--ar': (w / h).toFixed(4) } as CSSProperties;
}

function Head({ eyebrow, title, titleAs, intro }: { eyebrow?: string; title?: string; titleAs?: TextTag; intro?: string }) {
  if (!eyebrow && !title && !intro) return null;
  return <BlockHead eyebrow={eyebrow} title={title} titleAs={titleAs} intro={intro} className="mb-9" />;
}

function MaybeLink({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? (
    <SmartLink href={href} className={className}>
      {children}
    </SmartLink>
  ) : (
    <div className={className}>{children}</div>
  );
}

const closeOnBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
};

/* ── EL9: compare ─────────────────────────────────────────────────────────── */

export function CompareBlock(p: P<'compare'>) {
  const [pos, setPos] = useState(p.start);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const vertical = p.orientation === 'vertical';
  const before = (p.beforeLabel || 'Before').toLowerCase();
  const after = (p.afterLabel || 'After').toLowerCase();

  const fromPointer = (clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const ratio = vertical ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
    setPos(Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10);
  };

  return (
    <section className={cn('he-lsec he-cmp-sec', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <figure className="he-cmp__fig">
          <div
            ref={frameRef}
            className={cn('he-cmp', `is-${p.orientation}`, `is-handle-${p.handle}`)}
            style={{ ...ratioStyle(p.ratio), '--pos': `${pos}%` } as CSSProperties}
            onPointerDown={(e) => {
              // On a touch screen an up-and-down wipe would fight the page's own scrolling,
              // so a vertical comparison starts only from its handle.
              if (e.pointerType !== 'mouse' && vertical && !(e.target as Element).closest('.he-cmp__handle')) return;
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (dragging.current) fromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          >
            <SiteImg src={p.afterUrl} alt={p.afterAlt ?? ''} className="he-fill he-cmp__img" draggable={false} loading="lazy" decoding="async" />
            <div className="he-cmp__before">
              <SiteImg src={p.beforeUrl} alt={p.beforeAlt ?? ''} className="he-fill he-cmp__img" draggable={false} loading="lazy" decoding="async" />
            </div>
            {p.beforeLabel && (
              <span className="he-cmp__label is-before" aria-hidden="true">
                {p.beforeLabel}
              </span>
            )}
            {p.afterLabel && (
              <span className="he-cmp__label is-after" aria-hidden="true">
                {p.afterLabel}
              </span>
            )}
            <span className="he-cmp__handle" aria-hidden="true">
              {p.handle !== 'line' && (
                <span className="he-cmp__knob">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(pos)}
              className="he-cmp__range"
              aria-label={`Compare ${before} and ${after}`}
              aria-valuetext={`${Math.round(pos)}% ${before}`}
              aria-orientation={vertical ? 'vertical' : 'horizontal'}
              onChange={(e) => setPos(Number(e.target.value))}
              onKeyDown={(e) => {
                // A range input's up arrow raises the value, which would move a vertical handle down.
                if (!vertical || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                e.preventDefault();
                setPos((v) => Math.min(100, Math.max(0, Math.round(v) + (e.key === 'ArrowDown' ? 5 : -5))));
              }}
            />
          </div>
          {p.caption && <figcaption className="he-show__caption">{p.caption}</figcaption>}
        </figure>
      </div>
    </section>
  );
}

/* ── EL10: video ──────────────────────────────────────────────────────────── */

function Player({ source, title, poster }: { source: VideoSource; title: string; poster?: string }) {
  if (source.kind === 'file') {
    return <video src={source.src} poster={poster} controls autoPlay playsInline className="he-fill he-video__player" aria-label={title} />;
  }
  return (
    <iframe
      src={videoEmbedUrl(source)}
      title={title}
      className="he-video__player"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

export function VideoBlock(p: P<'video'>) {
  const t = useMessages();
  // P3-B8 — the first video, then the playlist. Each loads only when a visitor picks it.
  const items = useMemo(
    () => [{ source: p.source, videoTitle: p.videoTitle, posterUrl: p.posterUrl, duration: undefined as string | undefined }, ...p.playlist],
    [p.source, p.videoTitle, p.posterUrl, p.playlist],
  );
  const [current, setCurrent] = useState(0);
  const item = items[current] ?? items[0]!;
  const source = useMemo(() => parseVideoUrl(item.source), [item.source]);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The play button disappears when the player replaces it, so focus follows to the player.
  useEffect(() => {
    if (playing && p.display === 'inline') frameRef.current?.querySelector<HTMLElement>('iframe, video')?.focus();
  }, [playing, p.display, current]);

  if (!source) return null;
  const host = source.kind === 'file' ? undefined : VIDEO_HOST_LABEL[source.kind];

  const start = () => {
    setPlaying(true);
    if (p.display === 'button') dialogRef.current?.showModal();
  };
  const pick = (i: number) => {
    setCurrent(i);
    start();
  };

  const list = items.length > 1 && (
    <ol className="he-vlist" aria-label={t('block.playlist')}>
      {items.map((it, i) => (
        <li key={it.source + i}>
          <button type="button" className={cn('he-vlist__item', i === current && 'is-active')} aria-current={i === current ? 'true' : undefined} onClick={() => pick(i)}>
            <span className="he-vlist__thumb">
              {it.posterUrl ? (
                <SiteImg src={it.posterUrl} alt="" className="he-fill" loading="lazy" decoding="async" />
              ) : (
                <span className="he-fill he-video__blank" aria-hidden="true" />
              )}
              <span className="he-vlist__play" aria-hidden="true">
                <Icon.Play size={16} />
              </span>
            </span>
            <span>
              <span className="he-vlist__title">{it.videoTitle}</span>
              {it.duration && <span className="he-vlist__dur">{it.duration}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  const button = (
    <button type="button" className={cn('he-vplay', `is-${p.buttonStyle}`, `is-${p.buttonSize}`)} onClick={start}>
      <span className="he-vplay__circle" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
      <span className={p.buttonLabel ? 'he-vplay__text' : 'sr-only'}>
        {p.buttonLabel || 'Play video'}
        <span className="sr-only">
          : {item.videoTitle}
          {host ? ` (plays from ${host})` : ''}
        </span>
      </span>
    </button>
  );

  const showFrame = p.display === 'inline' || Boolean(item.posterUrl);

  return (
    <section className={cn('he-lsec he-video-sec', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className={cn('he-vwrap', list && `has-list is-${p.playlistPosition}`)}>
          <figure className="he-video">
            {showFrame ? (
              <div ref={frameRef} className="he-video__frame" style={ratioStyle(p.ratio)}>
                {playing && p.display === 'inline' ? (
                  <Player key={current} source={source} title={item.videoTitle} poster={item.posterUrl} />
                ) : (
                  <>
                    {item.posterUrl ? (
                      <SiteImg src={item.posterUrl} alt="" className="he-fill" loading="lazy" decoding="async" />
                    ) : (
                      <span className="he-fill he-video__blank" aria-hidden="true" />
                    )}
                    <span className="he-video__cover">{button}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="he-video__solo">{button}</div>
            )}
            {p.caption && <figcaption className="he-show__caption">{p.caption}</figcaption>}
          </figure>
          {list}
        </div>
      </div>
      {p.display === 'button' && (
        <dialog ref={dialogRef} className="he-vdialog" aria-label={item.videoTitle} onClose={() => setPlaying(false)} onClick={closeOnBackdrop}>
          <div className="he-vdialog__frame" style={ratioStyle(p.ratio)}>
            {playing && <Player key={current} source={source} title={item.videoTitle} poster={item.posterUrl} />}
          </div>
          <button type="button" className="he-dialog-close" onClick={() => dialogRef.current?.close()} aria-label={t('block.closeVideo')}>
            <Icon.Close size={20} />
          </button>
        </dialog>
      )}
    </section>
  );
}

/* ── EL11: gallery ────────────────────────────────────────────────────────── */

export function GalleryBlock(p: P<'gallery'>) {
  const t = useMessages();
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = p.images.length;
  const current = open === null ? undefined : p.images[open];
  const go = (step: number) => setOpen((i) => (i === null ? i : (i + step + count) % count));

  return (
    <section className={cn('he-lsec he-gal-sec', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className="he-cq">
          <ul
            className={cn('he-gal', `is-${p.layout}`, `is-gap-${p.gap}`, `is-${p.ratio}`, `is-hover-${p.hover}`)}
            style={{ '--cols': p.columns } as CSSProperties}
          >
            {p.images.map((image, i) => {
              // Inside a link or the lightbox button a second control would be a button in a button.
              const plain = !image.href && !p.lightbox;
              const media = (
                <>
                  {image.videoUrl ? (
                    <BgVideo src={image.videoUrl} poster={image.url} className="he-fill" showControl={plain} />
                  ) : (
                    <SiteImg src={image.url} alt={image.alt ?? ''} className="he-fill" loading="lazy" decoding="async" sizes="third" />
                  )}
                  {p.captions === 'overlay' && image.caption && <span className="he-gal__over">{image.caption}</span>}
                </>
              );
              return (
                <li key={`${image.url}-${i}`} className="he-gal__item">
                  {image.href ? (
                    <SmartLink href={image.href} className="he-gal__media">
                      {media}
                    </SmartLink>
                  ) : p.lightbox ? (
                    <button
                      type="button"
                      className="he-gal__media is-zoomable"
                      aria-label={`Enlarge ${image.alt || image.caption || `picture ${i + 1} of ${count}`}`}
                      onClick={() => {
                        setOpen(i);
                        dialogRef.current?.showModal();
                      }}
                    >
                      {media}
                    </button>
                  ) : (
                    <div className="he-gal__media">{media}</div>
                  )}
                  {p.captions === 'below' && image.caption && <p className="he-gal__cap">{image.caption}</p>}
                </li>
              );
            })}
          </ul>
        </div>
        {p.link && (
          <div className="he-show__more">
            <SmartLink href={p.link.href} className="he-cbtn is-outline is-medium">
              {p.link.label}
            </SmartLink>
          </div>
        )}
      </div>
      {p.lightbox && (
        <dialog
          ref={dialogRef}
          className="he-lightbox"
          aria-label={t('block.pictureViewer')}
          onClose={() => setOpen(null)}
          onClick={closeOnBackdrop}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          {current && open !== null && (
            <figure className="he-lightbox__fig">
              {current.videoUrl ? (
                // Opened on purpose, so it has the browser's own controls and sound can be turned on.
                <video src={current.videoUrl} poster={current.url} className="he-lightbox__img" controls autoPlay muted loop playsInline aria-label={current.alt || current.caption || undefined} />
              ) : (
                <SiteImg src={current.url} alt={current.alt ?? ''} className="he-lightbox__img" />
              )}
              <figcaption className="he-lightbox__cap" aria-live="polite">
                <span className="he-lightbox__count">
                  {open + 1} / {count}
                </span>
                {current.caption}
              </figcaption>
            </figure>
          )}
          {count > 1 && (
            <>
              <button type="button" className="he-lightbox__nav is-prev" onClick={() => go(-1)} aria-label={t('block.previousPicture')}>
                <Icon.ArrowRight size={20} />
              </button>
              <button type="button" className="he-lightbox__nav is-next" onClick={() => go(1)} aria-label={t('block.nextPicture')}>
                <Icon.ArrowRight size={20} />
              </button>
            </>
          )}
          <button type="button" className="he-dialog-close" onClick={() => dialogRef.current?.close()} aria-label={t('block.close')}>
            <Icon.Close size={20} />
          </button>
        </dialog>
      )}
    </section>
  );
}

/* ── EL12: horizontal accordion ───────────────────────────────────────────── */

export function HorizontalAccordionBlock(p: P<'horizontalAccordion'>) {
  const [active, setActive] = useState(0);
  const baseId = useId();

  return (
    <section className={cn('he-lsec he-hacc-sec', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className={cn('he-hacc', `is-${p.height}`)}>
          {p.panels.map((panel, i) => {
            const open = i === active;
            return (
              <div
                key={`${panel.title}-${i}`}
                className={cn('he-hacc__panel', open && 'is-open')}
                onPointerEnter={(e) => {
                  if (p.trigger === 'hover' && e.pointerType === 'mouse') setActive(i);
                }}
              >
                <MediaFill imageUrl={panel.imageUrl} alt={panel.alt} className="he-fill he-hacc__img" />
                <h3 className="he-hacc__h">
                  <button
                    type="button"
                    id={`${baseId}-b${i}`}
                    className="he-hacc__btn"
                    aria-expanded={open}
                    aria-controls={`${baseId}-p${i}`}
                    onClick={() => setActive(i)}
                  >
                    {panel.label && <span className="he-hacc__label">{panel.label}</span>}
                    <span className="he-hacc__title">{panel.title}</span>
                  </button>
                </h3>
                <div id={`${baseId}-p${i}`} role="region" aria-labelledby={`${baseId}-b${i}`} className="he-hacc__body" hidden={!open}>
                  {panel.body && <p>{panel.body}</p>}
                  {panel.link && (
                    <SmartLink href={panel.link.href} className="he-hacc__link">
                      {panel.link.label}
                      <Icon.ArrowRight size={16} />
                    </SmartLink>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── EL13: projects ───────────────────────────────────────────────────────── */

/** A card as the block draws it; a collection's cards also carry linked category chips. */
type ProjectItem = P<'projects'>['items'][number] & { chips?: { label: string; href: string }[] };

/**
 * The next lot of a collection, fetched from `/api/projects` — only what the
 * block's own filters select, published, in the block's order.
 */
export type ProjectsMore = { query: string; total: number };

type ProjectsProps = Omit<P<'projects'>, 'items'> & { items: ProjectItem[]; more?: ProjectsMore };

/** The categories a card is filed under — its chips, or the one typed on a manual card. */
const cardCategories = (item: ProjectItem) =>
  item.chips?.length ? item.chips.map((chip) => chip.label) : item.category ? [item.category] : [];

export function ProjectsBlock(p: ProjectsProps) {
  // A manual list with nothing in it — a collection has its own empty state below.
  if (p.source !== 'collection' && p.items.length === 0) return null;
  return p.layout === 'carousel' ? <ProjectsCarousel {...p} /> : <ProjectsGrid {...p} />;
}

/** P3-B6 — the projects as the carousel's cards, sharing its controls and pause rules. */
function ProjectsCarousel(p: ProjectsProps) {
  const t = useMessages();
  const parsed = blockSchemas.carousel.safeParse({
    tone: p.tone,
    mode: 'cards',
    eyebrow: p.eyebrow,
    title: p.title?.slice(0, 160),
    titleAs: p.titleAs,
    intro: p.intro?.slice(0, 400),
    link: p.link,
    slides: p.items.map((item) => ({
      eyebrow: [cardCategories(item)[0], item.year].filter(Boolean).join(' · ') || undefined,
      title: item.title,
      body: item.summary,
      imageUrl: item.imageUrl,
      alt: item.alt,
      href: item.href,
      buttonLabel: item.href ? t('project.view') : undefined,
    })),
    perView: { base: p.columns, tablet: 2, mobile: 1.15 },
  });
  return parsed.success ? <Carousel {...parsed.data} /> : <ProjectsGrid {...p} layout="classic" />;
}

function ProjectsGrid(p: ProjectsProps) {
  const t = useMessages();
  /* Cards fetched by "Load more" join the ones the server rendered, in state,
     so the category filter keeps working across all of them. */
  const [extra, setExtra] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(p.perPage);
  const all = useMemo(() => [...p.items, ...extra], [p.items, extra]);
  const categories = useMemo(() => Array.from(new Set(all.flatMap(cardCategories))), [all]);
  const [category, setCategory] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [still, setStill] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // A manual list that loads more shows `perPage` first and reveals the rest a lot at a time.
  const manualLimit = p.source !== 'collection' && p.pagination === 'loadMore' ? revealed : Infinity;
  const shown = all
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !category || cardCategories(item).includes(category))
    .slice(0, manualLimit);
  const isList = p.layout === 'list';
  const canLoad =
    p.source === 'collection'
      ? Boolean(p.more && all.length < p.more.total)
      : p.pagination === 'loadMore' && revealed < all.length;

  async function loadMore() {
    if (p.source !== 'collection') {
      setRevealed((n) => n + p.perPage);
      return;
    }
    if (!p.more) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/projects?${p.more.query}&offset=${all.length}`);
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { items: ProjectItem[] };
      setExtra((current) => [...current, ...data.items]);
    } catch {
      /* Nothing to fall back to: the archives and the sitemap list every
         project, so a failed fetch costs this button, not the content. */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const sync = () => setStill(motionReduced());
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, []);

  // The list's picture follows the pointer through custom properties, never through React state.
  const follow = (e: React.PointerEvent) => {
    if (still || e.pointerType !== 'mouse') return;
    const box = listRef.current?.getBoundingClientRect();
    const cursor = cursorRef.current;
    if (!box || !cursor) return;
    cursor.style.setProperty('--x', `${e.clientX - box.left}px`);
    cursor.style.setProperty('--y', `${e.clientY - box.top}px`);
  };

  const meta = (item: ProjectItem) =>
    [item.chips?.length ? null : item.category, item.year].filter(Boolean).join(' · ') || null;

  return (
    <section className={cn('he-lsec he-proj-sec', toneClass(p.tone))}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        {p.filter && categories.length > 1 && (
          <div className="he-proj__filter" role="group" aria-label={t('block.filterProjects')}>
            {[null, ...categories].map((c) => (
              <button
                key={c ?? '*'}
                type="button"
                className="he-proj__chip"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setHovered(null);
                }}
              >
                {c ?? p.allLabel}
              </button>
            ))}
            <p className="sr-only" aria-live="polite">
              {category ? `${shown.length} — ${category}` : ''}
            </p>
          </div>
        )}

        {isList ? (
          <div ref={listRef} className={cn('he-plist', still && 'is-still')} onPointerMove={follow} onPointerLeave={() => setHovered(null)}>
            <ul className="he-plist__ul">
              {shown.map(({ item, i }) => (
                <li key={`${item.title}-${i}`} className="he-plist__row" onPointerEnter={() => setHovered(i)}>
                  <MaybeLink href={item.href} className="he-plist__link">
                    {item.imageUrl && (
                      <SiteImg src={item.imageUrl} alt="" className="he-plist__thumb" loading="lazy" decoding="async" sizes="thumb" />
                    )}
                    <span className="he-plist__title">{item.title}</span>
                    {meta(item) && <span className="he-plist__meta">{meta(item)}</span>}
                  </MaybeLink>
                </li>
              ))}
            </ul>
            <div ref={cursorRef} className={cn('he-plist__cursor', hovered !== null && 'is-on')} aria-hidden="true">
              {shown.map(({ item, i }) =>
                item.imageUrl ? (
                  <SiteImg key={`${item.title}-${i}`} src={item.imageUrl} alt="" className={cn('he-fill', i === hovered && 'is-active')} loading="lazy" decoding="async" />
                ) : null,
              )}
            </div>
          </div>
        ) : (
          <div className="he-cq">
            <ul className={cn('he-proj', `is-${p.layout}`, `is-hover-${p.hover}`)} style={{ '--cols': p.columns } as CSSProperties}>
              {shown.map(({ item, i }) => {
                const text = (
                  <>
                    <h3 className="he-proj__title">{item.title}</h3>
                    {meta(item) && <p className="he-proj__meta">{meta(item)}</p>}
                  </>
                );
                const onPicture = p.layout === 'overlay' || p.layout === 'metro';
                return (
                  <li key={`${item.title}-${i}`} className="he-proj__item">
                    {/* Linked category chips sit beside the card's own link, never inside it. */}
                    {item.chips && item.chips.length > 0 && !onPicture && (
                      <ul className="he-proj__chips">
                        {item.chips.map((chip) => (
                          <li key={chip.href}>
                            <SmartLink href={chip.href} className="he-proj__chip-link">
                              {chip.label}
                            </SmartLink>
                          </li>
                        ))}
                      </ul>
                    )}
                    <MaybeLink href={item.href} className="he-proj__link">
                      <div className="he-proj__media">
                        <MediaFill imageUrl={item.imageUrl} alt={item.alt} className="he-fill" sizes="third" />
                        {p.hover === 'swap' && item.hoverImageUrl && (
                          <SiteImg src={item.hoverImageUrl} alt="" className="he-fill he-proj__alt" loading="lazy" decoding="async" sizes="third" />
                        )}
                        {onPicture && <div className="he-proj__over">{text}</div>}
                      </div>
                      {!onPicture && (
                        <div className="he-proj__text">
                          {text}
                          {p.layout === 'classic' && item.summary && <p className="he-proj__summary">{item.summary}</p>}
                        </div>
                      )}
                    </MaybeLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {p.source === 'collection' && all.length === 0 && <p className="he-proj__empty">{t('project.none')}</p>}

        {canLoad && (
          <div className="he-show__more">
            <button type="button" className="he-cbtn is-outline is-medium" onClick={() => void loadMore()} aria-busy={loading || undefined}>
              {loading ? t('archive.loading') : t('archive.loadMore')}
            </button>
          </div>
        )}

        {p.link && (
          <div className="he-show__more">
            <SmartLink href={p.link.href} className="he-cbtn is-outline is-medium">
              {p.link.label}
            </SmartLink>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── EL14: map ────────────────────────────────────────────────────────────── */

export function MapBlock(p: P<'map'>) {
  const [loaded, setLoaded] = useState(false);
  const embed = mapEmbedUrl(p);
  const provider = MAP_PROVIDER_LABEL[p.provider];

  const card = (
    <div className="he-map__card">
      <address className="he-map__address">{p.address}</address>
      {p.details.length > 0 && (
        <dl className="he-map__details">
          {p.details.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="he-map__actions">
        {p.link && (
          <SmartLink href={p.link.href} className="he-cbtn is-primary is-small">
            {p.link.label}
          </SmartLink>
        )}
        <a href={mapLinkUrl(p)} target="_blank" rel="noopener noreferrer" className="he-map__open">
          Open in {provider}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );

  return (
    <section className={cn('he-lsec he-map-sec', toneClass(p.tone), p.layout === 'full' && 'is-full')}>
      <div className="shell">
        <Head eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
      </div>
      <div className={p.layout === 'full' ? undefined : 'shell'}>
        <div className={cn('he-map', `is-${p.layout}`, `is-${p.height}`)}>
          <div className={cn('he-map__canvas', p.greyscale && 'is-grey')}>
            {loaded && embed ? (
              <iframe src={embed} title={`Map of ${p.address}`} className="he-map__frame" referrerPolicy="strict-origin-when-cross-origin" />
            ) : (
              <div className="he-map__placeholder">
                <span className="he-map__pin" aria-hidden="true" />
                {embed && (
                  <>
                    <button type="button" className="he-cbtn is-outline is-small" onClick={() => setLoaded(true)}>
                      Show the map
                    </button>
                    <p className="he-map__note">Loads a map from {provider}.</p>
                  </>
                )}
              </div>
            )}
          </div>
          {card}
        </div>
      </div>
    </section>
  );
}

