import Link from '@/components/ui/SiteLink';
import { LoadMore } from './LoadMore';

/* ═══════════════════════════════════════════════════════════════════════════
   Pages of an archive, as real links (T2, 2.13)
   ───────────────────────────────────────────────────────────────────────────
   Every page is its own address — `/blog/page/2` — rendered on the server, so
   the links work with no script at all and a crawler reaches every post.
   "Load more" is the same next-page link with a script on top that fetches
   that page and appends its posts; without the script it is a link to page 2.
   The look is the client-side pager's (`.he-pager`), so a site that switches
   from one to the other sees no second design.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PaginationLabels = {
  nav: string;
  previous: string;
  next: string;
  page: (n: number) => string;
  loadMore: string;
  loading: string;
};

/** Page numbers to show: the first, the last, and two either side of the current one. */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export function Pagination({
  current,
  total,
  href,
  style = 'numbers',
  labels,
  listId,
}: {
  current: number;
  total: number;
  href: (n: number) => string;
  style?: 'numbers' | 'prevNext' | 'loadMore';
  labels: PaginationLabels;
  /** The list a "Load more" appends to. */
  listId?: string;
}) {
  if (total <= 1) return null;

  if (style === 'loadMore') {
    if (current >= total) return null;
    return (
      <div className="he-pager">
        <LoadMore href={href(current + 1)} listId={listId} label={labels.loadMore} loadingLabel={labels.loading} />
      </div>
    );
  }

  return (
    <nav className="he-pager" aria-label={labels.nav}>
      {current > 1 ? (
        <Link href={href(current - 1)} className="he-pager__btn" rel="prev" aria-label={labels.previous}>
          ‹
        </Link>
      ) : (
        <span className="he-pager__btn" aria-hidden="true" data-disabled="">
          ‹
        </span>
      )}
      {style === 'numbers' &&
        pageWindow(current, total).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} className="he-pager__gap" aria-hidden="true">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              className="he-pager__btn"
              aria-label={labels.page(n)}
              aria-current={n === current ? 'page' : undefined}
            >
              {n}
            </Link>
          ),
        )}
      {current < total ? (
        <Link href={href(current + 1)} className="he-pager__btn" rel="next" aria-label={labels.next}>
          ›
        </Link>
      ) : (
        <span className="he-pager__btn" aria-hidden="true" data-disabled="">
          ›
        </span>
      )}
    </nav>
  );
}

/** "Showing 1–12 of 110 results". */
export function resultRange(current: number, perPage: number, count: number) {
  const from = count === 0 ? 0 : (current - 1) * perPage + 1;
  const to = Math.min(count, current * perPage);
  return { from, to, total: count };
}
