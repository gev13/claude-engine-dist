'use client';

import { useState } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { CornerShapeFields } from '@/components/admin/CornerShapeFields';
import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import {
  BOX_SIDES,
  GRADIENT_ANGLES,
  REVEAL_DELAYS,
  SECTION_WIDTHS,
  SECTION_WIDTH_LABELS,
  STYLE_BREAKPOINTS,
  VISIBILITY_TIERS,
  hiddenTiers,
  type BlockStyle,
  type SpacingBox,
  type StyleBreakpoint,
} from '@/lib/blockStyle';
import { TIER_LABELS } from '@/lib/theme';
import { FONT_GROUPS } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { useBandStyle } from './useBandStyle';

/* The Design panel for one block — the equivalent of WPBakery's Design Options,
   with spacing extended to a value per breakpoint (see docs/builder-model.md).

   Every control writes `undefined` when cleared, and empty objects are pruned,
   so a block that has been opened and left alone stores no style at all. */

type Path = readonly (string | number)[];

function setIn<T>(source: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const base = (source ?? {}) as Record<string, unknown>;
  const child = setIn(base[head as string], rest, value);

  const next = { ...base };
  if (child === undefined || (typeof child === 'object' && child !== null && !Array.isArray(child) && Object.keys(child).length === 0)) {
    delete next[head as string];
  } else {
    next[head as string] = child;
  }
  return next as T;
}

function getIn(source: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key as string] : undefined),
    source,
  );
}

const TIER_WIDTH = { laptop: 1440, tablet: 1024, mobile: 768 } as const;

const SPACING_TABS = [
  { key: 'base', label: 'All screens' },
  ...STYLE_BREAKPOINTS.map((key) => ({ key, label: `${TIER_LABELS[key]} ≤${TIER_WIDTH[key]}` })),
] as const;

/* Sixty faces: grouped, or the picker stops being a menu. */
const FONT_OPTIONS = FONT_GROUPS;
const ALIGN_OPTIONS = (['left', 'center', 'right'] as const).map((value) => ({ value, label: value }));
const WEIGHT_OPTIONS = (['300', '400', '500', '600', '700', '800', '900'] as const).map((value) => ({
  value,
  label: value,
}));

/* Package 3, phase C — the effects every block gets. */
const REVEAL_OPTIONS = [
  { value: 'fade', label: 'Fade in' },
  { value: 'rise', label: 'Rise into place' },
  { value: 'zoom', label: 'Zoom in' },
  { value: 'left', label: 'Slide in from the left' },
  { value: 'right', label: 'Slide in from the right' },
  { value: 'blur', label: 'Blur in' },
  // 3.5 — stays still even when Appearance gives every section an entrance.
  { value: 'none', label: 'None — stays still' },
] as const;
const HOVER_OPTIONS = [
  { value: 'lift', label: 'Lift' },
  { value: 'grow', label: 'Grow' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'tilt', label: 'Tilt towards the pointer' },
] as const;
/* 3.0 — glitch text, after three CSS pens. */
const GLITCH_OPTIONS = [
  { value: 'noise', label: 'Noise — slices slipping in red and blue' },
  { value: 'psycho', label: 'Psycho — stretching, with torn ghost copies' },
  { value: 'split', label: 'Split — two-tone edges flickering' },
] as const;
const GLITCH_SCOPES = [
  { value: 'title', label: 'The first heading' },
  { value: 'headings', label: 'Every heading' },
] as const;
const GLITCH_TRIGGERS = [
  { value: 'always', label: 'All the time' },
  { value: 'hover', label: 'While the pointer is over it' },
  { value: 'interval', label: 'In bursts, every few seconds' },
] as const;
const GLITCH_TINTS = [
  { value: 'edge', label: 'A thin coloured edge' },
  { value: 'fill', label: 'Copies painted in the colours' },
] as const;
/** 3.5 — seconds, typed; empty keeps the default the renderer uses. */
const seconds = (value: string, min: number, max: number) => {
  const n = Number(value);
  return value.trim() === '' || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
};
const SHAPE_OPTIONS = [
  { value: 'wave', label: 'Wave' },
  { value: 'curve', label: 'Curve' },
  { value: 'tilt', label: 'Slant' },
  { value: 'triangle', label: 'Point' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'arrow', label: 'Arrow' },
] as const;
const SHAPE_HEIGHTS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;

