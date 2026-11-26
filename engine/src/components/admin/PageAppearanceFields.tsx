'use client';

import { PictureZoomFields } from '@/components/admin/PictureZoomFields';
import { Field, Input, Panel, Select } from '@/components/admin/ui';
import type { PictureZoom } from '@/lib/pictureZoom';

export type PageAppearanceValue = { background?: string; scheme?: 'inherit' | 'alt' | 'alt2'; cover?: PictureZoom };

/**
 * One page's own colours (T31, 2.19): a background, and the site's
 * alternate palette for this page alone — which moves every colour token, so
 * the header and footer follow. Empty is the site's own.
 */
export function PageAppearanceFields({ value, onChange, what, cover = false }: { value: PageAppearanceValue; onChange: (next: PageAppearanceValue) => void; what: string; /** 3.38 — a post's cover framing too. */ cover?: boolean }) {
  const set = (patch: PageAppearanceValue) => {
    const next = { ...value, ...patch };
    if (!next.background) delete next.background;
    if (!next.scheme || next.scheme === 'inherit') delete next.scheme;
    onChange(next);
  };
  return (
    <Panel title={`This ${what}’s colours`}>
      <div className="space-y-4">
        <Field label="Palette" hint="the alternate palettes are set in Appearance → Colours">
          <Select value={value.scheme ?? 'inherit'} onChange={(e) => set({ scheme: e.target.value as PageAppearanceValue['scheme'] })}>
            <option value="inherit">The site’s colours</option>
            <option value="alt">The alternate palette</option>
            <option value="alt2">The second alternate palette</option>
          </Select>
        </Field>
        <Field label="Background" hint="a colour such as #000000; empty keeps the palette’s">
          <Input value={value.background ?? ''} placeholder="#000000" maxLength={60} onChange={(e) => set({ background: e.target.value.trim() || undefined })} />
        </Field>
        {/* 3.38 — the cover framed on its cards and its own cover card. */}
        {cover && (
          <PictureZoomFields
            value={value.cover ?? {}}
            update={(patch) => {
              const next: PictureZoom = { ...value.cover, ...patch };
              for (const k of Object.keys(next) as (keyof PictureZoom)[]) if (next[k] === undefined) delete next[k];
              const rest = { ...value };
              if (Object.keys(next).length) rest.cover = next;
              else delete rest.cover;
              onChange(rest);
            }}
          />
        )}
      </div>
    </Panel>
  );
}
