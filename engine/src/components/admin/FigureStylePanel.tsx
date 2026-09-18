'use client';

import { useState } from 'react';
import { isEmptyFigureStyle, type FigureStyle } from '@/lib/figureStyle';
import { ColorField, LengthField } from './styleFields';

/* ═══════════════════════════════════════════════════════════════════════════
   How the diagram is drawn
   ───────────────────────────────────────────────────────────────────────────
   Folded away, and marked when it has been used, for the same reason the
   per-card panel is: most diagrams are never restyled, and ten controls open
   under every figure block would bury the labels — which are the thing people
   actually come here to change.

   Empty means the drawn-in value, stated on every field rather than left to
   be discovered, because "inherit" would be wrong: these do not come from
   anywhere an editor can see.
   ═══════════════════════════════════════════════════════════════════════════ */

const DRAWN_IN = {
  lineColor: 'the accent',
  gridColor: 'the hairline',
  sourceBorder: 'the text colour',
  sourceText: 'the text colour',
  targetBackground: 'the accent',
  targetText: 'the page colour',
} as const;

export function FigureStylePanel({
  value,
  onChange,
}: {
  value: FigureStyle | undefined;
  onChange: (next: FigureStyle | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const style = value ?? {};
  const touched = !isEmptyFigureStyle(value);

  const set = <K extends keyof FigureStyle>(key: K) => (next: FigureStyle[K]) => {
    const merged = { ...style, [key]: next } as FigureStyle;
    onChange(isEmptyFigureStyle(merged) ? undefined : merged);
  };

  return (
    <div className="border-t-2 border-hairline pt-3">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between bg-transparent p-0 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone"
      >
        <span>
          How the diagram is drawn
          {touched && <span className="ml-2 text-flare">set</span>}
        </span>
        <span>{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Lines and joins" value={style.lineColor} placeholder={DRAWN_IN.lineColor} onChange={set('lineColor')} />
            <ColorField label="Background grid" value={style.gridColor} placeholder={DRAWN_IN.gridColor} onChange={set('gridColor')} />
            <ColorField label="Source outline" value={style.sourceBorder} placeholder={DRAWN_IN.sourceBorder} onChange={set('sourceBorder')} />
            <ColorField label="Source text" value={style.sourceText} placeholder={DRAWN_IN.sourceText} onChange={set('sourceText')} />
            <ColorField label="Destination fill" value={style.targetBackground} placeholder={DRAWN_IN.targetBackground} onChange={set('targetBackground')} />
            <ColorField label="Destination text" value={style.targetText} placeholder={DRAWN_IN.targetText} onChange={set('targetText')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <LengthField label="Source text size" value={style.sourceSize} emptyLabel="as drawn" onChange={set('sourceSize')} />
            <LengthField label="Destination size" value={style.targetSize} emptyLabel="as drawn" onChange={set('targetSize')} />
            <LengthField label="Line thickness" value={style.borderWidth} emptyLabel="2px" onChange={set('borderWidth')} />
            <LengthField label="Corner radius" value={style.radius} emptyLabel="square" onChange={set('radius')} />
          </div>

          <p className="m-0 text-[12px] leading-relaxed text-smoke">
            Space around the whole diagram is in this block&rsquo;s Design tab, with every other
            block&rsquo;s margins and padding.
          </p>
        </div>
      )}
    </div>
  );
}
