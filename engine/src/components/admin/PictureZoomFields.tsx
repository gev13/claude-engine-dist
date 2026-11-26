'use client';

import { Field, Input, Select } from '@/components/admin/ui';
import { PatternField } from '@/components/admin/styleFields';
import { FOCUS, type PictureZoom } from '@/lib/pictureZoom';

/** 3.37 — a picture zoomed and placed in its box, per screen (a media band's, a card's); each empty keeps the wider screen's. */
export function PictureZoomFields({ value, update }: { value: PictureZoom; update: (patch: Partial<PictureZoom>) => void }) {
  const zoomField = (key: 'imageZoom' | 'imageZoomTablet' | 'imageZoomMobile', label: string, placeholder: string) => (
    <Field label={label} hint="100–300 %">
      <Input
        type="number"
        min={100}
        max={300}
        step={0.1}
        value={value[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number(e.target.value);
          update({ [key]: e.target.value === '' || !Number.isFinite(n) ? undefined : Math.min(300, Math.max(100, n)) });
        }}
      />
    </Field>
  );
  const focusField = (key: 'imageFocus' | 'imageFocusTablet' | 'imageFocusMobile', label: string, placeholder: string) => (
    <PatternField label={label} hint="from the left and the top, e.g. 50% 0%" placeholder={placeholder} value={value[key]} pattern={FOCUS} error="One or two of a percentage, a length or a side." onChange={(next) => update({ [key]: next })} />
  );
  return (
    <details>
      <summary className="cursor-pointer text-[13px] text-ash">Picture — zoom, focus point, fit</summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {zoomField('imageZoom', 'Zoom', 'none')}
        {zoomField('imageZoomTablet', 'Zoom on tablets', 'as above')}
        {zoomField('imageZoomMobile', 'Zoom on phones', 'as above')}
        {focusField('imageFocus', 'Focus point', 'the anchor')}
        {focusField('imageFocusTablet', 'Focus on tablets', 'as above')}
        {focusField('imageFocusMobile', 'Focus on phones', 'as above')}
        {(
          [
            ['imageFit', 'Fit', 'Cover the box, as drawn'],
            ['imageFitTablet', 'Fit on tablets', 'As above'],
            ['imageFitMobile', 'Fit on phones', 'As above'],
          ] as const
        ).map(([key, label, empty]) => (
          <Field key={key} label={label}>
            <Select value={value[key] ?? ''} onChange={(e) => update({ [key]: (e.target.value || undefined) as PictureZoom['imageFit'] })}>
              <option value="">{empty}</option>
              <option value="cover">Cover the box</option>
              <option value="contain">Whole, inside the box</option>
              <option value="fill">Stretched to the box</option>
            </Select>
          </Field>
        ))}
      </div>
      <p className="m-0 mt-2 text-[12px] text-smoke">The picture covers its box, then is zoomed about the focus point, which also anchors it. To match a design drawing it W % wide from L % at the left: zoom W, focus −L ÷ (W − 100) × 100 %.</p>
    </details>
  );
}
