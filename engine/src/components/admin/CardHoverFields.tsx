'use client';

import { useId } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { CARD_HOVERS, CARD_HOVER_LABELS, type CardHover, type CardHoverEffect, TILT_DEFAULTS } from '@/lib/cardHover';

/**
 * How each card answers the pointer (T33, 2.19) — one set of controls for
 * the post list block, Appearance → Blog and the projects block. Writes
 * `undefined` once nothing is set, so an untouched list stays untouched.
 */
export function CardHoverFields({
  value,
  onChange,
  zoom = true,
}: {
  value: CardHover | undefined;
  onChange: (next: CardHover | undefined) => void;
  /** The projects block has its own picture hover, so it leaves this out. */
  zoom?: boolean;
}) {
  const id = useId();
  const hover = value ?? {};
  const update = (patch: Partial<CardHover>) => {
    const next: Record<string, unknown> = { ...hover, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    if (next.effect !== 'tilt') {
      delete next.perspective;
      delete next.maxAngle;
      delete next.glare;
    }
    onChange(Object.keys(next).length ? (next as CardHover) : undefined);
  };
  const number = (raw: string, min: number, max: number) => {
    const n = Number(raw);
    return raw === '' || !Number.isInteger(n) ? undefined : Math.min(max, Math.max(min, n));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="On hover, each card" hint="a mouse only; still for anyone who asks for less motion" htmlFor={`${id}-effect`}>
        <Select
          id={`${id}-effect`}
          value={hover.effect ?? 'none'}
          onChange={(e) => update({ effect: e.target.value === 'none' ? undefined : (e.target.value as CardHoverEffect) })}
        >
          {CARD_HOVERS.map((effect) => (
            <option key={effect} value={effect}>
              {CARD_HOVER_LABELS[effect]}
            </option>
          ))}
        </Select>
      </Field>
      {zoom && (
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ash">
          <input type="checkbox" className="h-4 w-4 accent-flare" checked={hover.zoom === true} onChange={(e) => update({ zoom: e.target.checked || undefined })} />
          The picture zooms in
        </label>
      )}
      {hover.effect === 'tilt' && (
        <>
          <Field label="Perspective" hint="px — smaller leans more steeply" htmlFor={`${id}-persp`}>
            <Input
              id={`${id}-persp`}
              type="number"
              min={300}
              max={8000}
              step={100}
              placeholder={String(TILT_DEFAULTS.perspective)}
              value={hover.perspective ?? ''}
              onChange={(e) => update({ perspective: number(e.target.value, 300, 8000) })}
            />
          </Field>
          <Field label="Most it leans" hint="degrees" htmlFor={`${id}-angle`}>
            <Input
              id={`${id}-angle`}
              type="number"
              min={1}
              max={25}
              placeholder={String(TILT_DEFAULTS.maxAngle)}
              value={hover.maxAngle ?? ''}
              onChange={(e) => update({ maxAngle: number(e.target.value, 1, 25) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={hover.glare === true} onChange={(e) => update({ glare: e.target.checked || undefined })} />
            A glare that follows the pointer
          </label>
        </>
      )}
    </div>
  );
}
