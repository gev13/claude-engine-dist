'use client';

import { TypeStyleFields } from '@/components/admin/TypeStyleFields';
import { Field, Input, Select } from '@/components/admin/ui';
import type { TypeStyle } from '@/lib/typeStyle';

/** 3.33 — shared with Appearance → Blog: the arrow, the phone height and padding, the words' own types. */
export function PostCardExtraFields({ card, setCard }: { card: Record<string, unknown>; setCard: (key: string, value: unknown) => void }) {
  const text = (label: string, key: string, placeholder: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input value={(card[key] as string) ?? ''} placeholder={placeholder} onChange={(e) => setCard(key, e.target.value.trim() || undefined)} />
    </Field>
  );
  const type = (label: string, key: 'titleType' | 'chipType' | 'excerptType') => (
    <div className="border-t-2 border-hairline pt-3 sm:col-span-2">
      <p className="m-0 mb-2 text-[12px] text-smoke">{label}</p>
      <TypeStyleFields
        type={card[key] as TypeStyle | undefined}
        set={(field) => (value) => {
          const next = { ...(card[key] as TypeStyle | undefined), [field]: value };
          for (const k of Object.keys(next) as (keyof TypeStyle)[]) if (next[k] === undefined) delete next[k];
          setCard(key, Object.keys(next).length ? next : undefined);
        }}
      />
    </div>
  );
  return (
    <>
      <Field label="The arrow">
        <Select value={card.arrow === 'pointer' ? 'pointer' : card.arrow === true ? 'mark' : ''} onChange={(e) => setCard('arrow', e.target.value === 'pointer' ? 'pointer' : e.target.value === 'mark' ? true : undefined)}>
          <option value="">None</option>
          <option value="mark">A round arrow with the words</option>
          <option value="pointer">The pointer itself becomes the arrow</option>
        </Select>
      </Field>
      {card.arrow === 'pointer' && (
        <>
          {text('Arrow’s circle', 'arrowColor', '#ffffff')}
          {text('Arrow’s glyph', 'arrowGlyph', '#000000')}
          <Field label="Arrow’s size" hint="px, 24–96; empty is 48">
            <Input type="number" min={24} max={96} value={(card.arrowSize as number) ?? ''} onChange={(e) => setCard('arrowSize', e.target.value === '' ? undefined : Math.min(96, Math.max(24, Math.round(Number(e.target.value) || 48))))} />
          </Field>
        </>
      )}
      {text('Card height on phones', 'heightMobile', '320px')}
      {text('Space inside the card', 'textPadding', '26px', 'one to four lengths')}
      {text('— on phones', 'textPaddingMobile', '20px')}
      {type('The title', 'titleType')}
      {type('The category', 'chipType')}
      {type('The excerpt', 'excerptType')}
    </>
  );
}
