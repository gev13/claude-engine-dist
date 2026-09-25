'use client';

import { useId } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { CORNERS, CORNER_LABELS, type Corner, type CornerShape, DEFAULT_CUT_CORNERS } from '@/lib/shape';

/**
 * Rounded or cut corners (2.21) — one control for Appearance → Shape, a
 * block's Design tab and a card's own style. Writes `undefined` once it is
 * back to rounded with nothing else set, so an untouched setting stays unset.
 */
export function CornerShapeFields({
  label,
  value,
  onChange,
  fallbackSize,
  roundedLabel = 'Rounded — as the design draws it',
}: {
  label: string;
  value: CornerShape | undefined;
  onChange: (next: CornerShape | undefined) => void;
  /** The cut used when no size is given, shown as the placeholder. */
  fallbackSize: number;
  roundedLabel?: string;
}) {
  const id = useId();
  const shape = value ?? {};
  const cut = shape.style === 'cut';
  const corners = new Set<Corner>(shape.corners?.length ? shape.corners : DEFAULT_CUT_CORNERS);

  const update = (patch: Partial<CornerShape>) => {
    const next: CornerShape = { ...shape, ...patch };
    if (next.style !== 'cut') {
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
    if (set.size === 0) return; // at least one corner, or it is not a cut
    const list = CORNERS.filter((c) => set.has(c));
    update({ corners: list.length === 2 && list[0] === 'tr' && list[1] === 'bl' ? undefined : list });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={label} htmlFor={`${id}-style`}>
          <Select id={`${id}-style`} value={cut ? 'cut' : 'rounded'} onChange={(e) => update({ style: e.target.value === 'cut' ? 'cut' : undefined })}>
            <option value="rounded">{roundedLabel}</option>
            <option value="cut">Cut on the diagonal</option>
          </Select>
        </Field>
        {cut && (
          <Field label="Cut" hint="px along each edge" htmlFor={`${id}-size`}>
            <Input
              id={`${id}-size`}
              type="number"
              min={0}
              max={96}
              placeholder={String(fallbackSize)}
              value={shape.size ?? ''}
              onChange={(e) => update({ size: e.target.value === '' ? undefined : Math.min(96, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
            />
          </Field>
        )}
      </div>
      {cut && (
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
