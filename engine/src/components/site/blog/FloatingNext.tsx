'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/ui/SiteLink';
import { Icon } from '@/components/site/icons';

type Target = { title: string; href: string } | null;

const DISMISSED = 'he-next-dismissed';

/**
 * The "up next" card in the corner of a post (T19, 2.18): the next post's
 * title, arrows to either neighbour, and a close button that is remembered
 * for the visit. It appears once the reader is a third of the way down, so
 * it never covers the opening, and it is hidden on phones, where the corner
 * is the content.
 */
export function FloatingNext({ next, previous, labels }: { next: Target; previous: Target; labels: { upNext: string; previous: string; next: string; dismiss: string } }) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISSED) === '1');
    } catch {
      setDismissed(false);
    }
    const check = () => setShown(window.scrollY > document.documentElement.scrollHeight * 0.33 - window.innerHeight);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, []);

  const target = next ?? previous;
  if (!target || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED, '1');
    } catch {
      /* Closed for this page, then. */
    }
  };

  return (
    <aside className={shown ? 'he-upnext is-shown' : 'he-upnext'} aria-label={labels.upNext} aria-hidden={shown ? undefined : true}>
      <p className="he-upnext__label">{next ? labels.upNext : labels.previous}</p>
      <Link href={target.href} className="he-upnext__title" tabIndex={shown ? undefined : -1}>
        {target.title}
      </Link>
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
      <button type="button" className="he-upnext__close" onClick={dismiss} aria-label={labels.dismiss} tabIndex={shown ? undefined : -1}>
        <Icon.Close size={14} />
      </button>
    </aside>
  );
}
