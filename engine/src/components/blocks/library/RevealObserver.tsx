'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';

/**
 * Arms the reveal-on-scroll option (SC4) for every `.he-reveal` on the page.
 *
 * Sections render visible. This runs only in a browser, only when motion is
 * allowed, and it marks everything already on screen as revealed before it
 * hides anything — so a thumbnail, a crawler, a print and a visitor who asked
 * for less motion all get the finished page. Returns what stops it.
 */
export function armReveals(parts = false): () => void {
  const root = document.documentElement;
  const sections = [...document.querySelectorAll<HTMLElement>('.he-reveal')];
  // 3.28 — a block whose parts enter one by one (armed by the blocks' own observer only).
  const stopParts = parts ? armBlockParts() : () => {};

  if (motionReduced() || !('IntersectionObserver' in window)) {
    root.classList.remove('he-reveal-on');
    sections.forEach((el) => el.classList.add('is-in'));
    return stopParts;
  }

  const fold = viewportHeight() * 0.95;
  sections.forEach((el) => {
    if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
  });
  root.classList.add('he-reveal-on');

  const { margin, replay } = entranceSettings();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (!entry.isIntersecting) {
          // 3.28 — plays again: gone below the screen, it waits to enter once more.
          if (replay && entry.boundingClientRect.top > (entry.rootBounds?.bottom ?? viewportHeight())) el.classList.remove('is-in');
          continue;
        }
        // P3-C1 — a delay holds the entrance back a moment; anything already on screen never waits.
        const delay = Number(el.dataset.revealDelay) || 0;
        if (delay > 0) window.setTimeout(() => el.classList.add('is-in'), delay);
        else el.classList.add('is-in');
        if (!replay) observer.unobserve(entry.target);
      }
    },
    // Threshold 0: a section taller than the screen still reveals.
    { rootMargin: margin ?? '0px 0px -8% 0px', threshold: 0 },
  );
  (replay ? sections : sections.filter((el) => !el.classList.contains('is-in'))).forEach((el) => observer.observe(el));
  return () => {
    observer.disconnect();
    stopParts();
  };
}

/**
 * 3.28 — Appearance → Motion: where on the screen an entrance starts (85 is
 * when its top reaches 85% of the screen's height) and whether it plays again
 * each time it comes back into view. Written on <html> only when set.
 */
function entranceSettings(): { margin?: string; replay: boolean } {
  const data = document.documentElement.dataset;
  const start = Number(data.revealStart);
  return {
    margin: start >= 50 && start <= 100 ? `0px 0px -${100 - start}% 0px` : undefined,
    replay: data.revealReplay === 'always',
  };
}

/** 3.28 — every block marked to bring its parts in one by one (`.he-reveal-items`). */
function armBlockParts(): () => void {
  const blocks = [...document.querySelectorAll<HTMLElement>('.he-reveal-items')];
  if (blocks.length === 0) return () => {};
  return armParts(() => blocks.map((block) => ({ section: block, effect: block.dataset.revealEffect || 'rise' })));
}

/** The window's height, or the document's where a hidden frame reports none. */
const viewportHeight = () => window.innerHeight || document.documentElement.clientHeight || 800;

/** Rendered once per page, and only when some block on it asks for an entrance. */
export function RevealObserver() {
  useEffect(() => {
    let stop = armReveals(true);
    const rearm = () => {
      stop();
      stop = armReveals(true);
    };
    window.addEventListener(MOTION_EVENT, rearm);
    return () => {
      stop();
      window.removeEventListener(MOTION_EVENT, rearm);
      document.documentElement.classList.remove('he-reveal-on');
    };
  }, []);

  return null;
}

/** What a section that is not a block's own content looks like to the site-wide entrance. */
const SKIP = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'LINK']);

/**
 * 3.5 — Appearance → Spacing and motion → "Every section enters with".
 *
 * Gives each top-level section in `#main` the chosen entrance unless it has
 * its own (`.he-reveal`) or asked to stay still (`.he-noreveal`). In the site
 * layout, so it covers every page and every section added later; it runs
 * again on each navigation and for sections that stream in afterwards. A
 * section already on screen is marked revealed as it is tagged, so nothing
 * in view ever blinks.
 */
export function SiteReveal({ effect, items = false }: { effect: string; items?: boolean }) {
  const path = usePathname();

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    if (items) return armItems(main, effect);
    const cls = `he-reveal--${effect}`;

    const tag = () => {
      const fold = viewportHeight() * 0.95;
      for (const el of main.children) {
        if (!(el instanceof HTMLElement) || SKIP.has(el.tagName)) continue;
        if (el.classList.contains('he-reveal') || el.classList.contains('he-noreveal') || el.classList.contains('he-reveal-items')) continue;
        if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
        el.classList.add('he-reveal', cls, 'he-reveal-site');
      }
    };

    tag();
    let stop = armReveals();
    const rearm = () => {
      stop();
      tag();
      stop = armReveals();
    };
    const added = new MutationObserver(rearm);
    added.observe(main, { childList: true });
    window.addEventListener(MOTION_EVENT, rearm);
    return () => {
      stop();
      added.disconnect();
      window.removeEventListener(MOTION_EVENT, rearm);
    };
  }, [path, effect, items]);

  return null;
}

