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
  font?: 'label' | 'body' | 'display';
  case?: 'label' | 'upper' | 'none';
  size?: number;
  weight?: string;
  separator?: 'none' | 'slash' | 'dot';
  position?: 'center' | 'bottom';
  orientation?: 'stacked' | 'row';
  /** 3.23 — which social links, in this order; unset is every one. */
  networks?: string[];
};

/** 3.22 — the rails' own type, as properties their rules read; nothing for what was left unset. */
const FACES = { body: 'var(--he-body-family)', display: 'var(--font-display)' } as const;
function railStyle(rails: Rails): React.CSSProperties {
  return {
    ...(rails.font && rails.font !== 'label' ? { '--he-rail-family': FACES[rails.font] } : {}),
    ...(rails.case && rails.case !== 'label' ? { '--he-rail-transform': rails.case === 'upper' ? 'uppercase' : 'none', '--he-rail-tracking': rails.case === 'upper' ? '0.14em' : '0' } : {}),
    ...(rails.size ? { '--he-rail-size': `${Math.max(8, Math.min(24, rails.size))}px` } : {}),
    ...(rails.weight ? { '--he-rail-weight': rails.weight } : {}),
  } as React.CSSProperties;
}

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
  // 3.23 — only the networks chosen for the rail, in the order chosen.
  const links = rails.networks ? rails.networks.flatMap((network) => social.filter((link) => link.network === network)) : social;
  const style = { '--he-rails-min': `${rails.minWidth}px`, ...railStyle(rails) } as React.CSSProperties;
  // 3.22 — a width of their own to appear from; the stylesheet's is 1181px.
  const min = Math.round(rails.minWidth);
  const ownWidth = Number.isInteger(min) && min >= 768 && min <= 2560 && min !== 1181;
  const cls = (side: 'left' | 'right') =>
    [
      'he-rail',
      `is-${side}`,
      shown && 'is-shown',
      rails.autoContrast && 'is-contrast',
      ownWidth && 'has-min',
      rails.position === 'bottom' && 'is-bottom',
      rails.orientation === 'row' && 'is-row',
    ]
      .filter(Boolean)
      .join(' ');
  const separator = rails.separator === 'slash' ? '/' : rails.separator === 'dot' ? '·' : null;

  return (
    <>
      {ownWidth && <style>{`@media (width >= ${min}px){.he-rail.has-min{display:flex}}@media (width < ${min}px){.he-rail.has-min{display:none}}`}</style>}
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
      {rails.socialSide !== 'none' && links.length > 0 && (
        <div className={cls(rails.socialSide)} style={style}>
          <p className="he-rail__text">{rails.socialLabel}</p>
          <ul className={separator ? 'he-rail__social has-sep' : 'he-rail__social'}>
            {links.map((link, i) => (
              <li key={link.network + link.href}>
                {separator && i > 0 && (
                  <span className="he-rail__sep" aria-hidden="true">
                    {separator}
                  </span>
                )}
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
