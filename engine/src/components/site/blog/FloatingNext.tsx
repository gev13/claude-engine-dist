'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/ui/SiteLink';
import { Icon } from '@/components/site/icons';
import { cn } from '@/lib/utils';
import type { ResolvedBlog } from '@/lib/blog';

type Target = { title: string; href: string } | null;

const DISMISSED = 'he-next-dismissed';

/**
 * The "up next" card in the corner of a post (T19, 2.18): the next post's
 * title, arrows to either neighbour, and a close button that is remembered
 * for the visit. It appears once the reader is a third of the way down, so
 * it never covers the opening, and it is hidden on phones, where the corner
 * is the content.
 */
export function FloatingNext({
  next,
  previous,
  labels,
  phones = false,
  dismissKey,
  look,
}: {
  next: Target;
  previous: Target;
  labels: { upNext: string; previous: string; next: string; dismiss: string };
  /** 3.22 — shown on phones too. */
  phones?: boolean;
  /** 3.22 — closing it is remembered for this post only (its id), rather than for the whole visit. */
  dismissKey?: string;
  /** 3.28 — which neighbour, when it shows and hides, its controls and its look. */
  look?: ResolvedBlog['upNext'];
}) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const storageKey = dismissKey ? `${DISMISSED}:${dismissKey}` : DISMISSED;

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
    // 3.28 — from the start, and out of the way while the related posts are on screen.
    const related = look?.hideOverRelated ? document.querySelector('.he-related') : null;
    const check = () => {
      const past = look?.from === 'start' || window.scrollY > document.documentElement.scrollHeight * 0.33 - window.innerHeight;
      const box = related?.getBoundingClientRect();
      const overRelated = Boolean(box && box.top < window.innerHeight && box.bottom > 0);
      setShown(past && !overRelated);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [storageKey, look?.from, look?.hideOverRelated]);

  // 3.28 — `newer`: the newer post only, so the newest post shows none.
  const target = look?.pick === 'newer' ? next : (next ?? previous);
  if (!target || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* Closed for this page, then. */
    }
  };

  return (
    <aside
      className={cn('he-upnext', shown && 'is-shown', phones && 'on-phones', look?.close === false && 'no-close', look?.titleSize && 'has-title-size', look?.titleWeight && 'has-title-weight')}
      aria-label={labels.upNext}
      aria-hidden={shown ? undefined : true}
      style={
        look && (look.width || look.background || typeof look.radius === 'number' || look.titleSize || look.titleWeight)
          ? ({
              ...(look.width ? { width: `min(${look.width}px, calc(100vw - 40px))` } : {}),
              ...(look.background ? { background: look.background } : {}),
              ...(typeof look.radius === 'number' ? { borderRadius: `${look.radius}px` } : {}),
              ...(look.titleSize ? { '--he-upnext-title-size': look.titleSize } : {}),
              ...(look.titleWeight ? { '--he-upnext-title-weight': look.titleWeight } : {}),
            } as React.CSSProperties)
          : undefined
      }
    >
      <p className="he-upnext__label">{target === next ? labels.upNext : labels.previous}</p>
      <Link href={target.href} className="he-upnext__title" tabIndex={shown ? undefined : -1}>
        {target.title}
      </Link>
      {look?.arrows !== false && (
      <div className="he-upnext__nav">
        {previous && (
          <Link href={previous.href} aria-label={`${labels.previous}: ${previous.title}`} tabIndex={shown ? undefined : -1}>
            <Icon.ArrowRight size={16} className="he-upnext__back" />
          </Link>
        )}
        {next && (
          <Link href={next.href} aria-label={`${labels.next}: ${next.title}`} tabIndex={shown ? undefined : -1}>
            <Icon.ArrowRight size={16} />
          </Link>
        )}
      </div>
      )}
      {look?.close !== false && (
        <button type="button" className="he-upnext__close" onClick={dismiss} aria-label={labels.dismiss} tabIndex={shown ? undefined : -1}>
          <Icon.Close size={14} />
        </button>
      )}
    </aside>
  );
}
