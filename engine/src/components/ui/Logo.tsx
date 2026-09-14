/**
 * The built-in mark: a neutral placeholder shown until a site uploads its own
 * logo in Appearance (`logoType: 'image'`). Deliberately generic — it takes
 * the accent colour from the theme and nothing else, so no site ships wearing
 * another site's identity.
 *
 * Decorative: wherever it appears the site name is beside it or on the
 * surrounding link, so it is hidden from assistive technology.
 */
export function SiteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block' }}
    >
      <rect x="1.5" y="1.5" width="29" height="29" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="9" y="9" width="14" height="14" style={{ fill: 'var(--color-flare)' }} />
    </svg>
  );
}

export function Wordmark({ size = 16, text }: { size?: number; text: string }) {
  return (
    <span
      className="whitespace-nowrap font-display font-extrabold tracking-[-0.01em]"
      style={{ fontSize: size }}
    >
      {text}
    </span>
  );
}
