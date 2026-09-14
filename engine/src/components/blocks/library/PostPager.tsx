'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * V6 — shows a post list a few at a time, without touching the URL. Reading a
 * search parameter would make every visit to an ISR page dynamic, so the
 * server renders the whole list once and this only chooses what is visible.
 *
 * Focus moves to the first post that appears, so a keyboard user is not left
 * on a button that just vanished or scrolled away. It happens in an effect,
 * after React has committed the new posts, never on a timer.
 */
export function PostPager({
  items,
  perPage,
  mode,
  className,
  style,
}: {
  items: React.ReactNode[];
  perPage: number;
  mode: 'more' | 'pages';
  className: string;
  style?: React.CSSProperties;
}) {
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(perPage);
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<{ index: number; scroll: boolean } | null>(null);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const visible = mode === 'more' ? items.slice(0, shown) : items.slice(page * perPage, page * perPage + perPage);

  useEffect(() => {
    const target = pendingFocus.current;
    const list = listRef.current;
    if (!target || !list) return;
    pendingFocus.current = null;
    if (target.scroll && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
    list.querySelectorAll<HTMLElement>('a')[target.index]?.focus({ preventScroll: !target.scroll });
  }, [page, shown]);

  const goTo = (next: number) => {
    pendingFocus.current = { index: 0, scroll: true };
    setPage(next);
  };

  const showMore = () => {
    pendingFocus.current = { index: shown, scroll: false };
    setShown((n) => Math.min(items.length, n + perPage));
  };

  return (
    <>
      <ul ref={listRef} className={className} style={style}>
        {visible}
      </ul>
      {mode === 'more' && shown < items.length && (
        <div className="he-pager">
          <button type="button" className="he-cbtn is-outline is-medium" onClick={showMore}>
            Show more<span className="sr-only"> posts</span>
          </button>
        </div>
      )}
      {mode === 'pages' && pages > 1 && (
        <nav className="he-pager" aria-label="Pages">
          <button type="button" className="he-pager__btn" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="Previous page">
            ‹
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className="he-pager__btn"
              aria-label={`Page ${i + 1}`}
              aria-current={i === page ? 'page' : undefined}
              onClick={() => goTo(i)}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className="he-pager__btn" onClick={() => goTo(page + 1)} disabled={page === pages - 1} aria-label="Next page">
            ›
          </button>
        </nav>
      )}
    </>
  );
}
