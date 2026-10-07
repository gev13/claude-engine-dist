'use client';

import { useId } from 'react';
import { Field, Input, Panel } from '@/components/admin/ui';
import { ChoiceField } from '@/components/admin/styleFields';
import type { Chrome } from '@/lib/chrome';

/* ═══════════════════════════════════════════════════════════════════════════
   Appearance: the 3.28 details of the header, its dropdowns, the menus and
   the footer. Every field starts empty, which keeps the drawn look, and the
   stylesheet for them (lib/chromeCss.ts) writes nothing until one is set.
   ═══════════════════════════════════════════════════════════════════════════ */

type Setter = (path: readonly (string | number)[]) => (value: unknown) => void;
type Props = { chrome: Chrome | undefined; set: Setter };

function Text({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (next: string | undefined) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} value={value ?? ''} maxLength={60} placeholder={placeholder ?? 'as drawn'} onChange={(e) => onChange(e.target.value.trim() || undefined)} />
    </Field>
  );
}

function Num({
  label,
  hint,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  min: number;
  max: number;
  placeholder: string;
  onChange: (next: number | undefined) => void;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))))}
      />
    </Field>
  );
}

function Check({ label, value, fallback = false, onChange }: { label: string; value: boolean | undefined; fallback?: boolean; onChange: (next: boolean | undefined) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-[14px] text-ash">
      <input
        type="checkbox"
        className="h-4 w-4 accent-flare"
        checked={value ?? fallback}
        onChange={(e) => onChange(e.target.checked === fallback ? undefined : e.target.checked)}
      />
      {label}
    </label>
  );
}

const WEIGHTS = ['300', '400', '500', '600', '700', '800'].map((value) => ({
  value,
  label: value,
}));
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 sm:grid-cols-3">{children}</div>;
const Note = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[12px] leading-relaxed text-smoke">{children}</p>;

