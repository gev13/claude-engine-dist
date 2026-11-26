'use client';

import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import { FONT_GROUPS } from '@/lib/fonts';
import type { TypeStyle } from '@/lib/typeStyle';

/** 3.37 — the text's face and the headings' first, then every other face the site has (`display` already means the headings'). */
const FACE_GROUPS = [
  {
    label: 'This site’s roles',
    options: [
      { value: 'body', label: 'The text’s' },
      { value: 'display', label: 'The headings’' },
    ],
  },
  ...FONT_GROUPS.map((group) => ({ label: group.label, options: group.options.filter((option) => option.value !== 'display') })).filter((group) => group.options.length > 0),
];

/** 3.30 — a run of words' own face, size, weight, spacing and colour; each empty keeps the drawn one. */
export function TypeStyleFields({ type, set }: { type: TypeStyle | undefined; set: (key: keyof TypeStyle) => (value: unknown) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ChoiceField label="Face" value={type?.font} groups={FACE_GROUPS} onChange={set('font')} />
      <LengthField label="Size" value={type?.size} placeholder="e.g. 24px" onChange={set('size')} />
      <LengthField label="Size on phones" value={type?.sizeMobile} placeholder="e.g. 22px" onChange={set('sizeMobile')} />
      <ChoiceField
        label="Weight"
        value={type?.weight}
        options={(['300', '400', '500', '600', '700', '800'] as const).map((w) => ({ value: w, label: w }))}
        onChange={set('weight')}
      />
      <LengthField label="Line height" kind="lineHeight" value={type?.line} placeholder="e.g. 1.1" onChange={set('line')} />
      <LengthField label="Line height on tablets" kind="lineHeight" value={type?.lineTablet} placeholder="as above" onChange={set('lineTablet')} />
      <LengthField label="Line height on phones" kind="lineHeight" value={type?.lineMobile} placeholder="as above" onChange={set('lineMobile')} />
      <LengthField label="Letter spacing" value={type?.tracking} placeholder="e.g. -0.2px" onChange={set('tracking')} />
      <ColorField label="Colour" value={type?.color} onChange={set('color')} />
    </div>
  );
}
