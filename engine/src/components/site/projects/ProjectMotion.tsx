'use client';

import { useEffect } from 'react';
import { motionReduced } from '@/lib/motion';

/**
 * 3.28 — a round "back" button that returns to the page the visitor came
 * from, or to `href` when there is none (a page opened on its own). Its
 * caption slides in when pointed at (library-showcase.css).
 */
export function ProjectBack({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="he-prj-back"
      onClick={(event) => {
        const sameSite = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (!sameSite || window.history.length < 2) return;
        event.preventDefault();
        window.history.back();
      }}
    >
      <span className="he-prj-back__circle" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </span>
      <span className="he-prj-back__label">{label}</span>
    </a>
  );
}

/**
 * 3.28 — the hero picture grows from 1 to 1.05 over the first 400px of
 * scrolling: a custom property on the hero, so the page never re-renders;
 * still for anyone who asks for less motion.
 */
export function HeroZoom() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.he-prj-hero');
    if (!hero) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const scale = motionReduced() ? 1 : 1 + Math.min(Math.max(window.scrollY, 0), 400) / 400 * 0.05;
      hero.style.setProperty('--he-zoom', scale.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
    };
  }, []);
  return null;
}