/**
 * 3.16 — the parts of a section a visitor reads one at a time. The outermost
 * match wins, so a card enters as one piece and its title and text with it.
 */
const ITEMS = [
  '.he-eyebrow',
  'h1',
  'h2',
  '.he-intro',
  'p',
  'li',
  'figure',
  '.he-hero__visual',
  '.he-actions',
  '.he-hero__actions',
  '.he-btns',
  '.he-ucard',
  '.he-fgrid__item',
  '.he-mrows__item',
  '.he-bento__cell',
  '.he-figs__item',
  '.he-counter',
  '.he-stat',
  '.he-faq',
  '.he-fb__box',
].join(',');

/** How far apart parts that arrive together enter, and the longest wait. */
const STAGGER = 80;
const STAGGER_MAX = 480;

/**
 * Each part of each top-level section enters on its own as it scrolls into
 * view. A section with an entrance of its own (`.he-reveal`) or none
 * (`.he-noreveal`) is left alone. Parts on screen when the page opens are
 * shown at once and never animate; parts that come into view together
 * follow one another in reading order. The entrance is a keyframe animation
 * of `translate`/`scale`/`filter` (library-upgrades.css), so a card's own
 * `transform` and transitions (hover) are untouched.
 */
function armItems(main: HTMLElement, effect: string): () => void {
  const sections = () => {
    const list: { section: HTMLElement; effect: string }[] = [];
    for (const section of main.children) {
      if (!(section instanceof HTMLElement) || SKIP.has(section.tagName)) continue;
      if (section.classList.contains('he-reveal') || section.classList.contains('he-noreveal') || section.classList.contains('he-reveal-items')) continue;
      list.push({ section, effect });
    }
    return list;
  };
  const stop = armParts(sections);
  const added = new MutationObserver(() => {
    stop.retag();
  });
  added.observe(main, { childList: true });
  window.addEventListener(MOTION_EVENT, stop.retag);
  return () => {
    stop();
    added.disconnect();
    window.removeEventListener(MOTION_EVENT, stop.retag);
  };
}

/**
 * The parts of each given section, entering one by one as they scroll into
 * view (3.16 for every section, 3.28 for one block). Returns what stops it,
 * with `retag` to look again after the page changed.
 */
function armParts(sections: () => { section: HTMLElement; effect: string }[]): (() => void) & { retag: () => void } {
  let observer: IntersectionObserver | null = null;
  const root = document.documentElement;

  const tag = () => {
    observer?.disconnect();
    const found: { el: HTMLElement; effect: string }[] = [];
    for (const { section, effect } of sections()) {
      for (const el of section.querySelectorAll<HTMLElement>(ITEMS)) {
        // The outermost part only: a card's title enters with its card.
        if (el.parentElement?.closest(ITEMS) && section.contains(el.parentElement.closest(ITEMS))) continue;
        if (el.closest('.he-reveal')) continue;
        found.push({ el, effect });
      }
    }
    if (motionReduced() || !('IntersectionObserver' in window)) {
      root.classList.remove('he-reveal-on');
      found.forEach(({ el }) => el.classList.add('he-ri', 'is-in'));
      return;
    }
    const fold = viewportHeight() * 0.95;
    for (const { el, effect } of found) {
      el.classList.add('he-ri', `he-ri--${effect}`);
      if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
    }
    root.classList.add('he-reveal-on');
    const { margin, replay } = entranceSettings();
    observer = new IntersectionObserver(
      (entries) => {
        if (replay) {
          for (const entry of entries) {
            // 3.28 — gone below the screen, it waits to enter once more.
            if (!entry.isIntersecting && entry.boundingClientRect.top > (entry.rootBounds?.bottom ?? viewportHeight())) entry.target.classList.remove('is-in', 'is-anim');
          }
        }
        const arriving = entries
          .filter((entry) => entry.isIntersecting && !entry.target.classList.contains('is-anim'))
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        arriving.forEach((el, i) => {
          if (!replay) observer?.unobserve(el);
          window.setTimeout(() => el.classList.add('is-in', 'is-anim'), Math.min(i * STAGGER, STAGGER_MAX));
        });
      },
      { rootMargin: margin ?? '0px 0px -6% 0px', threshold: 0 },
    );
    found.filter(({ el }) => replay || !el.classList.contains('is-in')).forEach(({ el }) => observer!.observe(el));
  };

  tag();
  const stop = Object.assign(
    () => {
      observer?.disconnect();
      root.classList.remove('he-reveal-on');
    },
    { retag: tag },
  );
  return stop;
}
