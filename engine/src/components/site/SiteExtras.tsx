'use client';

import Link from '@/components/ui/SiteLink';
import { useEffect, useId, useState } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { type NavChild, linkAttrs } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Icon } from './icons';

/* Small site-wide features (GL1, GL3, GL5, GL6, FT4's share chip) and the one
   footer control that needs state. Each reads its saved state after mount, so
   the server render and the first client render always agree. */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the choice lasts for this page only */
  }
}

/** GL3 — stops sliders, marquees and reveals for this visitor. */
export function MotionToggle() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => setReduced(document.documentElement.classList.contains('he-reduce-motion')), []);

  function toggle() {
    const next = !reduced;
    document.documentElement.classList.toggle('he-reduce-motion', next);
    write('he-motion', next ? 'reduce' : null);
    setReduced(next);
    window.dispatchEvent(new Event(MOTION_EVENT));
  }

  return (
    <button type="button" role="switch" aria-checked={reduced} onClick={toggle} className="he-switch">
      <span className="he-switch__track" aria-hidden="true">
        <span className="he-switch__thumb" />
      </span>
      Reduce motion
    </button>
  );
}

/** GL6 — swaps to the alternate palette saved in Appearance. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [alt, setAlt] = useState(false);

  useEffect(() => setAlt(document.documentElement.getAttribute('data-scheme') === 'alt'), []);

  function toggle() {
    const next = !alt;
    if (next) document.documentElement.setAttribute('data-scheme', 'alt');
    else document.documentElement.removeAttribute('data-scheme');
    write('he-scheme', next ? 'alt' : null);
    setAlt(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={alt}
      className={cn('he-scheme-toggle', compact && 'is-compact')}
      aria-label={compact ? 'Switch colour scheme' : undefined}
    >
      {alt ? <Icon.Sun size={16} /> : <Icon.Moon size={16} />}
      {!compact && <span>{alt ? 'Default colours' : 'Alternate colours'}</span>}
    </button>
  );
}

/** GL1 — appears once the page has scrolled well past the first screen. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      className={cn('he-totop', visible && 'is-visible')}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={() => window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' })}
    >
      <Icon.ArrowUp size={16} />
      <span>Back to top</span>
    </button>
  );
}

/** GL5 — offers another regional or language version of the site. */
export function RegionBar({
  message,
  buttonLabel,
  options,
}: {
  message: string;
  buttonLabel: string;
  options: { label: string; href: string }[];
}) {
  const key = `he-region:${message}`;
  const [hidden, setHidden] = useState(false);
  const [choice, setChoice] = useState(options[0]?.href ?? '');
  const id = useId();

  useEffect(() => setHidden(read(key) === '1'), [key]);

  if (hidden) return null;

  return (
    <div className="he-region" role="region" aria-label="Choose your region">
      <div className="he-region__inner">
        <p className="he-region__msg">{message}</p>
        {options.length > 0 && (
          <form
            className="he-region__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (choice) window.location.assign(choice);
            }}
          >
            <label htmlFor={id} className="sr-only">
              Region
            </label>
            <select id={id} value={choice} onChange={(e) => setChoice(e.target.value)} className="he-region__select">
              {options.map((o) => (
                <option key={o.href} value={o.href}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="submit" className="he-btn he-btn-primary he-region__go">
              {buttonLabel}
            </button>
          </form>
        )}
        <button
          type="button"
          className="he-region__close"
          aria-label="Dismiss"
          onClick={() => {
            write(key, '1');
            setHidden(true);
          }}
        >
          <Icon.Close size={18} />
        </button>
      </div>
    </div>
  );
}

/** FT4 option — shares the current page. Built client-side from its own URL. */
export function ShareChip() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
    setTitle(document.title);
  }, []);

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const targets = [
    { label: 'Share on X', href: `https://x.com/intent/post?url=${u}&text=${t}`, network: 'x' as const },
    { label: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, network: 'linkedin' as const },
    { label: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, network: 'facebook' as const },
  ];

  return (
    <div className="he-share">
      <span className="he-share__label">
        <Icon.Share size={14} />
        Share this page
      </span>
      {targets.map((s) => (
        <a key={s.network} href={url ? s.href : '#'} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="he-share__link">
          <ShareGlyph network={s.network} />
        </a>
      ))}
      <a href={url ? `mailto:?subject=${t}&body=${u}` : '#'} aria-label="Share by email" className="he-share__link">
        <Icon.Mail size={15} />
      </a>
    </div>
  );
}

/** The three share targets' marks, matching the footer's social icons. */
function ShareGlyph({ network }: { network: 'x' | 'linkedin' | 'facebook' }) {
  const paths = {
    x: 'M5 4l14 16M19 4L5 20',
    linkedin: 'M8 10.5V17M8 7.2v.1M12 17v-3.8a2.3 2.3 0 0 1 4.6 0V17M12 10.5V17',
    facebook: 'M14.5 3.5h-2a4 4 0 0 0-4 4v3h-2.5v3.5h2.5v6.5h3.5V14h2.8l.7-3.5h-3.5V8a1 1 0 0 1 1-1h2.5z',
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[network]} />
    </svg>
  );
}

/**
 * A footer link column. On desktop the heading is just a heading; below
 * 768px it becomes the button that opens the column, so a long footer
 * collapses into a short list of headings on a phone.
 */
export function FooterColumn({ title, items }: { title: string; items: NavChild[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={cn('he-ftr__col', open && 'is-open')}>
      <h2 className="he-ftr__coltitle">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="he-ftr__coltoggle">
          {title}
          <Icon.Chevron size={16} className="he-ftr__colchev" />
        </button>
      </h2>
      <ul id={id} className="he-ftr__links">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} {...linkAttrs(item)}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
