import { FIGURE_LABELS } from '@/lib/blocks';
import { figureStyleProperties, type FigureStyle } from '@/lib/figureStyle';

/**
 * Sources converging on one outcome.
 *
 * The last label is what everything meets at; every label before it is a
 * source. Two sources was the mockup and is still what three labels give, so
 * a page that has not been touched draws exactly what it always did — but the
 * geometry is worked out rather than typed, so a fourth or fifth source is a
 * label rather than a rewrite. It used to be two hardcoded curves and two
 * hardcoded boxes, and adding a third name simply did nothing.
 *
 * Colours and sizes are custom properties with the drawn-in values as
 * fallbacks (see `lib/figureStyle.ts`), applied as CSS properties rather than
 * SVG attributes because an attribute cannot hold a `var()`.
 */

/** The band the sources are spread across, matching the original two rows. */
const TOP = 60;
const BOTTOM = 240;
const MIN_SPACING = 60;

export function ConvergeFigure({ labels = [], style }: { labels?: string[]; style?: FigureStyle }) {
  const words = labels.filter((l) => l.trim() !== '');
  const used = words.length >= 2 ? words : [...FIGURE_LABELS.converge];

  const target = used[used.length - 1]!;
  const sources = used.slice(0, -1);
  const count = sources.length;

  /* Evenly spread, keeping the original spacing for two and growing the
     drawing rather than crowding the boxes once they would overlap. */
  const even = count > 1 ? (BOTTOM - TOP) / (count - 1) : 0;
  const spacing = count > 1 ? Math.max(even, MIN_SPACING) : 0;
  const height = Math.max(300, (count - 1) * spacing + 120);
  const centre = height / 2;
  const first = centre - ((count - 1) * spacing) / 2;
  const rowY = (i: number) => first + i * spacing;

  return (
    <svg
      viewBox={`0 0 420 ${height}`}
      width="100%"
      role="img"
      aria-label={`${sources.join(', ')} converging on ${target}`}
      style={{ display: 'block', overflow: 'visible', ...figureStyleProperties(style) }}
    >
      {/* One rule per row, plus the centre. An odd number of sources puts one
          of them level with the destination, so the two would be drawn on top
          of each other — twice the ink on one line, and visibly darker. */}
      <g style={{ stroke: 'var(--he-fig-grid, var(--color-hairline))', strokeWidth: 1 }}>
        <path d={`M105 0v${height}M315 0v${height}`} />
        {[...new Set([centre, ...sources.map((_, i) => rowY(i))])].map((y) => (
          <path key={y} d={`M0 ${y}h420`} />
        ))}
      </g>

      <g
        fill="none"
        style={{
          stroke: 'var(--he-fig-line, var(--color-flare))',
          strokeWidth: 'var(--he-fig-border, 2px)',
        }}
        strokeDasharray="6 7"
        className="animate-dash"
      >
        {sources.map((_, i) => (
          <path key={i} d={`M148 ${rowY(i)} C 182 ${rowY(i)}, 176 ${centre}, 210 ${centre}`} />
        ))}
      </g>

      <g
        fill="none"
        style={{
          stroke: 'var(--he-fig-source-border, var(--color-bone))',
          strokeWidth: 'var(--he-fig-border, 2px)',
        }}
      >
        {sources.map((_, i) => (
          <rect key={i} x="16" y={rowY(i) - 18} width="128" height="36" style={{ rx: 'var(--he-fig-radius, 0)' } as React.CSSProperties} />
        ))}
      </g>

      {sources.map((label, i) => (
        <text
          key={i}
          x="28"
          y={rowY(i) + 4.5}
          style={{
            fill: 'var(--he-fig-source-text, var(--color-bone))',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--he-fig-source-size, 10px)',
            letterSpacing: '1.2px',
          }}
        >
          {label}
        </text>
      ))}

      <rect
        x="210"
        y={centre - 24}
        width="150"
        height="48"
        style={{ fill: 'var(--he-fig-target-bg, var(--color-flare))', rx: 'var(--he-fig-radius, 0)' } as React.CSSProperties}
      />
      <text
        x="226"
        y={centre + 6}
        style={{
          fill: 'var(--he-fig-target-text, var(--color-ink))',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'var(--he-fig-target-size, 17px)',
        }}
      >
        {target}
      </text>

      <g style={{ fill: 'var(--he-fig-line, var(--color-flare))' }}>
        <circle cx="210" cy={centre} r="4" />
        {sources.map((_, i) => (
          <circle
            key={i}
            cx="16"
            cy={rowY(i)}
            r="4"
            className="animate-pulse-dot"
            /* Staggered rather than a fixed pair of delays, so the rhythm
               survives a third and fourth source. Inline because a Tailwind
               arbitrary value cannot be built at runtime. */
            style={{ animationDelay: `${((i * 0.9) / Math.max(1, count - 1)).toFixed(2)}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
