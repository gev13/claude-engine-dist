'use client';

import { useId } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { CORNERS, CORNER_LABELS, type Corner, type CornerShape, DEFAULT_CUT_CORNERS, LEAF_MAX } from '@/lib/shape';

/**
 * Rounded, cut (2.21) or leaf (3.29 — rounded on the chosen corners only) — one control for Appearance → Shape, a
 * block's Design tab and a card's own style. Writes `undefined` once it is
 * back to rounded with nothing else set, so an untouched setting stays unset.
 */
export function CornerShapeFields({
  label,
  value,
  onChange,
  fallbackSize,
  leafSize = 48,
  roundedLabel = 'Rounded — as the design draws it',
}: {
  label: string;
  value: CornerShape | undefined;
  onChange: (next: CornerShape | undefined) => void;
  /** The cut used when no size is given, shown as the placeholder. */
  fallbackSize: number;
  /** The leaf radius used when no size is given. */
  leafSize?: number;
  roundedLabel?: string;
}) {
  const id = useId();
  const shape = value ?? {};
  const cut = shape.style === 'cut';
  const leaf = shape.style === 'leaf';
  const max = leaf ? LEAF_MAX : 96;
  const corners = new Set<Corner>(shape.corners?.length ? shape.corners : DEFAULT_CUT_CORNERS);

  const update = (patch: Partial<CornerShape>) => {
    const next: CornerShape = { ...shape, ...patch };
    if (next.style !== 'cut' && next.style !== 'leaf') {
      onChange(undefined);
      return;
    }
    for (const key of Object.keys(next) as (keyof CornerShape)[]) if (next[key] === undefined) delete next[key];
    onChange(next);
  };
  const toggle = (corner: Corner) => {
    const set = new Set(corners);
    if (set.has(corner)) set.delete(corner);
    else set.add(corner);
    if (set.size === 0) return; // at least one corner, or it is not a cut or a leaf
    const list = CORNERS.filter((c) => set.has(c));
    update({ corners: list.length === 2 && list[0] === 'tr' && list[1] === 'bl' ? undefined : list });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={label} htmlFor={`${id}-style`}>
          <Select
            id={`${id}-style`}
            value={cut ? 'cut' : leaf ? 'leaf' : 'rounded'}
            onChange={(e) => {
              const style = e.target.value === 'cut' ? 'cut' : e.target.value === 'leaf' ? 'leaf' : undefined;
              // A cut's legs stop at 96; a leaf's radius means something else, so a size does not carry over.
              update({ style, size: undefined });
            }}
          >
            <option value="rounded">{roundedLabel}</option>
            <option value="cut">Cut on the diagonal</option>
            <option value="leaf">Rounded on chosen corners only</option>
          </Select>
        </Field>
        {(cut || leaf) && (
          <Field label={leaf ? 'Radius' : 'Cut'} hint={leaf ? 'px, the chosen corners' : 'px along each edge'} htmlFor={`${id}-size`}>
            <Input
              id={`${id}-size`}
              type="number"
              min={0}
              max={max}
              placeholder={String(leaf ? leafSize : fallbackSize)}
              value={shape.size ?? ''}
              onChange={(e) => update({ size: e.target.value === '' ? undefined : Math.min(max, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            />
          </Field>
        )}
      </div>
      {(cut || leaf) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label={`${label}: which corners`}>
          {CORNERS.map((corner) => (
            <label key={corner} className="flex items-center gap-1.5 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={corners.has(corner)} onChange={() => toggle(corner)} />
              {CORNER_LABELS[corner]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
