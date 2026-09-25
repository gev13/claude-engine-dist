'use client';

import Link from '@/components/ui/SiteLink';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';

type P = z.output<(typeof blockSchemas)['subNav']>;

/**
 * HD3 — a sticky bar for the product or section the page is about.
 *
 * It sticks under the header when the header is sticky and to the top of the
 * screen otherwise (the stylesheet reads that off the header). In-page links
 * (#anchors) light up as their section scrolls past; page links light up on
 * their own page. On phones the links fold into a "Name ⌄" dropdown.
 */
export function SubNav(p: P) {
  const pathname = usePathname();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string | null>(null);

  useEffect(() => {
    const targets = p.links
      .filter((l) => l.href.startsWith('#') && l.href.length > 1)
      .map((l) => document.getElementById(decodeURIComponent(l.href.slice(1))))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActiveHash(`#${entry.target.id}`);
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [p.links]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isCurrent = (href: string) => (href.startsWith('#') ? href === activeHash : href === pathname);

  return (
    <nav className="he-subnav" aria-label={`${p.name} sections`}>
      <div className="shell he-subnav__bar">
        <span className="he-subnav__name">{p.name}</span>
        <button
          type="button"
          className="he-subnav__toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {p.name}
          <Icon.Chevron dir={open ? 'up' : 'down'} size={16} />
        </button>
        <ul id={listId} className={cn('he-subnav__links', open && 'is-open')}>
          {p.links.map((l, i) => (
            <li key={l.href + i}>
              <Link href={l.href} aria-current={isCurrent(l.href) ? 'true' : undefined} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        {p.cta && (
          <Button href={p.cta.href} className="he-subnav__cta">
            {p.cta.label}
          </Button>
        )}
      </div>
    </nav>
  );
}
