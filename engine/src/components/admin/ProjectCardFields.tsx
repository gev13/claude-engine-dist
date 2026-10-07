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
      {/* 3.26 — the title's type, the category's size, the space under the picture, the gaps between cards. */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Title size" hint="e.g. 20px; empty is the layout’s" htmlFor={`${id}-tsize`}>
          <Input id={`${id}-tsize`} maxLength={40} value={card.titleSize ?? ''} placeholder="as drawn" onChange={(e) => update({ titleSize: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Title weight" htmlFor={`${id}-tweight`}>
          <Select id={`${id}-tweight`} value={card.titleWeight ?? ''} onChange={(e) => update({ titleWeight: (e.target.value || undefined) as ProjectCardOptions['titleWeight'] })}>
            <option value="">As drawn</option>
            {['300', '400', '500', '600', '700', '800'].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title letter spacing" hint="e.g. -0.03em" htmlFor={`${id}-ttrack`}>
          <Input id={`${id}-ttrack`} maxLength={20} value={card.titleTracking ?? ''} placeholder="as drawn" onChange={(e) => update({ titleTracking: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Category size" hint="e.g. 15px" htmlFor={`${id}-csize`}>
          <Input id={`${id}-csize`} maxLength={40} value={card.categorySize ?? ''} placeholder="as drawn" onChange={(e) => update({ categorySize: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Space under the picture" hint="e.g. 12px; empty is 16px" htmlFor={`${id}-tgap`}>
          <Input id={`${id}-tgap`} maxLength={40} value={card.textGap ?? ''} placeholder="16px" onChange={(e) => update({ textGap: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Between columns" hint="e.g. 32px; empty is 24px" htmlFor={`${id}-cgap`}>
          <Input id={`${id}-cgap`} maxLength={40} value={card.columnGap ?? ''} placeholder="24px" onChange={(e) => update({ columnGap: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Between rows" hint="e.g. 32px; empty is 44px" htmlFor={`${id}-rgap`}>
          <Input id={`${id}-rgap`} maxLength={40} value={card.rowGap ?? ''} placeholder="44px" onChange={(e) => update({ rowGap: e.target.value.trim() || undefined })} />
        </Field>
        {/* 3.28 — the words on a panel of their own. */}
        <Field label="Words on a panel" hint="its colour" htmlFor={`${id}-bbg`}>
          <Input id={`${id}-bbg`} maxLength={60} value={card.bodyBackground ?? ''} placeholder="none" onChange={(e) => update({ bodyBackground: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Panel padding" hint="e.g. 20px 24px" htmlFor={`${id}-bpad`}>
          <Input id={`${id}-bpad`} maxLength={60} value={card.bodyPadding ?? ''} placeholder="20px 24px" onChange={(e) => update({ bodyPadding: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="On phones" htmlFor={`${id}-bpadm`}>
          <Input id={`${id}-bpadm`} maxLength={60} value={card.bodyPaddingMobile ?? ''} placeholder="16px" onChange={(e) => update({ bodyPaddingMobile: e.target.value.trim() || undefined })} />
        </Field>
        <Field label="Under the title" hint="e.g. 0; empty is 6px (0.4rem with the link line)" htmlFor={`${id}-ugap`}>
          <Input id={`${id}-ugap`} maxLength={40} value={card.titleGap ?? ''} placeholder="as drawn" onChange={(e) => update({ titleGap: e.target.value.trim() || undefined })} />
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
          <Field label="Its size" hint="e.g. 15px" htmlFor={`${id}-rsize`}>
            <Input id={`${id}-rsize`} maxLength={40} value={card.revealSize ?? ''} placeholder="as drawn" onChange={(e) => update({ revealSize: e.target.value.trim() || undefined })} />
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
