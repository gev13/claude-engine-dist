'use client';

import { useState } from 'react';
import { BOX_SIDES, type SpacingBox } from '@/lib/blockStyle';
import { isEmptyItemStyle, type ItemStyle } from '@/lib/itemStyle';
import { ChoiceField, ColorField, LengthField } from './styleFields';
import { CornerShapeFields } from './CornerShapeFields';
import { Field, Input } from './ui';

/* ═══════════════════════════════════════════════════════════════════════════
   One item's own look
   ───────────────────────────────────────────────────────────────────────────
   The Design tab dresses a whole section; this dresses one card in it. Folded
   away until it is opened, because a list of eight cards with a styling panel
   open under each one is unusable — and the overwhelming majority of cards
   are never styled individually.

   The summary line matters more than it looks: with the panel closed, an
   editor has to be able to tell which card in a list of eight is the one
   carrying a colour, without opening all eight.
   ═══════════════════════════════════════════════════════════════════════════ */

export function ItemStylePanel({
  value,
  onChange,
}: {
  value: ItemStyle | undefined;
  onChange: (next: ItemStyle | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const style = value ?? {};
  const touched = !isEmptyItemStyle(value);

  /** Writing `undefined` back when the last field is cleared keeps the block tidy. */
  const set = <K extends keyof ItemStyle>(key: K) => (next: ItemStyle[K]) => {
    const merged = { ...style, [key]: next } as ItemStyle;
    onChange(isEmptyItemStyle(merged) ? undefined : merged);
  };

  const setSide = (side: keyof SpacingBox) => (next: string | undefined) => {
    const spacing = { ...(style.spacing ?? {}), [side]: next };
    const merged = { ...style, spacing } as ItemStyle;
    onChange(isEmptyItemStyle(merged) ? undefined : merged);
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
          This card&rsquo;s own look
          {touched && <span className="ml-2 text-flare">set</span>}
        </span>
        <span>{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              label="Background"
              value={style.background}
              placeholder="the card's own"
              onChange={set('background')}
            />
            <ColorField
              label="Text"
              hint="the heading too, so a dark tile stays readable"
              value={style.color}
              placeholder="the card's own"
              onChange={set('color')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {BOX_SIDES.map(([key, label]) => (
              <LengthField
                key={key}
                label={label}
                value={style.spacing?.[key]}
                emptyLabel="none"
                onChange={setSide(key)}
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <LengthField label="Border" value={style.borderWidth} emptyLabel="none" onChange={set('borderWidth')} />
            <ChoiceField
              label="Border style"
              value={style.borderStyle}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' },
                { value: 'double', label: 'Double' },
                { value: 'none', label: 'None' },
              ]}
              onChange={set('borderStyle')}
            />
            <ColorField label="Border colour" value={style.borderColor} placeholder="none" onChange={set('borderColor')} />
            <LengthField label="Corner radius" value={style.radius} emptyLabel="none" onChange={set('radius')} />
          </div>

          <CornerShapeFields label="Corners" value={style.corners} fallbackSize={20} roundedLabel="As the site’s cards are" onChange={set('corners')} />

          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceField
              label="Text alignment"
              value={style.align}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={set('align')}
            />
            <LengthField label="Text inset" hint="image cards: the text this much further in than the picture" value={style.textInset} emptyLabel="none" onChange={set('textInset')} />
            <Field label="CSS class" hint="to aim your own CSS at this card">
              <Input
                value={style.className ?? ''}
                placeholder="none"
                spellCheck={false}
                onChange={(e) => set('className')(e.target.value.trim() || undefined)}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