/** 2.1 and 2.2 — the dropdowns and the header's details. */
export function HeaderDetailsPanel({ chrome, set }: Props) {
  const h = chrome?.header;
  const d = h?.dropdown;
  const at = (key: string) => ['chrome', 'header', key] as const;
  const dd = (key: string) => ['chrome', 'header', 'dropdown', key] as const;
  return (
    <>
      <Panel title="Desktop dropdowns">
        <div className="space-y-5">
          <Note>The compact panel under a top link. Every field empty keeps it as drawn.</Note>
          <Grid>
            <ChoiceField
              label="Lines up with"
              value={d?.align}
              inherited="center"
              options={[
                { value: 'center', label: 'The link’s centre' },
                { value: 'start', label: 'The link’s left edge' },
              ]}
              onChange={set(dd('align'))}
            />
            <Text label="Below the bar" hint="e.g. 8px" value={d?.top} onChange={set(dd('top'))} />
            <Text label="Width" hint="e.g. 240px" value={d?.width} onChange={set(dd('width'))} />
            <Text label="Background" hint="e.g. rgba(30,30,34,0.7)" value={d?.background} onChange={set(dd('background'))} />
            <Num label="Blur behind" hint="px" min={0} max={40} placeholder="none" value={d?.blur} onChange={set(dd('blur'))} />
            <Check label="Edge line" value={d?.border} fallback onChange={set(dd('border'))} />
            <Text label="Corners" hint="e.g. 8px" value={d?.radius} onChange={set(dd('radius'))} />
            <Text label="Padding" hint="e.g. 4px" value={d?.padding} onChange={set(dd('padding'))} />
          </Grid>
          <Grid>
            <Text label="Item height" hint="e.g. 38px" value={d?.itemHeight} onChange={set(dd('itemHeight'))} />
            <Text label="Item size" hint="e.g. 15px" value={d?.itemSize} onChange={set(dd('itemSize'))} />
            <Text label="Item padding" hint="e.g. 7px 12px" value={d?.itemPadding} onChange={set(dd('itemPadding'))} />
            <Text label="Item colour" value={d?.itemColor} onChange={set(dd('itemColor'))} />
            <Text label="Item colour, pointed at" value={d?.itemHoverColor} onChange={set(dd('itemHoverColor'))} />
            <Text label="Row tint, pointed at" hint="e.g. rgba(255,255,255,0.06)" value={d?.itemHoverBackground} onChange={set(dd('itemHoverBackground'))} />
            <Text label="Row corners" hint="e.g. 6px" value={d?.itemRadius} onChange={set(dd('itemRadius'))} />
            <Num label="Opens and closes in" hint="ms — a fade with a small rise" min={0} max={3000} placeholder="as drawn" value={d?.duration} onChange={set(dd('duration'))} />
            {typeof d?.duration === 'number' && <Text label="Rise" hint="e.g. 8px" value={d?.rise} onChange={set(dd('rise'))} />}
          </Grid>
          <Grid>
            <Check label="Dim the other top links while one is pointed at" value={h?.dimSiblings} onChange={set(at('dimSiblings'))} />
            {h?.dimSiblings && <Num label="Dimmed to" hint="% opacity" min={0} max={100} placeholder="50" value={h?.dimOpacity} onChange={set(at('dimOpacity'))} />}
            <Num label="Top links’ colour change" hint="ms" min={0} max={3000} placeholder="150" value={h?.linkDuration} onChange={set(at('linkDuration'))} />
          </Grid>
        </div>
      </Panel>

      <Panel title="Header details">
        <div className="space-y-5">
          <Grid>
            <ChoiceField
              label="Menu icon"
              value={h?.menuIcon}
              inherited="lines"
              options={[
                { value: 'lines', label: 'Three short lines' },
                { value: 'bars', label: 'Two bars, long and short' },
              ]}
              onChange={set(at('menuIcon'))}
            />
            {h?.menuIcon === 'bars' && (
              <>
                <Text label="Long bar" hint="e.g. 22px" value={h?.menuIconWidth} onChange={set(at('menuIconWidth'))} />
                <Text label="Short bar" hint="e.g. 18px" value={h?.menuIconShort} onChange={set(at('menuIconShort'))} />
                <Text label="Thickness" hint="e.g. 2px" value={h?.menuIconThickness} onChange={set(at('menuIconThickness'))} />
                <Text label="Space between" hint="e.g. 5px" value={h?.menuIconGap} onChange={set(at('menuIconGap'))} />
                <Text label="Colour" hint="e.g. rgba(255,255,255,0.75)" value={h?.menuIconColor} onChange={set(at('menuIconColor'))} />
                <ChoiceField
                  label="Pointed at"
                  value={h?.menuIconHover}
                  inherited="none"
                  options={[
                    { value: 'none', label: 'No change' },
                    { value: 'grow', label: 'Grows a little and fades' },
                  ]}
                  onChange={set(at('menuIconHover'))}
                />
              </>
            )}
          </Grid>
          <div>
            <p className="m-0 mb-2 text-[13px] text-ash">Side padding, left / right</p>
            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ['base', 'Large desktop'],
                  ['laptop', '≤1440'],
                  ['tablet', '≤1024'],
                  ['mobile', '≤768'],
                ] as const
              ).map(([tier, name]) => (
                <div key={tier} className="grid grid-cols-2 gap-2">
                  <Text label={`${name} L`} placeholder="—" value={h?.padding?.[tier]?.left} onChange={set(['chrome', 'header', 'padding', tier, 'left'])} />
                  <Text label="R" placeholder="—" value={h?.padding?.[tier]?.right} onChange={set(['chrome', 'header', 'padding', tier, 'right'])} />
                </div>
              ))}
            </div>
          </div>
          <Grid>
            <Text label="Header button height" hint="e.g. 36px — phones too" value={h?.ctaHeight} onChange={set(at('ctaHeight'))} />
            <Text label="Header button padding" hint="e.g. 0 16px" value={h?.ctaPadding} onChange={set(at('ctaPadding'))} />
            <Text label="Header button text size" hint="e.g. 14px" value={h?.ctaSize} onChange={set(at('ctaSize'))} />
            <ChoiceField label="Header button weight" value={h?.ctaWeight} inherited="" options={WEIGHTS} onChange={set(at('ctaWeight'))} />
            <Num label="Header button hover" hint="ms" min={0} max={3000} placeholder="as drawn" value={h?.ctaDuration} onChange={set(at('ctaDuration'))} />
          </Grid>
          <Grid>
            <Check label="Glass and blur on phones too" value={h?.glassPhones} fallback onChange={set(at('glassPhones'))} />
            <Text label="Top links on project pages" hint="a colour" value={h?.projectLinkColor} onChange={set(at('projectLinkColor'))} />
          </Grid>
        </div>
      </Panel>
    </>
  );
}

