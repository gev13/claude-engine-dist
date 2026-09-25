/**
 * The arrow after a "Read more" (2.22). One element with one class, so the
 * theme can draw it as it is or in a small circle (Appearance → Buttons →
 * Read more links) wherever a card, a post or a row links on.
 */
export function MoreIcon({ size = 14 }: { size?: number }) {
  return (
    <svg className="he-more__icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
