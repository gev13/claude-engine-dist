'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SocialIcon } from '@/components/site/icons';
import { SOCIAL_LABELS, opensElsewhere, socialText, type SocialLabelStyle, type SocialLink } from '@/lib/navigation';

/* ═══════════════════════════════════════════════════════════════════════════
   Site-wide extras that need the browser (T29, T30 — 2.19)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The reveal footer's switch. The effect is CSS — the footer sticks to the
 * bottom beneath the page, which lifts off it — but it only makes sense
 * while the footer fits: taller than four-fifths of the screen, it would
 * sit stuck with its top hidden. So this measures, on load and on resize,
 * and marks the page only when it fits (and, unless asked, not on phones).
 */
export function RevealFooter({ onMobile }: { onMobile: boolean }) {
  useEffect(() => {
    const site = document.querySelector<HTMLElement>('.he-site');
    const footer = document.querySelector<HTMLElement>('.he-ftr-wrap');
    if (!site || !footer) return;
    const decide = () => {
      const phone = window.matchMedia('(width <= 48rem)').matches;
      const fits = footer.offsetHeight <= window.innerHeight * 0.8;
      site.classList.toggle('has-reveal', fits && (onMobile || !phone));
    };
    decide();
    const observer = new ResizeObserver(decide);
    observer.observe(footer);
    window.addEventListener('resize', decide);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', decide);
      site.classList.remove('has-reveal');
    };
  }, [onMobile]);
  return null;
}

type Rails = {
  scrollSide: 'left' | 'right' | 'none';
  scrollLabel: string;
  socialSide: 'left' | 'right' | 'none';
  socialLabel: string;
  afterFirstScreen: boolean;
  autoContrast: boolean;
  hideOn: string[];
  minWidth: number;
};

const hiddenOn = (patterns: string[], path: string) =>
  patterns.some((pattern) => (pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path.replace(/\/+$/, '') === pattern.replace(/\/+$/, '')));

/**
 * The side rails (T30): "Scroll to top" written up the edge with a bar that
 * fills as the page is read, and the site's social links down the other
 * side. Wide screens only; off the pages listed; optionally only once the
 * reader is a screen down. With auto contrast they invert against whatever
 * is behind them, so they read over a light section as over a dark one.
 */
export function SideRails({ rails, social, socialStyle }: { rails: Rails; social: SocialLink[]; socialStyle: SocialLabelStyle }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(!rails.afterFirstScreen);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      if (rails.afterFirstScreen) setShown(window.scrollY > window.innerHeight * 0.9);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [rails.afterFirstScreen, pathname]);

  if (hiddenOn(rails.hideOn, pathname)) return null;
  const style = { '--he-rails-min': `${rails.minWidth}px` } as React.CSSProperties;
  const cls = (side: 'left' | 'right') => `he-rail is-${side}${shown ? ' is-shown' : ''}${rails.autoContrast ? ' is-contrast' : ''}`;

  return (
    <>
      {rails.scrollSide !== 'none' && (
        <div className={cls(rails.scrollSide)} style={style}>
          <button
            type="button"
            className="he-rail__top"
            onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          >
            <span className="he-rail__text">{rails.scrollLabel}</span>
            <span className="he-rail__bar" aria-hidden="true">
              <span style={{ transform: `scaleY(${progress})` }} />
            </span>
          </button>
        </div>
      )}
      {rails.socialSide !== 'none' && social.length > 0 && (
        <div className={cls(rails.socialSide)} style={style}>
          <p className="he-rail__text">{rails.socialLabel}</p>
          <ul className="he-rail__social">
            {social.map((link) => (
              <li key={link.network + link.href}>
                <a href={link.href} {...(opensElsewhere(link) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} aria-label={SOCIAL_LABELS[link.network]}>
                  {socialText(link, socialStyle === 'icon' ? 'short' : socialStyle) ?? <SocialIcon network={link.network} size={16} />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
