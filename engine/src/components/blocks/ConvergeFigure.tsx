import { FIGURE_LABELS } from '@/lib/blocks';
/**
 * The hero diagram from Home.html: two sources converging on one outcome.
 *
 * Labels come from the block's `figureLabels` — source, second source, and the
 * destination they meet at — so the diagram is editable rather than three
 * strings buried in a component. The mockup's wording is the default, so a
 * page that sets nothing renders exactly what it always did.
 *
 * Colours are theme custom properties, not literals: a diagram that stayed
 * brand-red after somebody changed the accent colour would be a bug, and an
 * obvious one.
 */
export function ConvergeFigure({ labels = [] }: { labels?: string[] }) {
  const [fallbackSource, fallbackSecond, fallbackTarget] = FIGURE_LABELS.converge;
  const [source = fallbackSource, second = fallbackSecond, target = fallbackTarget] = labels;

  return (
    <svg
      viewBox="0 0 420 300"
      width="100%"
      role="img"
      aria-label={`${source} and ${second} converging on ${target}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g stroke="var(--color-hairline)" strokeWidth="1">
        <path d="M0 60h420M0 150h420M0 240h420M105 0v300M315 0v300" />
      </g>
      <g
        fill="none"
        stroke="var(--color-flare)"
        strokeWidth="2"
        strokeDasharray="6 7"
        className="animate-dash"
      >
        <path d="M148 60 C 182 60, 176 150, 210 150" />
        <path d="M148 240 C 182 240, 176 150, 210 150" />
      </g>
      <g fill="none" stroke="var(--color-bone)" strokeWidth="2">
        <rect x="16" y="42" width="128" height="36" />
        <rect x="16" y="222" width="128" height="36" />
      </g>
      <text
        x="28"
        y="64.5"
        fill="var(--color-bone)"
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="1.2"
      >
        {source}
      </text>
      <text
        x="28"
        y="244.5"
        fill="var(--color-bone)"
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="1.2"
      >
        {second}
      </text>
      <rect x="210" y="126" width="150" height="48" fill="var(--color-flare)" />
      <text
        x="226"
        y="156"
        fill="var(--color-ink)"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize="17"
      >
        {target}
      </text>
      <g fill="var(--color-flare)">
        <circle cx="210" cy="150" r="4" />
        <circle cx="16" cy="60" r="4" className="animate-pulse-dot" />
        <circle cx="16" cy="240" r="4" className="animate-pulse-dot [animation-delay:0.9s]" />
      </g>
    </svg>
  );
}