/** 2.3 and 2.4 — the full-screen menu's and the drawer's details. */
export function MenuDetailsPanel({ chrome, set }: Props) {
  const m = chrome?.mobileMenu;
  const d = m?.drawer;
  const at = (key: string) => ['chrome', 'mobileMenu', key] as const;
  const dr = (key: string) => ['chrome', 'mobileMenu', 'drawer', key] as const;
  return (
    <Panel title="Menu details">
      <div className="space-y-5">
        <Note>The full-screen menus on wide screens, then the side drawer (also the phones’ drawer).</Note>
        <Grid>
          <ChoiceField
            label="Sub-items open"
            value={m?.submenuLayout}
            inherited="inline"
            options={[
              { value: 'inline', label: 'Under their link' },
              { value: 'beside', label: 'In a column beside the list' },
            ]}
            onChange={set(at('submenuLayout'))}
          />
          <ChoiceField
            label="A link pointed at"
            value={m?.itemHover}
            inherited="colour"
            options={[
              { value: 'colour', label: 'Takes the accent colour' },
              { value: 'shift', label: 'Keeps its colour, moves right' },
            ]}
            onChange={set(at('itemHover'))}
          />
          {(m?.itemHover === 'shift' || m?.submenuLayout === 'beside') && <Text label="Moves by" hint="e.g. 16px" value={m?.shiftBy} onChange={set(at('shiftBy'))} />}
          <Num label="Fades in and out in" hint="ms" min={0} max={3000} placeholder="as drawn" value={m?.duration} onChange={set(at('duration'))} />
          <Text label="Space above the list" hint="e.g. 40px" value={m?.listTop} onChange={set(at('listTop'))} />
          <Text label="Contact text size" hint="e.g. 15px" value={m?.contactSize} onChange={set(at('contactSize'))} />
          <Text label="Contact text colour" hint="e.g. rgba(255,255,255,0.5)" value={m?.contactColor} onChange={set(at('contactColor'))} />
        </Grid>
        <Grid>
          <Text label="Drawer: current page" hint="a colour" value={d?.activeColor} onChange={set(dr('activeColor'))} />
          <Text label="Drawer: open item tint" hint="e.g. rgba(255,255,255,0.06)" value={d?.openBackground} onChange={set(dr('openBackground'))} />
          <Text label="Drawer: open item corners" hint="e.g. 8px" value={d?.openRadius} onChange={set(dr('openRadius'))} />
          <Text label="Drawer: sub-item size" hint="e.g. 19.3px" value={d?.subSize} onChange={set(dr('subSize'))} />
          <Text label="Drawer: sub-item indent" hint="e.g. 12px" value={d?.subIndent} onChange={set(dr('subIndent'))} />
          <Text label="Drawer: page behind" hint="a colour — empty is black" value={d?.backdrop} onChange={set(dr('backdrop'))} />
          <Num label="Drawer: how much of it" hint="%" min={0} max={100} placeholder="50" value={d?.backdropOpacity} onChange={set(dr('backdropOpacity'))} />
          <Num label="Drawer: blur behind" hint="px — 0 is none" min={0} max={30} placeholder="as drawn" value={d?.backdropBlur} onChange={set(dr('backdropBlur'))} />
        </Grid>
      </div>
    </Panel>
  );
}

