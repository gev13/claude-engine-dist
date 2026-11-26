'use client';

import { TypeStyleFields } from '@/components/admin/TypeStyleFields';
import { Field, Input, Select } from '@/components/admin/ui';
import { CARD_TIERS, type CardTier } from '@/lib/blog';
import type { TypeStyle } from '@/lib/typeStyle';

const TIER_NAMES: Record<CardTier, string> = { base: 'Large desktop', laptop: 'Desktop', tablet: 'Tablet', mobile: 'Phone' };
type Box = { width?: string; height?: string };

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
  const box = (label: string, key: 'imageBox' | 'imageBoxMobile', hint?: string) => {
    const current = (card[key] as Box | undefined) ?? {};
    const put = (side: keyof Box, value: string) => {
      const next: Box = { ...current, [side]: value.trim() || undefined };
      if (!next.width) delete next.width;
      if (!next.height) delete next.height;
      setCard(key, next.width || next.height ? next : undefined);
    };
    return (
      <Field label={label} hint={hint}>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label={`${label}: width`} value={current.width ?? ''} placeholder="width" onChange={(e) => put('width', e.target.value)} />
          <Input aria-label={`${label}: height`} value={current.height ?? ''} placeholder="height" onChange={(e) => put('height', e.target.value)} />
        </div>
      </Field>
    );
  };
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
      {/* 3.37 */}
      {text('Space between the words’ parts', 'textGap', '8px', 'the category, title, date and excerpt')}
      {text('— on phones', 'textGapMobile', '8px')}
      <Field label="The excerpt’s lines">
        <Select value={card.excerptLines ? String(card.excerptLines) : ''} onChange={(e) => setCard('excerptLines', e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Every line</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{`${n} at most, then …`}</option>
          ))}
        </Select>
      </Field>
      {text('The excerpt’s width at most', 'excerptWidth', 'e.g. 280px')}
      {text('Overlay as stops from the top', 'tintStops', 'rgba(0,0,0,0.2) 30%, #000 90%', 'over the whole card, in place of the fade from the bottom')}
      {box('The picture’s own box', 'imageBox', 'anchored top left, the card clipping it; empty is the card’s size')}
      {box('— on phones', 'imageBoxMobile')}
      <Field label="Card heights on phones, in turn" hint="separated by commas; cards past the end take the last">
        <Input
          defaultValue={Array.isArray(card.heightsMobile) ? (card.heightsMobile as string[]).join(', ') : ''}
          placeholder="e.g. 400px, 400px, 440px"
          spellCheck={false}
          onBlur={(e) => {
            const list = e.target.value.split(',').map((h) => h.trim()).filter(Boolean).slice(0, 12);
            setCard('heightsMobile', list.length ? list : undefined);
          }}
        />
      </Field>
      {card.reveal === true && (
        <fieldset className="m-0 border-0 p-0 sm:col-span-2">
          <legend className="mb-2 text-[12px] text-smoke">The words wait for the pointer on (the others always show them)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CARD_TIERS.map((tier) => {
              const at = Array.isArray(card.revealAt) ? (card.revealAt as CardTier[]) : [...CARD_TIERS];
              return (
                <label key={tier} className="flex items-center gap-2 text-[13px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={at.includes(tier)}
                    onChange={(e) => {
                      const next = CARD_TIERS.filter((t) => (t === tier ? e.target.checked : at.includes(t)));
                      setCard('revealAt', next.length === CARD_TIERS.length ? undefined : next);
                    }}
                  />
                  {TIER_NAMES[tier]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {type('The title', 'titleType')}
      {type('The category', 'chipType')}
      {type('The excerpt', 'excerptType')}
    </>
  );
}
