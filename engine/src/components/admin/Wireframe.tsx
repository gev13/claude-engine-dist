import type { Shape } from '@/lib/wireframes';
import { cn } from '@/lib/utils';

/* Draws a wireframe from src/lib/wireframes.ts as SVG elements — React
   elements, never an HTML string. Colours come from the admin's own tokens,
   so the thumbnails follow its palette. */

const C = {
  ground: 'var(--color-surface)',
  img: 'var(--color-rule)',
  img2: 'var(--color-hairline)',
  panel: 'var(--color-surface-2)',
  soft: 'var(--color-hairline)',
  dark: 'var(--color-ink)',
  accent: 'var(--color-flare)',
  line: 'var(--color-smoke)',
  lightLine: 'var(--color-ash)',
  ink: 'var(--color-bone)',
  onAccent: 'var(--color-ink)',
} as const;

const FILL: Record<string, string> = { img: C.img, img2: C.img2, panel: C.panel, soft: C.soft, dark: C.dark };

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const lineTone = (t?: string) => (t === 'lt' ? C.lightLine : t === 'on' ? C.onAccent : t === 'ink' ? C.ink : C.line);
const strokeTone = (t?: string) => (t === 'lt' ? C.lightLine : C.ink);

function draw(shape: Shape, key: number): React.ReactNode {
  const [kind, ...a] = shape;

  switch (kind) {
    case 'img':
    case 'panel':
    case 'soft':
    case 'dark': {
      const flag = str(a[5]);
      return (
        <rect
          key={key}
          x={num(a[0])}
          y={num(a[1])}
          width={num(a[2])}
          height={num(a[3])}
          rx={num(a[4])}
          fill={flag === 'alt' ? C.img2 : FILL[kind as string]}
          opacity={flag === 'dim' ? 0.4 : undefined}
          stroke={flag === 'b' ? C.soft : undefined}
          strokeWidth={flag === 'b' ? 0.5 : undefined}
        />
      );
    }
    case 'acc':
      return <rect key={key} x={num(a[0])} y={num(a[1])} width={num(a[2])} height={num(a[3])} rx={num(a[4])} fill={C.accent} />;
    case 'accline':
      return (
        <rect
          key={key}
          x={num(a[0])}
          y={num(a[1])}
          width={num(a[2])}
          height={num(a[3])}
          rx={num(a[4])}
          fill="none"
          stroke={C.accent}
          strokeWidth={0.7}
          strokeDasharray="2 1.5"
        />
      );
    case 'ink':
      return <rect key={key} x={num(a[0])} y={num(a[1])} width={num(a[2])} height={num(a[3])} rx={0.8} fill={str(a[4]) === 'lt' ? C.lightLine : C.ink} />;
    case 'wline':
      return <rect key={key} x={num(a[0])} y={num(a[1])} width={num(a[2])} height={0.35} fill={C.line} />;
    case 'txt': {
      const [x, y, w, n, gap] = [num(a[0]), num(a[1]), num(a[2]), num(a[3], 1), num(a[4], 3.2)];
      return (
        <g key={key}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={x} y={y + i * gap} width={i === n - 1 && n > 1 ? w * 0.7 : w} height={1.3} rx={0.65} fill={lineTone(str(a[5]))} />
          ))}
        </g>
      );
    }
    case 'big': {
      const [x, y, w, n] = [num(a[0]), num(a[1]), num(a[2]), num(a[3], 1)];
      const t = str(a[4]);
      return (
        <g key={key}>
          {Array.from({ length: n }, (_, i) => {
            const width = i === n - 1 && n > 1 ? w * 0.72 : w;
            const yy = y + i * 5.2;
            if (t === 'half') {
              return (
                <g key={i}>
                  <rect x={x} y={yy} width={width} height={3.2} rx={1} fill={C.lightLine} opacity={0.35} />
                  <rect x={x} y={yy} width={width * 0.55} height={3.2} rx={1} fill={C.accent} />
                </g>
              );
            }
            const fill = t === 'acc' ? C.accent : t === 'lt' || t === 'dim' ? C.lightLine : C.ink;
            return <rect key={i} x={x} y={yy} width={width} height={3.2} rx={1} fill={fill} opacity={t === 'dim' ? 0.35 : undefined} />;
          })}
        </g>
      );
    }
    case 'btn':
      return <rect key={key} x={num(a[0])} y={num(a[1])} width={num(a[2])} height={5} rx={2.5} fill="none" stroke={C.accent} strokeWidth={0.8} />;
    case 'fbtn':
      return <rect key={key} x={num(a[0])} y={num(a[1])} width={num(a[2])} height={5} rx={2.5} fill={C.accent} />;
    case 'dots': {
      const [x, y, n, active] = [num(a[0]), num(a[1]), num(a[2]), num(a[3])];
      const vertical = str(a[4]) === 'v';
      return (
        <g key={key}>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={vertical ? x : x + i * 3.2} cy={vertical ? y + i * 3.2 : y} r={0.9} fill={i === active ? C.accent : C.line} />
          ))}
        </g>
      );
    }
    case 'circ': {
      const t = str(a[3]);
      return (
        <circle
          key={key}
          cx={num(a[0])}
          cy={num(a[1])}
          r={num(a[2])}
          fill="none"
          stroke={t === 'acc' ? C.accent : strokeTone(t)}
          strokeWidth={t === 'acc' ? 0.7 : 0.6}
        />
      );
    }
    case 'chev': {
      const [x, y] = [num(a[0]), num(a[1])];
      const s = 1.1;
      const points = {
        l: [[x + s / 2, y - s], [x - s / 2, y], [x + s / 2, y + s]],
        r: [[x - s / 2, y - s], [x + s / 2, y], [x - s / 2, y + s]],
        u: [[x - s, y + s / 2], [x, y - s / 2], [x + s, y + s / 2]],
        d: [[x - s, y - s / 2], [x, y + s / 2], [x + s, y - s / 2]],
      }[str(a[2]) as 'l' | 'r' | 'u' | 'd'];
      if (!points) return null;
      return <polyline key={key} points={points.map((p) => p.join(',')).join(' ')} fill="none" stroke={strokeTone(str(a[3]))} strokeWidth={0.6} />;
    }
    case 'burger': {
      const [x, y] = [num(a[0]), num(a[1])];
      const fill = strokeTone(str(a[2]));
      return (
        <g key={key}>
          {[0, 2, 4].map((d) => (
            <rect key={d} x={x} y={y + d} width={5.5} height={0.6} fill={fill} />
          ))}
        </g>
      );
    }
    case 'pause': {
      const [x, y] = [num(a[0]), num(a[1])];
      return (
        <g key={key}>
          <rect x={x - 1} y={y - 1.1} width={0.6} height={2.2} fill={C.ink} />
          <rect x={x + 0.4} y={y - 1.1} width={0.6} height={2.2} fill={C.ink} />
        </g>
      );
    }
    case 'poly': {
      const points = str(a[0]);
      if (!points || !/^[\d.,\s-]+$/.test(points)) return null;
      return <polygon key={key} points={points} fill={FILL[str(a[1]) ?? 'img'] ?? C.img} />;
    }
    case 'sw': {
      const [x, y, n] = [num(a[0]), num(a[1]), num(a[2])];
      return (
        <g key={key}>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={x + i * 7} cy={y} r={2.2} fill={i % 2 ? C.img2 : C.ink} opacity={1 - i * 0.12} />
          ))}
          <circle cx={x} cy={y} r={3.2} fill="none" stroke={C.accent} strokeWidth={0.6} />
        </g>
      );
    }
    case 'lbl': {
      const anchor = str(a[3]) ?? 'start';
      const t = str(a[4]);
      return (
        <text
          key={key}
          x={num(a[0])}
          y={num(a[1])}
          fontFamily="var(--font-mono), monospace"
          fontSize={3.6}
          textAnchor={anchor === 'middle' || anchor === 'end' ? anchor : 'start'}
          fill={t === 'lt' ? C.lightLine : t === 'ink' ? C.ink : C.line}
        >
          {str(a[2]) ?? ''}
        </text>
      );
    }
    case 'g': {
      const inner = Array.isArray(a[1]) ? (a[1] as Shape[]) : [];
      return (
        <g key={key} opacity={num(a[0], 1)}>
          {inner.map(draw)}
        </g>
      );
    }
    default:
      return null;
  }
}

/**
 * A wireframe thumbnail. Pass `label` when the picture is the only thing
 * describing the choice; leave it out when a visible caption does, and the
 * SVG is hidden from screen readers.
 */
export function Wireframe({
  shapes,
  width = 160,
  label,
  className,
}: {
  shapes: readonly Shape[];
  width?: 160 | 50;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} 100`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-auto w-full', className)}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <rect width={width} height={100} fill={C.ground} />
      {shapes.map(draw)}
    </svg>
  );
}
