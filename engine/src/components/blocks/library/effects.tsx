import type { BlockStyle, DIVIDER_SHAPES } from '@/lib/blockStyle';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   P3-C3 — shape dividers
   ───────────────────────────────────────────────────────────────────────────
   Drawn over a block's top or bottom edge in the neighbouring section's
   colour, so the edge between two sections becomes a wave, a curve or a
   point. Each path fills a 1200×120 box from the top; the bottom edge is the
   same drawing turned upside down. Decorative, so hidden from screen readers.
   ═══════════════════════════════════════════════════════════════════════════ */

type Kind = (typeof DIVIDER_SHAPES)[number];

const zigzag = (() => {
  let d = 'M0 0H1200V40';
  for (let x = 1150, up = false; x >= 0; x -= 50, up = !up) d += `L${x} ${up ? 40 : 90}`;
  return `${d}Z`;
})();

const PATHS: Record<Kind, string> = {
  wave: 'M0 0H1200V56C1000 16 800 96 600 48S200 0 0 64Z',
  curve: 'M0 0H1200V36Q600 160 0 36Z',
  tilt: 'M0 0H1200L0 110Z',
  triangle: 'M0 0H1200L600 110Z',
  zigzag,
  arrow: 'M0 0H1200V30H640L600 92 560 30H0Z',
};

function Shape({ edge, shape }: { edge: 'top' | 'bottom'; shape: NonNullable<BlockStyle['shapeTop']> }) {
  return (
    <div
      className={cn('he-shape', `is-${edge}`, `is-${shape.height ?? 'medium'}`, shape.flip && 'is-flip')}
      style={shape.color ? { color: shape.color } : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" focusable="false">
        <path d={PATHS[shape.kind]} fill="currentColor" />
      </svg>
    </div>
  );
}

export function ShapeDividers({ style }: { style: BlockStyle }) {
  return (
    <>
      {style.shapeTop && <Shape edge="top" shape={style.shapeTop} />}
      {style.shapeBottom && <Shape edge="bottom" shape={style.shapeBottom} />}
    </>
  );
}
