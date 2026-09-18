import { figureStyleProperties, type FigureStyle } from '@/lib/figureStyle';
/**
 * The service-hero figure: a stack of labelled surfaces with the last one —
 * the highest-value target — picked out in the brand red, and a scanning
 * bracket running down the side.
 *
 * The mockups draw a bespoke diagram per service. This is the shared form
 * behind them, driven by each page's own labels so the figure stays editable
 * from the admin panel rather than being ten hand-drawn SVGs in the codebase.
 */
export function LayersFigure({ labels, style }: { labels: string[]; style?: FigureStyle }) {
  const rows = labels.slice(0, 5);
  if (rows.length === 0) return null;

  const rowHeight = 50;
  const barHeight = 34;
  const top = 26;
  const height = top + rows.length * rowHeight + 10;
  const lastIndex = rows.length - 1;

  return (
    <svg
      viewBox={`0 0 400 ${height}`}
      width="100%"
      role="img"
      aria-label={`Layers: ${rows.join(', ')}.`}
      style={{ display: 'block', overflow: 'visible', ...figureStyleProperties(style) }}
    >
      {/* Background rule grid, matching the mockups' graph-paper motif. */}
      <g style={{ stroke: 'var(--he-fig-grid, var(--color-hairline))', strokeWidth: 1 }}>
        {rows.map((_, i) => (
          <path key={`h${i}`} d={`M0 ${40 + i * rowHeight}h400`} />
        ))}
        <path d={`M100 0v${height}M200 0v${height}M300 0v${height}`} />
      </g>

      {rows.map((label, i) => {
        const y = top + i * rowHeight;
        const isLast = i === lastIndex;
        return isLast ? (
          <g key={label + i}>
            <rect x="40" y={y} width="300" height={barHeight + 4} style={{ fill: 'var(--he-fig-target-bg, var(--color-flare))', rx: 'var(--he-fig-radius, 0)' } as React.CSSProperties} />
            <text
              x="52"
              y={y + 23}
              style={{
                fill: 'var(--he-fig-target-text, var(--color-ink))',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--he-fig-target-size, 9.5px)',
                letterSpacing: '1.1px',
              }}
            >
              {label}
            </text>
          </g>
        ) : (
          <g key={label + i}>
            <rect x="40" y={y} width="300" height={barHeight} fill="none" style={{ stroke: 'var(--he-fig-source-border, var(--color-bone))', strokeWidth: 'var(--he-fig-border, 2px)', rx: 'var(--he-fig-radius, 0)' } as React.CSSProperties} />
            <text
              x="52"
              y={y + 22}
              style={{
                fill: 'var(--he-fig-source-text, var(--color-bone))',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--he-fig-source-size, 9.5px)',
                letterSpacing: '1.1px',
              }}
            >
              {label}
            </text>
          </g>
        );
      })}

      <g fill="none" strokeDasharray="4 5" className="animate-dash" style={{ stroke: 'var(--he-fig-line, var(--color-flare))', strokeWidth: 'var(--he-fig-border, 2px)' }}>
        <path
          d={`M356 ${top + 17} L372 ${top + 17} L372 ${top + lastIndex * rowHeight + 19} L356 ${top + lastIndex * rowHeight + 19}`}
        />
      </g>
    </svg>
  );
}
