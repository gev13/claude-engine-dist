'use client';

import { useId } from 'react';
import { Alert, Field, Input, Panel } from '@/components/admin/ui';
import { ChoiceField, ColorField } from '@/components/admin/styleFields';
import type { Chrome } from '@/lib/chrome';

/* ═══════════════════════════════════════════════════════════════════════════
   Appearance: the 2.19 header, menu, footer and site-wide motion options
   ───────────────────────────────────────────────────────────────────────────
   Every control starts empty — "Default", naming what the site already does —
   and writes nothing until changed, so an untouched theme row stays exactly
   as it was and the site renders exactly as before.
   ═══════════════════════════════════════════════════════════════════════════ */

type Setter = (path: readonly (string | number)[]) => (value: unknown) => void;
type Props = { chrome: Chrome | undefined; set: Setter };

/** A checkbox bound to an optional boolean: unticked back to the default writes nothing. */
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

/** A line of text; empty writes nothing. */
function TextField({ label, hint, value, maxLength, placeholder, onChange }: { label: string; hint?: string; value: string | undefined; maxLength: number; placeholder?: string; onChange: (next: string | undefined) => void }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input id={id} value={value ?? ''} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value || undefined)} />
    </Field>
  );
}

/** A whole number within bounds; empty is the default. */
function NumberField({
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
        onChange={(e) => onChange(e.target.value === '' ? undefined : Math.min(max, Math.max(min, Math.round(Number(e.target.value) || min))))}
      />
    </Field>
  );
}

const TIER_NAMES = [
  ['base', 'Large desktop'],
  ['laptop', '≤1440'],
  ['tablet', '≤1024'],
  ['mobile', '≤768'],
] as const;

/** T25 — the bar's background, how it behaves while scrolling, its height, and the phone logo. */
export function HeaderExtrasPanel({ chrome, set }: Props) {
  const header = chrome?.header;
  const at = (key: string) => ['chrome', 'header', key] as const;
  return (
    <Panel title="Header — background, scrolling and height">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField
            label="Background"
            value={header?.background}
            inherited="solid"
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'transparent', label: 'None — the page shows through' },
              { value: 'glass', label: 'Frosted glass' },
            ]}
            onChange={set(at('background'))}
          />
          <ChoiceField
            label="While scrolling"
            value={header?.behaviour}
            inherited="always"
            options={[
              { value: 'always', label: 'Always there' },
              { value: 'hide', label: 'Hides going down, returns going up' },
              { value: 'shrink', label: 'Shrinks' },
            ]}
            onChange={set(at('behaviour'))}
          />
          <ChoiceField
            label="Logo on phones"
            value={header?.logoMobile}
            inherited="left"
            options={[
              { value: 'left', label: 'At the left' },
              { value: 'center', label: 'Centred' },
              { value: 'afterMenu', label: 'After the menu button' },
            ]}
            onChange={set(at('logoMobile'))}
          />
        </div>
        {header?.background === 'glass' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Blur" hint="px" min={0} max={30} placeholder="14" value={header?.glassBlur} onChange={set(at('glassBlur'))} />
            <NumberField label="Tint" hint="% of the page colour laid over the blur" min={0} max={100} placeholder="60" value={header?.glassOpacity} onChange={set(at('glassOpacity'))} />
          </div>
        )}
        {header?.variant === 'notch' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Curve of the notch" hint="px" min={0} max={64} placeholder="32" value={header?.notchRadius} onChange={set(at('notchRadius'))} />
            <ColorField label="Notch colour" placeholder="the page colour" value={header?.notchBackground} onChange={(value) => set(at('notchBackground'))(value || undefined)} />
          </div>
        )}
        {header?.variant === 'menuButtonInline' && (
          <ChoiceField
            label="Menu button sits"
            value={header?.menuSide}
            inherited="left"
            options={[
              { value: 'left', label: 'At the left' },
              { value: 'right', label: 'At the right' },
            ]}
            onChange={set(at('menuSide'))}
          />
        )}
        <div>
          <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Height, px — empty keeps the layout’s own</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {TIER_NAMES.map(([key, name]) => (
              <NumberField
                key={key}
                label={name}
                min={40}
                max={160}
                placeholder="—"
                value={header?.height?.[key]}
                onChange={set(['chrome', 'header', 'height', key])}
              />
            ))}
          </div>
        </div>
        <p className="m-0 text-[12px] text-smoke">
          “Hides going down” needs the header to stick to the top. A see-through or glass bar lets the top of the page run
          under it.
        </p>
      </div>
    </Panel>
  );
}

