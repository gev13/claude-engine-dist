'use client';

import { useState } from 'react';
import { Field, Input, Select } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import {
  BOX_SIDES,
  GRADIENT_ANGLES,
  REVEAL_DELAYS,
  SECTION_WIDTHS,
  SECTION_WIDTH_LABELS,
  STYLE_BREAKPOINTS,
  type BlockStyle,
  type SpacingBox,
  type StyleBreakpoint,
} from '@/lib/blockStyle';
import { TIER_LABELS } from '@/lib/theme';
import { FONT_GROUPS } from '@/lib/fonts';
import { cn } from '@/lib/utils';

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
] as const;
const HOVER_OPTIONS = [
  { value: 'lift', label: 'Lift' },
  { value: 'grow', label: 'Grow' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'tilt', label: 'Tilt towards the pointer' },
] as const;
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
}: {
  style: BlockStyle | undefined;
  onChange: (next: BlockStyle | undefined) => void;
}) {
  const [spacingTab, setSpacingTab] = useState<'base' | StyleBreakpoint>('base');
  const [picking, setPicking] = useState(false);

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
    return undefined;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Layout ─────────────────────────────────────────────────────── */}
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

        <div className="grid gap-3 sm:grid-cols-4">
          {BOX_SIDES.map(([key, label]) => (
            <LengthField
              key={key}
              label={label}
              value={get([...spacingPath, key])}
              inherited={inheritedSpacing(key as keyof SpacingBox)}
              placeholder={spacingTab === 'base' ? 'the block’s own' : undefined}
              onChange={set([...spacingPath, key as keyof SpacingBox])}
            />
          ))}
        </div>
      </section>

      {/* ── Background ─────────────────────────────────────────────────── */}
      <section>
        <PanelTitle>Background</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Colour" value={get(['background', 'color'])} onChange={set(['background', 'color'])} />
          <ColorField
            label="Overlay"
            hint="laid over the image so text stays readable"
            value={get(['background', 'overlay'])}
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
          <ColorField label="Gradient from" value={get(['background', 'gradient', 'from'])} onChange={set(['background', 'gradient', 'from'])} />
          <ColorField label="Through (optional)" value={get(['background', 'gradient', 'via'])} onChange={set(['background', 'gradient', 'via'])} />
          <ColorField label="Gradient to" value={get(['background', 'gradient', 'to'])} onChange={set(['background', 'gradient', 'to'])} />
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
              onClick={() => setPicking(true)}
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
      </section>

      {/* ── Border ─────────────────────────────────────────────────────── */}
      <section>
        <PanelTitle>Border</PanelTitle>
        <div className="grid gap-3 sm:grid-cols-4">
          <LengthField label="Top" value={get(['border', 'topWidth'])} onChange={set(['border', 'topWidth'])} />
          <LengthField label="Right" value={get(['border', 'rightWidth'])} onChange={set(['border', 'rightWidth'])} />
          <LengthField label="Bottom" value={get(['border', 'bottomWidth'])} onChange={set(['border', 'bottomWidth'])} />
          <LengthField label="Left" value={get(['border', 'leftWidth'])} onChange={set(['border', 'leftWidth'])} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ColorField label="Colour" value={get(['border', 'color'])} onChange={set(['border', 'color'])} />
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
          <LengthField label="Radius" value={get(['border', 'radius'])} onChange={set(['border', 'radius'])} />
        </div>
      </section>

      {/* ── Typography ─────────────────────────────────────────────────── */}
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
              <LengthField label="Size" value={get(['typography', role, 'size'])} onChange={set(['typography', role, 'size'])} />
              <ChoiceField
                label="Weight"
                value={get(['typography', role, 'weight']) as never}
                options={WEIGHT_OPTIONS}
                onChange={set(['typography', role, 'weight'])}
              />
              <ColorField label="Colour" value={get(['typography', role, 'color'])} onChange={set(['typography', role, 'color'])} />
              <LengthField
                label="Letter spacing"
                value={get(['typography', role, 'letterSpacing'])}
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

      {/* ── Effects ────────────────────────────────────────────────────── */}
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

        <div className="mt-4 flex flex-wrap gap-4">
          {STYLE_BREAKPOINTS.map((bp) => (
            <label key={bp} className="flex items-center gap-2 text-[13px] text-ash">
              <input
                type="checkbox"
                checked={current.hideOn?.includes(bp) ?? false}
                onChange={(e) => {
                  const set_ = new Set(current.hideOn ?? []);
                  if (e.target.checked) set_.add(bp);
                  else set_.delete(bp);
                  set(['hideOn'])(set_.size ? [...set_] : undefined);
                }}
                className="h-4 w-4 accent-flare"
              />
              Hide on {TIER_LABELS[bp].toLowerCase()} (≤{TIER_WIDTH[bp]}px)
            </label>
          ))}
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
        open={picking}
        accept="image"
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          set(['background', 'imageUrl'])(media.url);
          setPicking(false);
        }}
      />
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-flare">{children}</h3>;
}
