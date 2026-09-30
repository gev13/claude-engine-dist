import { cn } from '@/lib/utils';

/* The heading block's picked-out words (P3-B1), shared since 3.22 with the hero's title. */

/** P3-B1 — hand-drawn marks, in a 200×60 box stretched over the words. */
const DRAWN: Record<string, string> = {
  circle: 'M100 5C45 3 5 15 7 31s55 25 106 24 88-12 86-28S150 3 88 8',
  curly: 'M2 50q8-10 16 0t16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0 16 0',
  strike: 'M2 34L198 28',
  zigzag: 'M2 52L14 42 26 52 38 42 50 52 62 42 74 52 86 42 98 52 110 42 122 52 134 42 146 52 158 42 170 52 182 42 194 52',
  double: 'M2 46H198M8 55H192',
};

export function withHighlight(title: string, highlight: string | undefined, style: string) {
  if (!highlight) return title;
  const at = title.indexOf(highlight);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <mark className={cn('he-mark', `is-${style}`)}>
        {highlight}
        {DRAWN[style] && (
          <svg className="he-mark__draw" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={DRAWN[style]} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </mark>
      {title.slice(at + highlight.length)}
    </>
  );
}
