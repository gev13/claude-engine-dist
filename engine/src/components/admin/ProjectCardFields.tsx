'use client';

import { useId } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { ColorField } from '@/components/admin/styleFields';
import type { ProjectCardOptions } from '@/lib/projectCard';

/**
 * 3.24 — how each project card is drawn: one set of controls for the projects
 * block and the project archives. Writes `undefined` once nothing is set, so
 * an untouched list stays untouched.
 */
export function ProjectCardFields({ value, onChange }: { value: ProjectCardOptions | undefined; onChange: (next: ProjectCardOptions | undefined) => void }) {
  const id = useId();
  const card = value ?? {};
  const update = (patch: Partial<ProjectCardOptions>) => {
    const next: Record<string, unknown> = { ...card, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === '') delete next[key];
    onChange(Object.keys(next).length ? (next as ProjectCardOptions) : undefined);
  };
  const number = (raw: string, min: number, max: number, integer = true) => {
    const n = Number(raw);
    if (raw === '' || Number.isNaN(n) || (integer && !Number.isInteger(n))) return undefined;
    return Math.min(max, Math.max(min, n));
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Picture shape" htmlFor={`${id}-ratio`}>
          <Select id={`${id}-ratio`} value={card.ratio ?? ''} onChange={(e) => update({ ratio: (e.target.value || undefined) as ProjectCardOptions['ratio'] })}>
            <option value="">The layout’s own</option>
            <option value="1/1">Square</option>
            <option value="4/3">4:3</option>
            <option value="3/2">3:2</option>
            <option value="16/9">16:9</option>
            <option value="3/4">Portrait 3:4</option>
            <option value="auto">Each file’s own shape</option>
          </Select>
        </Field>
        <Field label="Picture corners" hint="px; empty is the site’s cards" htmlFor={`${id}-radius`}>
          <Input id={`${id}-radius`} type="number" min={0} max={48} value={card.radius ?? ''} onChange={(e) => update({ radius: number(e.target.value, 0, 48) })} />
        </Field>
        <Field label="Zoom on hover" hint="e.g. 1.06; empty is 1.05" htmlFor={`${id}-zoom`}>
          <Input id={`${id}-zoom`} type="number" min={1} max={1.3} step={0.01} value={card.zoom ?? ''} onChange={(e) => update({ zoom: number(e.target.value, 1, 1.3, false) })} />
        </Field>
        <Field label="Categories" htmlFor={`${id}-cats`}>
          <Select id={`${id}-cats`} value={card.categoryStyle ?? 'chips'} onChange={(e) => update({ categoryStyle: e.target.value === 'plain' ? 'plain' : undefined })}>
            <option value="chips">Chips (as before)</option>
            <option value="plain">Plain text</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ash">
        <input type="checkbox" className="h-4 w-4 accent-flare" checked={card.reveal === 'link'} onChange={(e) => update({ reveal: e.target.checked ? 'link' : undefined })} />
        On hover, the category line slides away and a link line slides in
      </label>
      {card.reveal === 'link' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Its words" hint="empty is the Site translation “View project”" htmlFor={`${id}-label`}>
            <Input id={`${id}-label`} maxLength={40} value={card.revealLabel ?? ''} onChange={(e) => update({ revealLabel: e.target.value || undefined })} />
          </Field>
          <ColorField label="Its colour" placeholder="the accent" value={card.revealColor} onChange={(v) => update({ revealColor: v || undefined })} />
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={card.revealLine !== false} onChange={(e) => update({ revealLine: e.target.checked ? undefined : false })} />
            A short line after the words
          </label>
        </div>
      )}
    </div>
  );
}
