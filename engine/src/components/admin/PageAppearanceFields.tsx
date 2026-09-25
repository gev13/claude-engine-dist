'use client';

import { Field, Input, Panel, Select } from '@/components/admin/ui';

export type PageAppearanceValue = { background?: string; scheme?: 'inherit' | 'alt' };

/**
 * One page's own colours (T31, 2.19): a background, and the site's
 * alternate palette for this page alone — which moves every colour token, so
 * the header and footer follow. Empty is the site's own.
 */
export function PageAppearanceFields({ value, onChange, what }: { value: PageAppearanceValue; onChange: (next: PageAppearanceValue) => void; what: string }) {
  const set = (patch: PageAppearanceValue) => {
    const next = { ...value, ...patch };
    if (!next.background) delete next.background;
    if (!next.scheme || next.scheme === 'inherit') delete next.scheme;
    onChange(next);
  };
  return (
    <Panel title={`This ${what}’s colours`}>
      <div className="space-y-4">
        <Field label="Palette" hint="the alternate palette is set in Appearance → Colours">
          <Select value={value.scheme ?? 'inherit'} onChange={(e) => set({ scheme: e.target.value as PageAppearanceValue['scheme'] })}>
            <option value="inherit">The site’s colours</option>
            <option value="alt">The alternate palette</option>
          </Select>
        </Field>
        <Field label="Background" hint="a colour such as #000000; empty keeps the palette’s">
          <Input value={value.background ?? ''} placeholder="#000000" maxLength={60} onChange={(e) => set({ background: e.target.value.trim() || undefined })} />
        </Field>
      </div>
    </Panel>
  );
}
