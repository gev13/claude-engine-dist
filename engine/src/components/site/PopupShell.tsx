'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/components/site/icons';
import { type PopupSettings, dueAgain, popupOnPage } from '@/lib/popups';
import { cn } from '@/lib/utils';

/**
 * The browser half of a popup (P3-D): decides when it opens, and remembers
 * when it was closed.
 *
 * It is a native <dialog>. Centred and full-screen popups open as modals, so
 * focus stays inside and Escape closes them; corners, bars and the side panel
 * open without trapping focus, and Escape closes them too. A link to
 * `#popup-<slug>` always opens it, wherever the link is and however often it
 * has been seen — the visitor asked. Automatic triggers respect the pages,
 * the devices and the frequency it was given.
 */
export function PopupShell({ popup, children }: { popup: PopupSettings; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  const modal = popup.position === 'center' || popup.position === 'fullscreen';
  const key = `he-popup:${popup.id}`;

  const storage = useCallback(() => (popup.frequency === 'session' ? window.sessionStorage : window.localStorage), [popup.frequency]);

  const open = useCallback(
    (asked: boolean) => {
      const dialog = ref.current;
      if (!dialog || dialog.open) return;
      if (modal) dialog.showModal();
      else {
        dialog.show();
        // A popup someone asked for takes focus; one that arrived by itself does not steal it.
        if (asked) dialog.querySelector<HTMLElement>('.he-popup__close')?.focus();
      }
    },
    [modal],
  );

  // Links to #popup-<slug>, anywhere on the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target?.closest(`a[href="#popup-${popup.slug}"], [data-popup="${popup.slug}"]`)) return;
      e.preventDefault();
      open(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, popup.slug]);

  // The automatic triggers.
  useEffect(() => {
    if (popup.trigger === 'click' || !popupOnPage(popup, path)) return;
    if (popup.devices !== 'all' && !window.matchMedia(popup.devices === 'mobile' ? '(width <= 48rem)' : '(width > 48rem)').matches) return;
    let last: number | null = null;
    try {
      const raw = storage().getItem(key);
      last = raw ? Number(raw) : null;
    } catch {
      // Storage switched off: treat it as never seen.
    }
    if (!dueAgain(popup.frequency, popup.days, last, Date.now())) return;

    if (popup.trigger === 'delay') {
      const timer = window.setTimeout(() => open(false), popup.delay * 1000);
      return () => window.clearTimeout(timer);
    }
    if (popup.trigger === 'scroll') {
      const onScroll = () => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        if (room > 0 && (window.scrollY / room) * 100 < popup.scroll) return;
        open(false);
        window.removeEventListener('scroll', onScroll);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
    // Exit intent: the pointer leaves through the top of the window. Touch screens never fire it.
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      open(false);
      document.removeEventListener('mouseout', onOut);
    };
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, [path, popup, open, key, storage]);

  // Escape closes a popup that is not a modal as well.
  useEffect(() => {
    if (modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) ref.current.close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);

  const remember = () => {
    if (popup.frequency === 'always') return;
    try {
      storage().setItem(key, String(Date.now()));
    } catch {
      // Storage switched off: it may show again, which is the safe way to fail.
    }
  };

  return (
    <dialog
      ref={ref}
      className={cn('he-popup', `is-${popup.position}`, `is-${popup.size}`, modal && popup.overlay && 'has-overlay')}
      aria-label={popup.name}
      onClose={remember}
      onClick={(e) => {
        // A click on the dimmed page (the dialog itself, outside its content) closes it.
        if (modal && popup.overlay && e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="he-popup__body he-nested">{children}</div>
      <button type="button" className="he-popup__close" aria-label="Close" onClick={() => ref.current?.close()}>
        <Icon.Close size={18} />
      </button>
    </dialog>
  );
}