export function BlockDesignPanel({
  style,
  onChange,
  blockType,
  outerOnly = false,
}: {
  style: BlockStyle | undefined;
  onChange: (next: BlockStyle | undefined) => void;
  /** Used to measure what this kind of block already pads itself by. */
  blockType?: string;
  /**
   * Only the outer spacing and where it shows — a synced saved block's
   * instance (2.15), whose look is the saved block's own and is changed there.
   */
  outerOnly?: boolean;
}) {
  const band = useBandStyle(blockType);
  const [spacingTab, setSpacingTab] = useState<'base' | StyleBreakpoint>('base');
  /** Which background field the media picker is choosing for; null when it is closed. */
  const [picking, setPicking] = useState<null | 'imageUrl' | 'videoUrl' | 'videoMobileUrl' | 'videoPoster'>(null);

  const current = style ?? {};
  const set = (path: Path) => (value: unknown) => {
    const next = setIn(current, path, value);
    onChange(Object.keys(next).length === 0 ? undefined : (next as BlockStyle));
  };
  const get = (path: Path) => getIn(current, path) as string | undefined;

  const spacingPath = ['spacing', spacingTab] as const;

  /**
   * The value a spacing field inherits while it is empty.
   *
   * A screen size falls back to the next one up, and "All screens" falls back
   * to the block's own band — which is CSS, per block type, and not a number
   * this panel can know. So the wider tabs name a value and the base tab says
   * plainly that the block decides, instead of every field saying "inherit"
   * and leaving an editor to guess which.
   */
  const inheritedSpacing = (key: keyof SpacingBox): string | undefined => {
    const order = ['base', ...STYLE_BREAKPOINTS] as const;
    for (let i = order.indexOf(spacingTab) - 1; i >= 0; i -= 1) {
      const value = getIn(current, ['spacing', order[i]!, key]);
      if (typeof value === 'string' && value) return value;
    }

    /* Nothing set above this tab, so what applies is the block's own band —
       measured from the real component at this tab's width rather than looked
       up in a table that would quietly go out of date. Only the two vertical
       sides: a band pads top and bottom, and its horizontal space comes from
       the shell, which this panel does not govern. */
    return band.spacing[spacingTab]?.[key];
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Layout ─────────────────────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Layout</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Width" hint="how much of the viewport this section spans">
            <Select
              value={current.width ?? ''}
              onChange={(e) => set(['width'])(e.target.value || undefined)}
            >
              <option value="">Standard — the site container</option>
              {SECTION_WIDTHS.filter((w) => w !== 'standard').map((w) => (
                <option key={w} value={w}>
                  {SECTION_WIDTH_LABELS[w]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Anchor id" hint="lets a link jump here, e.g. #pricing">
            <Input
              value={current.anchorId ?? ''}
              placeholder="none"
              spellCheck={false}
              onChange={(e) => set(['anchorId'])(e.target.value.trim() || undefined)}
            />
          </Field>

          <Field label="CSS class" hint="to aim your own CSS at; separate several with spaces">
            <Input
              value={current.className ?? ''}
              placeholder="none"
              spellCheck={false}
              onChange={(e) => set(['className'])(e.target.value.trim() || undefined)}
            />
          </Field>

          <Field label="Label" hint="shown in this list only, to find a section quickly">
            <Input
              value={current.label ?? ''}
              placeholder="none"
              onChange={(e) => set(['label'])(e.target.value || undefined)}
            />
          </Field>
        </div>
      </section>
      )}

      {/* ── Spacing ────────────────────────────────────────────────────── */}
      <section>
        <PanelTitle>Spacing</PanelTitle>
        <p className="m-0 mb-3 text-[12px] text-smoke">
          A screen size overrides &ldquo;All screens&rdquo; at that width and below. An empty field shows the value it
          inherits, greyed out. Setting a padding replaces the section&rsquo;s own on that side, so{' '}
          <code className="font-mono text-flare-soft">0px</code> really does remove it.
        </p>

        <div className="mb-3 flex flex-wrap gap-1 border-b-2 border-hairline">
          {SPACING_TABS.map((tab) => {
            const filled = Object.keys((getIn(current, ['spacing', tab.key]) ?? {}) as object).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSpacingTab(tab.key)}
                className={cn(
                  '-mb-0.5 border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                  spacingTab === tab.key ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
                )}
              >
                {tab.label}
                {filled > 0 && <span className="ml-1.5 text-flare">{filled}</span>}
              </button>
            );
          })}
        </div>

        {/* Not per breakpoint: these are one decision about the block, and
            four tabs of them would be four ways to be inconsistent. */}
        {spacingTab === 'base' && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <LengthField
              label="Space between items"
              hint="cards, tiles, list entries — not the spacing inside them"
              value={current.gap}
              emptyLabel="each block's own"
              onChange={set(['gap'])}
            />
            <Field label="Animation speed" hint="1 is normal; 0.5 is twice as fast">
              <Select
                value={current.motion === undefined ? '' : String(current.motion)}
                onChange={(e) => set(['motion'])(e.target.value === '' ? undefined : Number(e.target.value))}
              >
                <option value="">Normal</option>
                <option value="0">Off</option>
                <option value="0.5">Twice as fast</option>
                <option value="0.75">A little faster</option>
                <option value="1.5">A little slower</option>
                <option value="2">Twice as slow</option>
              </Select>
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          {BOX_SIDES.map(([key, label]) => (
            <LengthField
              key={key}
              label={label}
              value={get([...spacingPath, key])}
              inherited={inheritedSpacing(key as keyof SpacingBox)}
              placeholder={spacingTab === 'base' ? 'the block’s own' : undefined}
              hint={
                spacingTab === 'base' && band.spacing.base?.[key as keyof SpacingBox]
                  ? 'the block’s own — typing here replaces it'
                  : undefined
              }
              onChange={set([...spacingPath, key as keyof SpacingBox])}
            />
          ))}
        </div>
      </section>

      {/* ── Background ─────────────────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Background</PanelTitle>
        {/* 2.19 (T31) — every colour of the section at once, from the alternate palette. */}
        <label className="mb-4 flex items-center gap-2 text-[13px] text-ash">
          <input
            type="checkbox"
            className="h-4 w-4 accent-flare"
            checked={current.scheme === 'alt'}
            onChange={(e) => set(['scheme'])(e.target.checked ? 'alt' : undefined)}
          />
          Alternate colours — a light section on a dark site, or the reverse (Appearance → Colours → alternate)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Colour"
            value={get(['background', 'color'])}
            inherited={band.box.background}
            placeholder="none — the block paints its own"
            onChange={set(['background', 'color'])}
          />
          {/* An overlay and the gradient stops inherit nothing: the engine
              draws them only once you ask for one, so "inherit" would name a
              value that does not exist anywhere. */}
          <ColorField
            label="Overlay"
            hint="laid over the image so text stays readable"
            value={get(['background', 'overlay'])}
            placeholder="none"
            onChange={set(['background', 'overlay'])}
          />
          <ChoiceField
            label="Image size"
            value={get(['background', 'size']) as never}
            options={[
              { value: 'cover', label: 'Cover' },
              { value: 'contain', label: 'Contain' },
              { value: 'auto', label: 'Auto' },
            ]}
            onChange={set(['background', 'size'])}
          />
          <ChoiceField
            label="Image position"
            value={get(['background', 'position']) as never}
            options={[
              { value: 'center', label: 'Center' },
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={set(['background', 'position'])}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ColorField label="Gradient from" placeholder="none" value={get(['background', 'gradient', 'from'])} onChange={set(['background', 'gradient', 'from'])} />
          <ColorField label="Through (optional)" placeholder="none" value={get(['background', 'gradient', 'via'])} onChange={set(['background', 'gradient', 'via'])} />
          <ColorField label="Gradient to" placeholder="none" value={get(['background', 'gradient', 'to'])} onChange={set(['background', 'gradient', 'to'])} />
          <ChoiceField
            label="Gradient direction"
            value={current.background?.gradient?.angle}
            options={GRADIENT_ANGLES.map((angle) => ({ value: angle, label: `${angle}°` }))}
            onChange={set(['background', 'gradient', 'angle'])}
          />
          <label className="flex items-end gap-2 pb-3 text-[13px] text-ash">
            <input
              type="checkbox"
              checked={current.background?.gradient?.animate === true}
              onChange={(e) => set(['background', 'gradient', 'animate'])(e.target.checked || undefined)}
              className="h-4 w-4 accent-flare"
            />
            Let it drift slowly
          </label>
        </div>
        <p className="m-0 mt-1 text-[12px] text-smoke">
          A gradient is drawn once it has both ends, and only when there is no image. A background chosen here replaces the block’s own.
        </p>

        <Field label="Image" className="mt-4">
          <div className="flex items-center gap-3">
            {current.background?.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={current.background.imageUrl}
                alt=""
                className="h-10 w-16 shrink-0 border-2 border-hairline object-cover"
              />
            ) : (
              <span className="flex h-10 w-16 shrink-0 items-center justify-center border-2 border-dashed border-hairline text-[10px] text-smoke">
                None
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-smoke">
              {current.background?.imageUrl ?? 'Not set'}
            </span>
            <button
              type="button"
              onClick={() => setPicking('imageUrl')}
              className="shrink-0 border-2 border-hairline px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke hover:text-bone"
            >
              Choose
            </button>
            {current.background?.imageUrl && (
              <button
                type="button"
                onClick={() => set(['background', 'imageUrl'])(undefined)}
                className="shrink-0 border-2 border-hairline px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke hover:text-bone"
              >
                Clear
              </button>
            )}
          </div>
        </Field>

        {/* 2.17 — a film behind the section, under the overlay. */}
        <div className="mt-4 grid gap-3">
          <PickedFile label="Video" hint="an mp4 or webm from the media library — muted, looped, playing while on screen" value={current.background?.videoUrl} onChoose={() => setPicking('videoUrl')} onClear={() => set(['background', 'videoUrl'])(undefined)} />
          {current.background?.videoUrl && (
            <>
              <PickedFile label="Video on phones" hint="optional — a lighter file for small screens" value={current.background?.videoMobileUrl} onChoose={() => setPicking('videoMobileUrl')} onClear={() => set(['background', 'videoMobileUrl'])(undefined)} />
              <PickedFile label="Poster" hint="shown until the film plays, and instead of it where it does not" value={current.background?.videoPoster} onChoose={() => setPicking('videoPoster')} onClear={() => set(['background', 'videoPoster'])(undefined)} />
              <Field label="On phones">
                <Select value={current.background?.videoMobile ?? 'video'} onChange={(e) => set(['background', 'videoMobile'])(e.target.value === 'video' ? undefined : e.target.value)}>
                  <option value="video">Play the film</option>
                  <option value="poster">Show the poster only</option>
                </Select>
              </Field>
              <p className="m-0 text-[12px] text-smoke">Visitors with data saver on, or who asked for less motion, see the poster. The overlay colour above lies over the film.</p>
            </>
          )}
        </div>
      </section>
      )}

      {/* ── Border ─────────────────────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Border</PanelTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          <LengthField label="Top" value={get(['border', 'topWidth'])} inherited={band.box.topWidth} emptyLabel="none" onChange={set(['border', 'topWidth'])} />
          <LengthField label="Right" value={get(['border', 'rightWidth'])} inherited={band.box.rightWidth} emptyLabel="none" onChange={set(['border', 'rightWidth'])} />
          <LengthField label="Bottom" value={get(['border', 'bottomWidth'])} inherited={band.box.bottomWidth} emptyLabel="none" onChange={set(['border', 'bottomWidth'])} />
          <LengthField label="Left" value={get(['border', 'leftWidth'])} inherited={band.box.leftWidth} emptyLabel="none" onChange={set(['border', 'leftWidth'])} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ColorField label="Colour" value={get(['border', 'color'])} inherited={band.box.color} placeholder="none" onChange={set(['border', 'color'])} />
          <ChoiceField
            label="Style"
            value={get(['border', 'style']) as never}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
              { value: 'double', label: 'Double' },
              { value: 'none', label: 'None' },
            ]}
            onChange={set(['border', 'style'])}
          />
          <LengthField label="Radius" value={get(['border', 'radius'])} inherited={band.box.radius} emptyLabel="none" onChange={set(['border', 'radius'])} />
        </div>
      </section>
      )}

      {/* ── 2.21: shape and panel ──────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Shape</PanelTitle>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={current.panel === true} onChange={(e) => set(['panel'])(e.target.checked || undefined)} />
            Panel — inset from the page’s edges, in the panel colour and corners (Appearance → Shape)
          </label>
          <CornerShapeFields
            label="Corners"
            value={current.corners}
            fallbackSize={28}
            roundedLabel={current.panel ? 'As the panels are' : 'Square, or the radius above'}
            onChange={(corners) => set(['corners'])(corners)}
          />
          {current.corners?.style !== 'cut' && (
            <label className="flex items-center gap-2 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={current.clip === true} onChange={(e) => set(['clip'])(e.target.checked || undefined)} />
              Clip pictures and films inside to the rounded corners
            </label>
          )}
        </div>
      </section>
      )}

      {/* ── Typography ─────────────────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Typography — this section only</PanelTitle>
        <p className="m-0 mb-3 text-[12px] text-smoke">
          Overrides the global Appearance settings for this section. Leave everything empty to follow the site theme.
        </p>

        {(['heading', 'body'] as const).map((role) => (
          <div key={role} className="mb-4 border-t-2 border-hairline pt-4 last:mb-0">
            <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
              {role === 'heading' ? 'Headings' : 'Body text'}
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              <ChoiceField
                label="Font"
                value={get(['typography', role, 'family']) as never}
                groups={FONT_OPTIONS}
                onChange={set(['typography', role, 'family'])}
              />
              <LengthField
                label="Size"
                value={get(['typography', role, 'size'])}
                inherited={band.type[role]?.size}
                onChange={set(['typography', role, 'size'])}
              />
              <LengthField
                label="Size on tablets"
                hint="≤1024px"
                value={get(['typography', role, 'sizeTablet'])}
                placeholder="as above"
                onChange={set(['typography', role, 'sizeTablet'])}
              />
              <LengthField
                label="Size on phones"
                hint="≤768px"
                value={get(['typography', role, 'sizeMobile'])}
                placeholder="as above"
                onChange={set(['typography', role, 'sizeMobile'])}
              />
              <ChoiceField
                label="Weight"
                value={get(['typography', role, 'weight']) as never}
                inherited={band.type[role]?.weight}
                options={WEIGHT_OPTIONS}
                onChange={set(['typography', role, 'weight'])}
              />
              <ColorField
                label="Colour"
                value={get(['typography', role, 'color'])}
                inherited={band.type[role]?.color}
                onChange={set(['typography', role, 'color'])}
              />
              <LengthField
                label="Letter spacing"
                value={get(['typography', role, 'letterSpacing'])}
                inherited={band.type[role]?.letterSpacing}
                onChange={set(['typography', role, 'letterSpacing'])}
              />
              <ChoiceField
                label="Alignment"
                value={get(['typography', role, 'align']) as never}
                options={ALIGN_OPTIONS}
                onChange={set(['typography', role, 'align'])}
              />
            </div>
          </div>
        ))}
      </section>
      )}

      {/* ── Effects ────────────────────────────────────────────────────── */}
      {!outerOnly && (
      <section>
        <PanelTitle>Effects</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField label="Entrance" hint="plays once, as it scrolls into view" value={current.reveal} options={REVEAL_OPTIONS} onChange={set(['reveal'])} />
          <Field label="Entrance delay">
            <Select
              value={current.revealDelay ? String(current.revealDelay) : ''}
              disabled={!current.reveal}
              onChange={(e) => set(['revealDelay'])(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">None</option>
              {REVEAL_DELAYS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000} s
                </option>
              ))}
            </Select>
          </Field>
          <ChoiceField label="On hover" value={current.hover} options={HOVER_OPTIONS} onChange={set(['hover'])} />
        </div>

        <div className="mt-4 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" checked={current.sticky === true} onChange={(e) => set(['sticky'])(e.target.checked || undefined)} className="h-4 w-4 accent-flare" />
            Stick while scrolling — in a column, while its row scrolls past
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" checked={current.snap === true} onChange={(e) => set(['snap'])(e.target.checked || undefined)} className="h-4 w-4 accent-flare" />
            Let the page snap to this block
          </label>
        </div>

        <div className="mt-4 grid items-end gap-3 border-t-2 border-hairline pt-4 sm:grid-cols-3">
          <ChoiceField
            label="Glitch on the heading"
            hint="speed follows Motion above"
            value={current.glitch?.effect}
            options={GLITCH_OPTIONS}
            onChange={(effect) => set(['glitch'])(effect ? { ...current.glitch, effect } : undefined)}
          />
          {current.glitch && (
            <>
              <ChoiceField label="Which headings" value={current.glitch.scope} inherited="title" options={GLITCH_SCOPES} onChange={set(['glitch', 'scope'])} />
              <ChoiceField label="When" value={current.glitch.trigger} inherited="always" options={GLITCH_TRIGGERS} onChange={set(['glitch', 'trigger'])} />
              {current.glitch.trigger === 'interval' && (
                <>
                  <Field label="Every" hint="seconds between bursts; 5 when empty">
                    <Input type="number" min={1} max={120} step={0.5} placeholder="5" value={current.glitch.every ?? ''} onChange={(e) => set(['glitch', 'every'])(seconds(e.target.value, 1, 120))} />
                  </Field>
                  <Field label="Each burst lasts" hint="seconds; 1 when empty">
                    <Input type="number" min={0.2} max={10} step={0.1} placeholder="1" value={current.glitch.burst ?? ''} onChange={(e) => set(['glitch', 'burst'])(seconds(e.target.value, 0.2, 10))} />
                  </Field>
                </>
              )}
              <ChoiceField label="How the colours show" value={current.glitch.tint} inherited="edge" options={GLITCH_TINTS} onChange={set(['glitch', 'tint'])} />
              <ColorField label="First colour" hint="the effect’s own when empty" value={current.glitch.colorA} onChange={set(['glitch', 'colorA'])} />
              <ColorField label="Second colour" hint="the effect’s own when empty" value={current.glitch.colorB} onChange={set(['glitch', 'colorB'])} />
              <ColorField label="Behind the copies" hint="found from the section when empty" value={current.glitch.background} onChange={set(['glitch', 'background'])} />
            </>
          )}
        </div>

        {(['shapeTop', 'shapeBottom'] as const).map((edge) => {
          const shape = current[edge];
          return (
            <div key={edge} className="mt-4 grid items-end gap-3 border-t-2 border-hairline pt-4 sm:grid-cols-4">
              <ChoiceField
                label={edge === 'shapeTop' ? 'Shape along the top' : 'Shape along the bottom'}
                value={shape?.kind}
                options={SHAPE_OPTIONS}
                onChange={(kind) => set([edge])(kind ? { ...shape, kind } : undefined)}
              />
              {shape && (
                <>
                  <ChoiceField label="Height" value={shape.height} options={SHAPE_HEIGHTS} onChange={set([edge, 'height'])} />
                  <ColorField label="Colour" hint="the neighbouring section’s" value={shape.color} onChange={set([edge, 'color'])} />
                  <label className="flex items-center gap-2 pb-3 text-[13px] text-ash">
                    <input type="checkbox" checked={shape.flip === true} onChange={(e) => set([edge, 'flip'])(e.target.checked || undefined)} className="h-4 w-4 accent-flare" />
                    Mirror it
                  </label>
                </>
              )}
            </div>
          );
        })}

        <p className="m-0 mt-3 text-[12px] text-smoke">
          Nothing moves for visitors who ask for less motion, and hover effects answer a mouse rather than a touch.
        </p>
      </section>
      )}

      <section>
        <PanelTitle>Visibility</PanelTitle>

        {/* Not "carousel": there are no arrows and no dots, and calling it one
            would have people looking for controls that are not there. */}
        <Field
          label="Swipe sideways on small screens"
          hint="three or four across on a desktop, one at a time under a thumb"
        >
          <Select
            value={current.swipeOn ?? ''}
            onChange={(e) => set(['swipeOn'])(e.target.value || undefined)}
          >
            <option value="">Never — always a grid</option>
            {STYLE_BREAKPOINTS.map((bp) => (
              <option key={bp} value={bp}>
                {TIER_LABELS[bp]} and below (≤{TIER_WIDTH[bp]}px)
              </option>
            ))}
          </Select>
          <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
            Works on any section with a grid in it, and on a row&rsquo;s columns. Nothing is hidden — every card
            stays on the page and in the tab order.
          </p>
        </Field>

        {/* 2.19 (T32) — each tier on its own, so a block can show on phones only. The
            old "this width and below" setting is shown as the tiers it hid, and
            replaced by these the first time one is changed. */}
        <div className="mt-4 flex flex-wrap gap-4">
          {VISIBILITY_TIERS.map((tier) => {
            const hidden = hiddenTiers(current);
            return (
              <label key={tier} className="flex items-center gap-2 text-[13px] text-ash">
                <input
                  type="checkbox"
                  checked={hidden.includes(tier)}
                  onChange={(e) => {
                    const next = new Set(hidden);
                    if (e.target.checked) next.add(tier);
                    else next.delete(tier);
                    const ordered = VISIBILITY_TIERS.filter((t) => next.has(t));
                    set(['hideOn'])(undefined);
                    set(['hideAt'])(ordered.length ? ordered : undefined);
                  }}
                  className="h-4 w-4 accent-flare"
                />
                Hide on {TIER_LABELS[tier].toLowerCase()}
                {tier === 'base' ? ' (above 1440px)' : ` (${TIER_RANGE_LABEL[tier]})`}
              </label>
            );
          })}
        </div>

        <label className="mt-4 flex items-center gap-2 text-[13px] text-ash">
          <input
            type="checkbox"
            checked={current.disabled === true}
            onChange={(e) => set(['disabled'])(e.target.checked ? true : undefined)}
            className="h-4 w-4 accent-flare"
          />
          Hide this section everywhere — keeps it here, removes it from the live page
        </label>
      </section>

      <MediaPicker
        open={picking !== null}
        accept={picking === 'videoUrl' || picking === 'videoMobileUrl' ? 'video' : 'image'}
        onClose={() => setPicking(null)}
        onSelect={(media) => {
          if (picking) set(['background', picking])(media.url);
          setPicking(null);
        }}
      />
    </div>
  );
}

/** A file chosen from the library: its address, Choose and Clear. */
function PickedFile({ label, hint, value, onChoose, onClear }: { label: string; hint?: string; value?: string; onChoose: () => void; onClear: () => void }) {
  const button = 'shrink-0 border-2 border-hairline px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke hover:text-bone';
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-smoke">{value ?? 'Not set'}</span>
        <button type="button" onClick={onChoose} className={button}>
          Choose
        </button>
        {value && (
          <button type="button" onClick={onClear} className={button}>
            Clear
          </button>
        )}
      </div>
    </Field>
  );
}

const TIER_RANGE_LABEL: Record<'laptop' | 'tablet' | 'mobile', string> = { laptop: '1025–1440px', tablet: '769–1024px', mobile: '768px and under' };

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-flare">{children}</h3>;
}
