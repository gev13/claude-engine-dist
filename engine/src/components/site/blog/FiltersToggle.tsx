'use client';

/**
 * 3.28 — phones: a "Filters" button that opens the archive bar's end (the
 * count and the categories) as a panel under it. Shown by CSS on phones only,
 * and only when Appearance → Blog → Details asks for it; the bar itself is
 * the server's.
 */
export function FiltersToggle({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="he-blogbar__filters he-cbtn is-outline is-small"
      aria-expanded="false"
      onClick={(event) => {
        const button = event.currentTarget;
        const open = button.closest('.he-blogbar')?.classList.toggle('is-open') ?? false;
        button.setAttribute('aria-expanded', String(open));
      }}
    >
      {label}
    </button>
  );
}