/** T26 — the full-screen menus: which menu, how big, how it arrives, and the pictures and contacts beside it. */
export function MenuExtrasPanel({ chrome, set }: Props) {
  const menu = chrome?.mobileMenu;
  const at = (key: string) => ['chrome', 'mobileMenu', key] as const;
  return (
    <Panel title="Full-screen menu">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField
            label="Lists"
            value={menu?.source}
            inherited="main"
            options={[
              { value: 'main', label: 'The header’s menu' },
              { value: 'overlay', label: 'The Overlay menu (Menus)' },
            ]}
            onChange={set(at('source'))}
          />
          <ChoiceField
            label="Link size"
            value={menu?.size}
            inherited="large"
            options={[
              { value: 'large', label: 'Large' },
              { value: 'huge', label: 'Huge' },
            ]}
            onChange={set(at('size'))}
          />
          <ChoiceField
            label="Arrives"
            value={menu?.entrance}
            inherited="none"
            options={[
              { value: 'none', label: 'At once' },
              { value: 'fade', label: 'Fading in' },
              { value: 'slide', label: 'Sliding down' },
              { value: 'stagger', label: 'One link after another' },
            ]}
            onChange={set(at('entrance'))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Solid" hint="% — lower lets the page show through" min={30} max={100} placeholder="100" value={menu?.opacity} onChange={set(at('opacity'))} />
          <TextField label="Contact heading" hint="the creative full-screen menu’s contact column" value={menu?.contactTitle} maxLength={60} placeholder="Get in touch" onChange={set(at('contactTitle'))} />
          <TextField label="Phone" hint="in that column, beside the email" value={menu?.phone} maxLength={40} placeholder="+44 20 0000 0000" onChange={set(at('phone'))} />
        </div>
        <Check label="Show a link’s picture beside the list while it is pointed at" value={menu?.hoverImages} onChange={set(at('hoverImages'))} />
        <p className="m-0 text-[12px] text-smoke">
          For the full-screen menus. The pictures are set on each link in Menus; links without one show none. Arriving
          effects are skipped for anyone who asks for less motion.
        </p>
      </div>
    </Panel>
  );
}

/** The footer's own background (2.19), its logo and panel (3.1). Its reveal lives with the rest of the motion. */
export function FooterExtrasPanel({ chrome, set }: Props) {
  const id = useId();
  const footer = chrome?.footer;
  return (
    <Panel title="Footer background and logo">
      <div className="grid gap-4 sm:grid-cols-3">
        <ColorField label="Background" placeholder="the page’s" value={footer?.background} onChange={(value) => set(['chrome', 'footer', 'background'])(value || undefined)} />
        <ChoiceField
          label="At the head of the footer"
          value={footer?.logo}
          inherited="mark"
          options={[
            { value: 'mark', label: 'The mark and the site name' },
            { value: 'image', label: 'The uploaded logo (Brand)' },
            { value: 'none', label: 'Nothing' },
          ]}
          onChange={set(['chrome', 'footer', 'logo'])}
        />
        {footer?.logo === 'image' && (
          <Field label="Logo height" hint="px" htmlFor={`${id}-logo-h`}>
            <Input
              id={`${id}-logo-h`}
              type="number"
              min={16}
              max={120}
              placeholder="40"
              value={footer?.logoHeight ?? ''}
              onChange={(e) =>
                set(['chrome', 'footer', 'logoHeight'])(e.target.value === '' ? undefined : Math.min(120, Math.max(16, Math.round(Number(e.target.value) || 40))))
              }
            />
          </Field>
        )}
      </div>
      <div className="mt-4">
        <Check label="Draw the footer as a panel (Shape → Panels)" value={footer?.panel} onChange={set(['chrome', 'footer', 'panel'])} />
      </div>
    </Panel>
  );
}

/**
 * Appearance → Motion (2.20): everything that moves, in one place — the
 * override for everyone first, then the pointer, page changes, the reveal
 * footer and the side rails. Card tilt is per list, where the cards are.
 */
export function MotionExtrasPanel({ chrome, set }: Props) {
  const railsId = useId();
  const rails = chrome?.rails;
  const railsAt = (key: string) => ['chrome', 'rails', key] as const;
  const footer = chrome?.footer;
  const off = chrome?.reduceMotion === true;
  return (
    <>
      <Panel title="For everyone">
        <div className="space-y-3">
          <Check label="Reduce motion for everyone" value={chrome?.reduceMotion} onChange={set(['chrome', 'reduceMotion'])} />
          <p className="m-0 text-[12px] text-smoke">
            Stops every animation on the site for every visitor — sliders, reveals, the pointer, page changes, the
            preloader and card tilt — as if each had asked for less motion. Visitors who ask for less motion get it
            either way; the footer switch lets one visitor choose it, and is left out while this is on.
          </p>
        </div>
      </Panel>

      {off && (
        <Alert tone="info">Motion is off for everyone, so the options below are saved but not shown to visitors.</Alert>
      )}

      <Panel title="Pointer">
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            label="The site’s own pointer"
            hint="a mouse only; never for anyone who asks for less motion"
            value={chrome?.cursor?.style}
            inherited="off"
            options={[
              { value: 'off', label: 'Off — the system pointer' },
              { value: 'dotRing', label: 'A dot and a trailing ring' },
              { value: 'dot', label: 'A dot' },
              { value: 'ring', label: 'A ring' },
              { value: 'blend', label: 'A disc that inverts what is under it' },
            ]}
            onChange={set(['chrome', 'cursor', 'style'])}
          />
          <TextField label="Word over pictures" hint="empty shows none" value={chrome?.cursor?.mediaLabel} maxLength={16} placeholder="View" onChange={set(['chrome', 'cursor', 'mediaLabel'])} />
        </div>
      </Panel>

      <Panel title="Page changes">
        <div className="space-y-4">
          <ChoiceField
            label="From one page to the next"
            value={chrome?.transition?.style}
            inherited="off"
            options={[
              { value: 'off', label: 'At once' },
              { value: 'fadeUp', label: 'Fade and rise' },
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'curtain', label: 'A curtain across the screen' },
            ]}
            onChange={set(['chrome', 'transition', 'style'])}
          />
          <Check label="Show the logo while the first page of a visit loads" value={chrome?.transition?.preloader} onChange={set(['chrome', 'transition', 'preloader'])} />
          <p className="m-0 text-[12px] text-smoke">
            Links to other sites, new tabs, downloads and the back button are left alone. The logo shows for a second and a
            half at most, once a visit.
          </p>
        </div>
      </Panel>

      <Panel title="Reveal footer">
        <div className="space-y-4">
          <Check label="The page lifts off the footer, which waits underneath" value={footer?.reveal} onChange={set(['chrome', 'footer', 'reveal'])} />
          {footer?.reveal && <Check label="On phones too" value={footer?.revealOnMobile} onChange={set(['chrome', 'footer', 'revealOnMobile'])} />}
          <p className="m-0 text-[12px] text-smoke">
            A footer taller than most of the screen scrolls normally instead, so nothing in it is ever out of reach.
          </p>
        </div>
      </Panel>

      <Panel title="Side rails">
        <div className="space-y-4">
          <Check label="Rails down the sides of wide screens" value={rails?.enabled} onChange={set(railsAt('enabled'))} />
          {rails?.enabled && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                  label="Scroll to top, with progress"
                  value={rails?.scrollSide}
                  inherited="left"
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'none', label: 'None' },
                  ]}
                  onChange={set(railsAt('scrollSide'))}
                />
                <TextField label="Its label" value={rails?.scrollLabel} maxLength={30} placeholder="Scroll to top" onChange={set(railsAt('scrollLabel'))} />
                <ChoiceField
                  label="Social links"
                  value={rails?.socialSide}
                  inherited="right"
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'none', label: 'None' },
                  ]}
                  onChange={set(railsAt('socialSide'))}
                />
                <TextField label="Their label" value={rails?.socialLabel} maxLength={30} placeholder="Follow us —" onChange={set(railsAt('socialLabel'))} />
                <NumberField label="From a width of" hint="px" min={768} max={2560} placeholder="1181" value={rails?.minWidth} onChange={set(railsAt('minWidth'))} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Check label="Only once the reader is a screen down" value={rails?.afterFirstScreen} onChange={set(railsAt('afterFirstScreen'))} />
                <Check label="Invert against what is behind them" value={rails?.autoContrast} onChange={set(railsAt('autoContrast'))} />
              </div>
              <Field label="Leave them off" hint="one path a line; end with * for everything under it" htmlFor={`${railsId}-hide`}>
                <textarea
                  id={`${railsId}-hide`}
                  className="min-h-[72px] w-full border-2 border-hairline bg-ink px-3 py-2 font-mono text-[13px] text-bone"
                  spellCheck={false}
                  defaultValue={(rails?.hideOn ?? []).join('\n')}
                  onBlur={(e) => {
                    const paths = e.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter((line) => /^\/[A-Za-z0-9._~\-/%]*\*?$/.test(line))
                      .slice(0, 20);
                    set(railsAt('hideOn'))(paths.length ? paths : undefined);
                  }}
                />
              </Field>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}
