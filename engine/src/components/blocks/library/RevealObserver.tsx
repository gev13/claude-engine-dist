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
export function armReveals(): () => void {
  const root = document.documentElement;
  const sections = [...document.querySelectorAll<HTMLElement>('.he-reveal')];

  if (motionReduced() || !('IntersectionObserver' in window)) {
    root.classList.remove('he-reveal-on');
    sections.forEach((el) => el.classList.add('is-in'));
    return () => {};
  }

  const fold = viewportHeight() * 0.95;
  sections.forEach((el) => {
    if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
  });
  root.classList.add('he-reveal-on');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // P3-C1 — a delay holds the entrance back a moment; anything already on screen never waits.
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay) || 0;
        if (delay > 0) window.setTimeout(() => el.classList.add('is-in'), delay);
        else el.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    // Threshold 0: a section taller than the screen still reveals.
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  sections.filter((el) => !el.classList.contains('is-in')).forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

/** The window's height, or the document's where a hidden frame reports none. */
const viewportHeight = () => window.innerHeight || document.documentElement.clientHeight || 800;

/** Rendered once per page, and only when some block on it asks for an entrance. */
export function RevealObserver() {
  useEffect(() => {
    let stop = armReveals();
    const rearm = () => {
      stop();
      stop = armReveals();
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
export function SiteReveal({ effect }: { effect: string }) {
  const path = usePathname();

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const cls = `he-reveal--${effect}`;

    const tag = () => {
      const fold = viewportHeight() * 0.95;
      for (const el of main.children) {
        if (!(el instanceof HTMLElement) || SKIP.has(el.tagName)) continue;
        if (el.classList.contains('he-reveal') || el.classList.contains('he-noreveal')) continue;
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
  }, [path, effect]);

  return null;
}
