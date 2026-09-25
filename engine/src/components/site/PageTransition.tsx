'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motionReduced } from '@/lib/motion';

type Style = 'fadeUp' | 'fade' | 'slide' | 'curtain';

/** How long the old page takes to leave, per style, in ms (scaled by the site's motion setting in CSS). */
const LEAVE_MS: Record<Style, number> = { fadeUp: 250, fade: 200, slide: 260, curtain: 420 };

/**
 * How one page gives way to the next (T28, 2.19).
 *
 * No wrapper: it adds classes to `<main>` — which keeps "the hero is main's
 * first child", the rule the over-hero header depends on. A click on a link
 * to another page on this site plays the leaving half, then navigates; the
 * arriving page plays the entering half. Everything else is left alone: a
 * link to a place on the same page, a new tab, a download, a modified
 * click, another site, the back and forward buttons. The first load is
 * never animated (the preloader, if chosen, covers that), and a visitor who
 * asked for less motion gets none of it. The content is in the HTML
 * whatever happens, so nothing here delays a crawler.
 */
export function PageTransition({ style }: { style: Style }) {
  const pathname = usePathname();
  const router = useRouter();
  const first = useRef(true);
  const leaving = useRef(false);

  // The arriving half, on every path change but the first.
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    main.classList.remove('he-page-leave');
    document.documentElement.classList.remove('he-curtain-leave');
    leaving.current = false;
    if (first.current) {
      first.current = false;
      return;
    }
    if (motionReduced()) return;
    main.classList.remove('he-page-enter');
    void main.offsetWidth; // restart the animation
    main.classList.add('he-page-enter');
    document.documentElement.classList.add('he-curtain-enter');
    const done = window.setTimeout(() => {
      main.classList.remove('he-page-enter');
      document.documentElement.classList.remove('he-curtain-enter');
    }, 900);
    return () => window.clearTimeout(done);
  }, [pathname]);

  // The leaving half, on a click that would load another page of this site.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.closest('[data-no-transition]')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // an anchor, or this page again
      if (/^\/(admin|api|media)(\/|$)/.test(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      if (motionReduced() || leaving.current) return;

      const main = document.getElementById('main');
      if (!main) return;
      // preventDefault alone: Next's Link then stands aside (it checks), and
      // every other handler on the link — a menu closing, a tracked click — still runs.
      event.preventDefault();
      leaving.current = true;
      main.classList.add('he-page-leave');
      if (style === 'curtain') document.documentElement.classList.add('he-curtain-leave');
      window.setTimeout(() => router.push(url.pathname + url.search + url.hash), LEAVE_MS[style]);
    };
    // Back from the cache with the leaving class still on: undo it.
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      document.getElementById('main')?.classList.remove('he-page-leave', 'he-page-enter');
      document.documentElement.classList.remove('he-curtain-leave', 'he-curtain-enter');
      leaving.current = false;
    };
    // Capture, not bubble: Next's <Link> calls preventDefault in React's own
    // click handler, which runs before a bubbling document listener — so
    // every site link looked "already handled" and nothing ever left. Taking
    // the click first also means the Link, seeing it prevented, waits for the leave.
    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('pageshow', onShow);
    };
  }, [router, style]);

  return style === 'curtain' ? <div className="he-curtain" aria-hidden="true" /> : null;
}

/**
 * The site's mark over the page on the very first load of a visit (2.19),
 * gone when the page has loaded — and after a second and a half whatever
 * happens, by CSS alone, so a slow script can never leave it up. Later loads
 * in the same visit, and a visitor who asked for less motion, never see it:
 * a line of script marks `<html>` before paint (which already expects its
 * class to change), and the stylesheet hides it — the node itself is left
 * alone, so hydration finds what the server wrote.
 */
export function Preloader({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hide = () => setDone(true);
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide, { once: true });
    const cap = window.setTimeout(hide, 1500);
    return () => {
      window.clearTimeout(cap);
      window.removeEventListener('load', hide);
    };
  }, []);
  return (
    <div className={done ? 'he-preloader is-done' : 'he-preloader'} aria-hidden="true">
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var d=document.documentElement;if(sessionStorage.getItem('he-pre')||matchMedia('(prefers-reduced-motion: reduce)').matches||d.classList.contains('he-reduce-motion')){d.classList.add('he-pre-skip')}else{sessionStorage.setItem('he-pre','1')}}catch(e){}",
        }}
      />
      <div className="he-preloader__mark">{children}</div>
    </div>
  );
}
