'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { TIER_RANGE } from '@/lib/tierRange';

/* ═══════════════════════════════════════════════════════════════════════════
   A section pinned to the scroll (3.34)
   ───────────────────────────────────────────────────────────────────────────
   Design → *Pin to the scroll*. Rendered last inside the section's wrapper,
   this finds the first sliding row in it (a block's own, or one in a row's
   columns) and, on the tiers asked for, holds the part that holds that row at
   the top of the screen while the page scrolls through a run as long as the
   row's overflow: vertical scrolling then moves the cards from the first to
   the last, and the page goes on.

   Nothing changes before this runs — the server draws the ordinary sliding
   row, with an empty run under it — and nothing changes for a visitor who
   asked for less motion, on a tier not asked for, or when the cards fit. The
   row itself stays the thing that scrolls (set from here, not by the finger),
   so its cards keep their order for the keyboard and a screen reader; a card
   brought into view by focus brings the page to the same place.
   ═══════════════════════════════════════════════════════════════════════════ */

const TRACK = '.he-swipe-track, [class*="grid-cols-"], .shell > [class^="he-r-"]';
const GAP = 16;

type Tier = keyof typeof TIER_RANGE;

/** "07" — the counter's two figures. */
const pad = (n: number) => String(n).padStart(2, '0');

/** The first grid in the section that is drawn as a sliding row right now. */
export function slidingRow(host: HTMLElement): HTMLElement | null {
  for (const el of host.querySelectorAll<HTMLElement>(TRACK)) {
    // 3.34.1 — a row hidden on this screen (a block shown on other tiers only) is not the one.
    if (el.getClientRects().length === 0) continue;
    const style = getComputedStyle(el);
    if (style.display === 'flex' && /auto|scroll|hidden/.test(style.overflowX)) return el;
  }
  return null;
}

/** The section's own child that holds the row: the part that stays in view. */
function frameOf(host: HTMLElement, track: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = track;
  while (el && el.parentElement !== host) el = el.parentElement;
  return el;
}

/** Something between the section and the page that scrolls or clips would stop a sticky part. */
function boxedIn(host: HTMLElement): boolean {
  for (let el = host.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (/hidden|auto|scroll/.test(style.overflowX + style.overflowY)) return true;
  }
  return false;
}

/** The lines of words above the row inside the part that stays, in page order. */
function linesBefore(frame: HTMLElement, track: HTMLElement, skip: HTMLElement | null): DOMRect[] {
  const lines: DOMRect[] = [];
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || skip?.contains(node)) continue;
    if (!(track.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) || track.contains(node)) break;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) if (rect.width > 1 && rect.height > 1) lines.push(rect);
  }
  return lines;
}