/** 3 — the footer's details. */
export function FooterDetailsPanel({ chrome, set }: Props) {
  const f = chrome?.footer;
  const at = (key: string) => ['chrome', 'footer', key] as const;
  return (
    <Panel title="Footer details">
      <div className="space-y-5">
        <Grid>
          <ChoiceField
            label="Icons"
            value={f?.iconSet}
            inherited="line"
            options={[
              { value: 'line', label: 'Lines' },
              { value: 'filled', label: 'Filled' },
            ]}
            onChange={set(at('iconSet'))}
          />
          <Text label="Contact links’ size" hint="e.g. 15px" value={f?.contactSize} onChange={set(at('contactSize'))} />
          <ChoiceField label="Contact links’ weight" value={f?.contactWeight} inherited="" options={WEIGHTS} onChange={set(at('contactWeight'))} />
          <ChoiceField
            label="Columns"
            value={f?.columns}
            inherited="auto"
            options={[
              { value: 'auto', label: 'The first wider' },
              { value: 'equal', label: 'All the same width' },
            ]}
            onChange={set(at('columns'))}
          />
          <Text label="Links’ line height" hint="e.g. 17px" value={f?.linkLineHeight} onChange={set(at('linkLineHeight'))} />
          <Text label="Space between links" hint="e.g. 13px" value={f?.linkGap} onChange={set(at('linkGap'))} />
          <Text label="Column titles’ letter spacing" hint="e.g. -0.4px" value={f?.titleTracking} onChange={set(at('titleTracking'))} />
          <ChoiceField label="Current page’s link weight" value={f?.activeWeight} inherited="" options={WEIGHTS} onChange={set(at('activeWeight'))} />
          <Text label="Current page’s link colour" value={f?.activeColor} onChange={set(at('activeColor'))} />
          <Text label="Separators’ colour" value={f?.separatorColor} onChange={set(at('separatorColor'))} />
          <Text label="Space at the separators" hint="e.g. 6px" value={f?.separatorGap} onChange={set(at('separatorGap'))} />
          <Text label="Line above the bottom row" hint="a colour" value={f?.dividerColor} onChange={set(at('dividerColor'))} />
          {f?.reveal && (
            <Num
              label="Reveal from"
              hint="px wide — empty follows “on phones too”"
              min={320}
              max={2560}
              placeholder="—"
              value={f?.revealMinWidth}
              onChange={set(at('revealMinWidth'))}
            />
          )}
        </Grid>
        <Note>The bottom row’s type is its own role in Typography (Footer bottom row).</Note>
      </div>
    </Panel>
  );
}

/** 4.2–4.4 — the loading screen, the pointer's disc and the rails' line. */
export function MotionDetailsPanel({ chrome, set }: Props) {
  const t = chrome?.transition;
  const c = chrome?.cursor;
  const r = chrome?.rails;
  const tr = (key: string) => ['chrome', 'transition', key] as const;
  const cu = (key: string) => ['chrome', 'cursor', key] as const;
  const ra = (key: string) => ['chrome', 'rails', key] as const;
  return (
    <Panel title="Motion details">
      <div className="space-y-5">
        <Grid>
          <Text label="Loading screen picture" hint="a /media/… address — an animated GIF works" value={t?.preloaderImage} placeholder="the logo" onChange={set(tr('preloaderImage'))} />
          <Text label="Loading screen colour" value={t?.preloaderBackground} placeholder="the page colour" onChange={set(tr('preloaderBackground'))} />
          <Text label="Picture width" hint="e.g. 180px" value={t?.preloaderSize} onChange={set(tr('preloaderSize'))} />
          <Check label="Between every two pages (needs a page-change style)" value={t?.preloaderEvery} onChange={set(tr('preloaderEvery'))} />
          <Check label="The header fades with the page" value={t?.headerFade} onChange={set(tr('headerFade'))} />
        </Grid>
        <Grid>
          <ChoiceField label="Pointer disc arrow" value={c?.arrowStyle} inherited="stroke" options={[{ value: 'stroke', label: 'A line' }, { value: 'filled', label: 'Filled' }]} onChange={set(cu('arrowStyle'))} />
          <Num label="Arrow size" hint="px" min={8} max={64} placeholder="18" value={c?.arrowSize} onChange={set(cu('arrowSize'))} />
          <Check label="Blur behind the disc" value={c?.discBlur} fallback onChange={set(cu('discBlur'))} />
          <Check label="The disc over pictures that open the lightbox too" value={c?.lightbox} onChange={set(cu('lightbox'))} />
          <Num label="Ring catches up in" hint="ms — 0 keeps it on the dot" min={0} max={1000} placeholder="about 250" value={c?.follow} onChange={set(cu('follow'))} />
        </Grid>
        <Grid>
          <ChoiceField label="Rail line" value={r?.barPlace} inherited="" options={[{ value: 'above', label: 'Above the words' }, { value: 'below', label: 'Below the words' }]} onChange={set(ra('barPlace'))} />
          <ChoiceField label="It fills" value={r?.barDirection} inherited="" options={[{ value: 'down', label: 'Downwards' }, { value: 'up', label: 'Upwards' }]} onChange={set(ra('barDirection'))} />
          <Text label="Its track" hint="a colour, or transparent" value={r?.barTrack} onChange={set(ra('barTrack'))} />
          <Text label="Its fill" hint="a colour" value={r?.barFill} onChange={set(ra('barFill'))} />
          <Text label="Rails from the edge" hint="e.g. 48px" value={r?.inset} placeholder="22px" onChange={set(ra('inset'))} />
        </Grid>
      </div>
    </Panel>
  );
}