export function ScrollPin({ at, counter, line }: { at: Tier[]; counter?: boolean; line?: boolean }) {
  const runRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const api = useRef<(() => void) | null>(null);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [total, setTotal] = useState(0);
  const query = at
    .filter((tier) => tier in TIER_RANGE)
    .map((tier) => TIER_RANGE[tier])
    .join(', ');

  useEffect(() => {
    const run = runRef.current;
    const host = run?.parentElement;
    if (!run || !host || !query) return;
    const tiers = window.matchMedia(query);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let track: HTMLElement | null = null;
    let sticky: HTMLElement | null = null;
    /* The row's overflow (also the run's length: one pixel of page per pixel
       of row), where the part that stays sits in the section before it
       sticks, the line it sticks at, and how many cards there are. */
    let max = 0;
    let lead = 0;
    let top = 0;
    let cards = 0;
    let written = -1;
    let frameId = 0;
    let layoutId = 0;
    let width = window.innerWidth;
    let watched: HTMLElement | null = null;
    let watchedWidth = -1;
    const observer = new ResizeObserver(([entry]) => {
      // Only a change of the row's width: the first report on observing is not one.
      if (!entry || Math.round(entry.contentRect.width) === watchedWidth) return;
      watchedWidth = Math.round(entry.contentRect.width);
      relayout();
    });

    const release = () => {
      delete host.dataset.hePin;
      delete host.dataset.hePinClip;
      host.style.removeProperty('--he-pin-run');
      if (track) {
        delete track.dataset.hePinTrack;
        track.style.removeProperty('margin-top');
      }
      if (sticky) {
        delete sticky.dataset.hePinSticky;
        for (const name of ['--he-pin-a', '--he-pin-span', '--he-pin-x', '--he-pin-y']) sticky.style.removeProperty(name);
      }
    };

    /* The counter and line beside the words above the row, their foot on the
       last line and their end on the row's; or, where that would touch the
       words (a phone), under them at the start, with room made above the row. */
    const place = () => {
      const progress = progressRef.current;
      if (!progress || !sticky || !track) return;
      track.style.removeProperty('margin-top');
      const s = sticky.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      const w = progress.offsetWidth;
      const h = progress.offsetHeight;
      const lines = linesBefore(sticky, track, progress);
      const bottom = lines.length ? Math.max(...lines.map((r) => r.bottom)) : 0;
      let x: number;
      let y: number;
      const left = t.right - w;
      if (lines.length && !lines.some((r) => r.bottom > bottom - h && r.top < bottom && r.right > left - 24)) {
        progress.dataset.place = 'beside';
        x = left - s.left;
        y = bottom - h - s.top;
      } else {
        progress.dataset.place = 'under';
        x = t.left - s.left;
        y = lines.length ? bottom - s.top + GAP : t.top - s.top;
        const room = y + h + GAP - (t.top - s.top);
        if (room > 0) track.style.marginTop = `${(parseFloat(getComputedStyle(track).marginTop) || 0) + room}px`;
      }
      sticky.style.setProperty('--he-pin-x', `${Math.round(x)}px`);
      sticky.style.setProperty('--he-pin-y', `${Math.round(y)}px`);
    };

    /* What has to be seen while stuck: from the first line of words above the
       row (or the row's top) to the row's foot. The stylesheet centres that
       span under the header, or, taller than the screen, keeps its words at
       the top — the space above them is what goes off the screen. */
    const frameSpan = () => {
      if (!sticky || !track) return;
      const s = sticky.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      const lines = linesBefore(sticky, track, progressRef.current);
      // The counter is left out: unpinned, it is placed against some ancestor far above.
      const first = Math.min(t.top, ...lines.map((r) => r.top));
      sticky.style.setProperty('--he-pin-a', `${Math.round(first - s.top)}px`);
      sticky.style.setProperty('--he-pin-span', `${Math.round(t.bottom - first)}px`);
    };

    const update = () => {
      frameId = 0;
      if (!track || !sticky) return;
      const px = Math.min(max, Math.max(0, top - (host.getBoundingClientRect().top + lead)));
      written = Math.round(px);
      track.scrollLeft = written;
      const share = max ? px / max : 0;
      if (countRef.current) countRef.current.textContent = pad(Math.min(cards, 1 + Math.floor(share * (cards - 0.001))));
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${Math.max(cards ? 1 / cards : 0, share)})`;
    };

    const layout = () => {
      layoutId = 0;
      const was = host.dataset.hePin === 'on';
      const before = host.getBoundingClientRect().bottom;
      release();
      track = tiers.matches && !motionReduced() && !boxedIn(host) ? slidingRow(host) : null;
      sticky = track ? frameOf(host, track) : null;
      max = track ? track.scrollWidth - track.clientWidth : 0;
      if (!track || !sticky || max < 2) {
        track = sticky = null;
        setFrame(null);
        return;
      }
      if (/hidden|auto|scroll/.test(getComputedStyle(host).overflowY)) host.dataset.hePinClip = '';
      lead = sticky.getBoundingClientRect().top - host.getBoundingClientRect().top;
      track.dataset.hePinTrack = '';
      place();
      frameSpan();
      sticky.dataset.hePinSticky = '';
      host.dataset.hePin = 'on';
      max = track.scrollWidth - track.clientWidth;
      host.style.setProperty('--he-pin-run', `${max}px`);
      top = parseFloat(getComputedStyle(sticky).top) || 0;
      cards = track.children.length;
      if (watched !== track) {
        observer.disconnect();
        watched = track;
        watchedWidth = Math.round(track.clientWidth);
        observer.observe(track);
      }
      setTotal(cards);
      setFrame(sticky);
      // A section wholly above the screen grew: keep what is on screen where it was (Safari has no scroll anchoring).
      if (!was && before <= 0) {
        const grown = host.getBoundingClientRect().bottom - before;
        if (grown) window.scrollBy({ top: grown, behavior: 'instant' });
      }
      update();
    };

    const schedule = () => {
      if (!frameId) frameId = window.requestAnimationFrame(update);
    };
    const relayout = () => {
      if (!layoutId) layoutId = window.requestAnimationFrame(layout);
    };
    // A phone's address bar coming and going changes only the height: the line it sticks at, not the layout.
    const resized = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        relayout();
      } else if (sticky) {
        top = parseFloat(getComputedStyle(sticky).top) || 0;
        schedule();
      }
    };
    // Focus brought a card into view: bring the page to where the scroll would have put it.
    const followed = (event: Event) => {
      if (!track || event.target !== track || Math.abs(track.scrollLeft - written) <= 2) return;
      const want = top - track.scrollLeft;
      const now = host.getBoundingClientRect().top + lead;
      written = Math.round(track.scrollLeft);
      window.scrollBy({ top: now - want, behavior: 'instant' });
    };

    api.current = layout;
    layout();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resized);
    window.addEventListener(MOTION_EVENT, relayout);
    host.addEventListener('scroll', followed, { capture: true, passive: true });
    tiers.addEventListener('change', relayout);
    reduce.addEventListener('change', relayout);
    document.fonts?.ready.then(relayout).catch(() => {});
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resized);
      window.removeEventListener(MOTION_EVENT, relayout);
      host.removeEventListener('scroll', followed, { capture: true });
      tiers.removeEventListener('change', relayout);
      reduce.removeEventListener('change', relayout);
      if (frameId) window.cancelAnimationFrame(frameId);
      if (layoutId) window.cancelAnimationFrame(layoutId);
      api.current = null;
      release();
    };
  }, [query]);

  // The counter and line exist once the part they sit in is known: lay out again with them in place.
  useEffect(() => {
    if (frame && (counter || line)) api.current?.();
  }, [frame, total, counter, line]);

  return (
    <>
      <div ref={runRef} className="he-pin-run" aria-hidden="true" />
      {frame &&
        (counter || line) &&
        createPortal(
          <div ref={progressRef} className="he-pin__progress" aria-hidden="true">
            {counter && (
              <div className="he-pin__count">
                <span ref={countRef}>01</span>
                <span className="he-pin__total"> / {pad(total)}</span>
              </div>
            )}
            {line && (
              <span className="he-pin__line">
                <span ref={fillRef} className="he-pin__fill" />
              </span>
            )}
          </div>,
          frame,
        )}
    </>
  );
}
