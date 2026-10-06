'use client';

import { useId } from 'react';
import { Alert, Field, Input, Panel } from '@/components/admin/ui';
import { ChoiceField, ColorField } from '@/components/admin/styleFields';
import { MOBILE_MENU_LABELS, MOBILE_MENU_VARIANTS, type Chrome } from '@/lib/chrome';
import { SOCIAL_LABELS, SOCIAL_NETWORKS, type SocialNetwork } from '@/lib/navigation';

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
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Blur" hint="px" min={0} max={30} placeholder="14" value={header?.glassBlur} onChange={set(at('glassBlur'))} />
            <NumberField label="Tint" hint="% of the page colour laid over the blur" min={0} max={100} placeholder="60" value={header?.glassOpacity} onChange={set(at('glassOpacity'))} />
            <NumberField label="Saturation" hint="% — 100 keeps the page’s own colours" min={0} max={300} placeholder="120" value={header?.glassSaturate} onChange={set(at('glassSaturate'))} />
          </div>
        )}
        {/* 3.22 */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check label="A thin line under the bar" value={header?.border} fallback onChange={set(at('border'))} />
          <Check label="The page starts at the very top, under the bar (on every page)" value={header?.under} onChange={set(at('under'))} />
        </div>
        {/* 3.26 */}
        <div className="max-w-[420px]">
          <ChoiceField
            label="A menu link is lit"
            value={header?.activeMatch}
            inherited="section"
            options={[
              { value: 'section', label: 'On its page and every page under it' },
              { value: 'exact', label: 'On its own page only' },
            ]}
            onChange={set(at('activeMatch'))}
          />
        </div>
        <div>
          <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">The header button</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField label="Edge" hint="px" min={0} max={4} placeholder="2" value={header?.ctaBorderWidth} onChange={set(at('ctaBorderWidth'))} />
            <ChoiceField
              label="Style"
              value={header?.ctaStyle}
              inherited="primary"
              options={[
                { value: 'primary', label: 'The main button' },
                { value: 'outline', label: 'The outline button' },
              ]}
              onChange={set(at('ctaStyle'))}
            />
            {(
              [
                ['text', 'Text'],
                ['background', 'Fill'],
                ['border', 'Edge'],
                ['hoverText', 'Text, pointed at'],
                ['hoverBackground', 'Fill, pointed at'],
                ['hoverBorder', 'Edge, pointed at'],
              ] as const
            ).map(([key, label]) => (
              <ColorField
                key={key}
                label={label}
                placeholder="the button style’s"
                value={header?.ctaColors?.[key]}
                onChange={(value) => set(['chrome', 'header', 'ctaColors', key])(value || undefined)}
              />
            ))}
          </div>
        </div>
        {header?.variant === 'notch' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Curve of the notch" hint="px" min={0} max={64} placeholder="32" value={header?.notchRadius} onChange={set(at('notchRadius'))} />
            <ColorField label="Notch colour" placeholder="the page colour" value={header?.notchBackground} onChange={(value) => set(at('notchBackground'))(value || undefined)} />
          </div>
        )}
        {/* 3.23 — the round menu button's circle and icon. */}
        {header?.variant === 'menuButtonInline' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Menu button circle" hint="a colour — e.g. rgba(0,0,0,0.5); empty is the surface" value={header?.menuButtonBackground} maxLength={60} placeholder="the surface" onChange={set(at('menuButtonBackground'))} />
            <TextField label="Menu button icon" hint="a colour; empty is the header's text" value={header?.menuButtonColor} maxLength={60} placeholder="the header's" onChange={set(at('menuButtonColor'))} />
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
              { value: 'slide', label: 'Sliding in from the side' },
              { value: 'stagger', label: 'One link after another' },
            ]}
            onChange={set(at('entrance'))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Solid" hint="% — lower lets the page show through" min={30} max={100} placeholder="100" value={menu?.opacity} onChange={set(at('opacity'))} />
          <TextField label="Contact heading" hint="over the contact details; empty is Site translations’ “Get in touch”" value={menu?.contactTitle} maxLength={60} placeholder="Get in touch" onChange={set(at('contactTitle'))} />
          <TextField label="Phone" hint="with the contact details" value={menu?.phone} maxLength={40} placeholder="+44 20 0000 0000" onChange={set(at('phone'))} />
        </div>
        <Check label="Show a link’s picture beside the list while it is pointed at" value={menu?.hoverImages} onChange={set(at('hoverImages'))} />
        {/* 3.22 */}
        <div className="grid gap-4 sm:grid-cols-4">
          <TextField label="Link size" hint="e.g. 40px — overrides the size above" value={menu?.itemSize} maxLength={40} placeholder="as above" onChange={set(at('itemSize'))} />
          <TextField label="Link size on phones" hint="768px and below" value={menu?.itemSizeMobile} maxLength={40} placeholder="as above" onChange={set(at('itemSizeMobile'))} />
          <ChoiceField
            label="Link weight"
            value={menu?.itemWeight}
            options={['300', '400', '500', '600', '700', '800'].map((value) => ({ value, label: value }))}
            onChange={set(at('itemWeight'))}
          />
          <TextField label="Letter spacing" hint="e.g. 0 or -0.02em" value={menu?.itemTracking} maxLength={20} placeholder="as drawn" onChange={set(at('itemTracking'))} />
        </div>
        {/* 3.26 */}
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Link line height" hint="e.g. 1.2 or 54px" value={menu?.itemLineHeight} maxLength={20} placeholder="1.05" onChange={set(at('itemLineHeight'))} />
          <TextField label="Space above and below each link" hint="e.g. 4px" value={menu?.itemPadding} maxLength={40} placeholder="10px" onChange={set(at('itemPadding'))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField
            label="Opens a link’s sub-items"
            value={menu?.expandIcon}
            inherited="circle"
            options={[
              { value: 'circle', label: 'A + in a circle' },
              { value: 'plus', label: 'A plain +' },
              { value: 'chevron', label: 'A chevron' },
            ]}
            onChange={set(at('expandIcon'))}
          />
          <ColorField label="Background" placeholder="the page’s" value={menu?.background} onChange={(value) => set(at('background'))(value || undefined)} />
          <ChoiceField
            label="Contact details"
            value={menu?.contactPosition}
            inherited="column"
            options={[
              { value: 'column', label: 'A column (the menu with contact details)' },
              { value: 'row', label: 'A row at the bottom left' },
              { value: 'off', label: 'None' },
            ]}
            onChange={set(at('contactPosition'))}
          />
        </div>
        {menu?.contactPosition !== 'off' && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Check label="The email (Settings)" value={menu?.contactEmail} fallback onChange={set(at('contactEmail'))} />
            <Check label="The address (Menus)" value={menu?.contactAddress} fallback onChange={set(at('contactAddress'))} />
            <Check label="The social links" value={menu?.contactSocial} fallback onChange={set(at('contactSocial'))} />
          </div>
        )}
        <Check label="List the service pages under the links" value={menu?.services} fallback onChange={set(at('services'))} />
        {/* 3.24 — the menu as a column beside the dimmed page, and its own contact row. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Width" hint="e.g. 380px — a column beside the dimmed page; empty is the whole screen" value={menu?.columnWidth} maxLength={40} placeholder="the whole screen" onChange={set(at('columnWidth'))} />
          <ChoiceField
            label="The links stand"
            value={menu?.verticalAlign}
            inherited="top"
            options={[
              { value: 'top', label: 'From the top' },
              { value: 'center', label: 'Centred up and down' },
            ]}
            onChange={set(at('verticalAlign'))}
          />
          <ChoiceField
            label="The + for sub-items"
            value={menu?.expandAt}
            inherited="end"
            options={[
              { value: 'end', label: 'At the row’s far end' },
              { value: 'beside', label: 'Beside the words' },
            ]}
            onChange={set(at('expandAt'))}
          />
        </div>
        {/* 3.25 — the page beside a column, and the column's own colour. */}
        {menu?.columnWidth && (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="The page beside it" hint="% dark — 0 is the page as it is; empty is 50" min={0} max={100} placeholder="50" value={menu?.dim} onChange={set(at('dim'))} />
            <TextField label="Dimmed with" hint="a colour — empty is black" value={menu?.dimColor} maxLength={60} placeholder="#000000" onChange={set(at('dimColor'))} />
            <TextField label="The column’s side padding" hint="e.g. 54px" value={menu?.columnPadding} maxLength={40} placeholder="as drawn" onChange={set(at('columnPadding'))} />
            <ChoiceField
              label="The column"
              value={menu?.columnPanel}
              inherited="panel"
              options={[
                { value: 'panel', label: 'In the menu’s colour' },
                { value: 'none', label: 'No colour — the links on the dimmed page' },
              ]}
              onChange={set(at('columnPanel'))}
            />
          </div>
        )}
        <Check label="Hide the site’s header while the menu is open (the close button stays)" value={menu?.hideHeader} onChange={set(at('hideHeader'))} />
        {menu?.contactPosition !== 'off' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Before the phone number" hint="e.g. Ph:" value={menu?.phoneLabel} maxLength={20} placeholder="nothing" onChange={set(at('phoneLabel'))} />
            <ChoiceField
              label="Social links in the menu"
              value={menu?.socialStyle}
              options={[
                { value: 'icon', label: 'Icons' },
                { value: 'name', label: 'Names' },
                { value: 'short', label: 'Short labels' },
              ]}
              onChange={set(at('socialStyle'))}
            />
            <NetworkChecks label="Which networks" hint="none ticked shows every social link" value={menu?.socialNetworks} onChange={set(at('socialNetworks'))} />
            {/* 3.25 */}
            <ChoiceField
              label="Stands out"
              value={menu?.contactEmphasis}
              inherited="value"
              options={[
                { value: 'value', label: 'The details (the heading small)' },
                { value: 'title', label: 'The heading (the details muted)' },
              ]}
              onChange={set(at('contactEmphasis'))}
            />
            <ChoiceField
              label="The social links stand"
              value={menu?.socialPlace}
              inherited="below"
              options={[
                { value: 'below', label: 'Under the contact details' },
                { value: 'beside', label: 'Beside them, on one line' },
              ]}
              onChange={set(at('socialPlace'))}
            />
            <ChoiceField
              label="The social links drawn"
              value={menu?.socialLook}
              inherited="circle"
              options={[
                { value: 'circle', label: 'In circles' },
                { value: 'plain', label: 'Bare' },
              ]}
              onChange={set(at('socialLook'))}
            />
          </div>
        )}
        <p className="m-0 text-[12px] text-smoke">
          For the full-screen menus. The pictures are set on each link in Menus; links without one show none. Arriving
          effects are skipped for anyone who asks for less motion. An empty choice for the social links follows Menus.
        </p>
      </div>
    </Panel>
  );
}

/** 3.24 — networks to show, in the order ticked; none ticked writes nothing (every link, as before). */
function NetworkChecks({ label, hint, value, onChange }: { label: string; hint?: string; value: SocialNetwork[] | undefined; onChange: (next: SocialNetwork[] | undefined) => void }) {
  const list = value ?? [];
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {SOCIAL_NETWORKS.map((network) => (
          <label key={network} className="flex items-center gap-1.5 text-[13px] text-ash">
            <input
              type="checkbox"
              className="h-4 w-4 accent-flare"
              checked={list.includes(network)}
              onChange={(e) => {
                const next = e.target.checked ? [...list, network] : list.filter((n) => n !== network);
                onChange(next.length ? next : undefined);
              }}
            />
            {SOCIAL_LABELS[network]}
          </label>
        ))}
      </div>
    </Field>
  );
}

/** 3.24 — phones (or tablets too) with a menu of their own: its style, side, width, type, links and button. */
export function PhoneMenuPanel({ chrome, set }: Props) {
  const phone = chrome?.mobileMenu?.onPhones;
  const at = (key: string) => ['chrome', 'mobileMenu', 'onPhones', key] as const;
  return (
    <Panel title="Menu on phones">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField
            label="On phones, the menu button opens"
            value={phone?.variant}
            options={MOBILE_MENU_VARIANTS.map((value) => ({ value, label: MOBILE_MENU_LABELS[value].label }))}
            onChange={set(at('variant'))}
          />
          {phone?.variant && (
            <>
              <ChoiceField
                label="Up to"
                value={phone?.upTo}
                inherited="mobile"
                options={[
                  { value: 'mobile', label: 'Phones — 768px' },
                  { value: 'tablet', label: 'Tablets too — 1024px' },
                ]}
                onChange={set(at('upTo'))}
              />
              <ChoiceField
                label="Lists"
                value={phone?.source}
                inherited="main"
                options={[
                  { value: 'main', label: 'The header’s menu' },
                  { value: 'overlay', label: 'The Overlay menu (Menus)' },
                  { value: 'phone', label: 'The Phone menu (Menus)' },
                ]}
                onChange={set(at('source'))}
              />
            </>
          )}
        </div>
        {phone?.variant && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <ChoiceField
                label="A drawer’s side"
                value={phone?.side}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                ]}
                onChange={set(at('side'))}
              />
              <TextField label="A drawer’s width" hint="e.g. 320px" value={phone?.width} maxLength={40} placeholder="as drawn" onChange={set(at('width'))} />
              <TextField label="Link size" hint="e.g. 18px" value={phone?.itemSize} maxLength={40} placeholder="as drawn" onChange={set(at('itemSize'))} />
              <ChoiceField label="Link weight" value={phone?.itemWeight} options={['300', '400', '500', '600', '700', '800'].map((value) => ({ value, label: value }))} onChange={set(at('itemWeight'))} />
            </div>
            {/* 3.26 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Link line height" hint="e.g. 1.3 or 24px" value={phone?.itemLineHeight} maxLength={20} placeholder="as drawn" onChange={set(at('itemLineHeight'))} />
              <TextField label="Space above and below each link" hint="e.g. 8px" value={phone?.itemPadding} maxLength={40} placeholder="16px" onChange={set(at('itemPadding'))} />
              <TextField label="Link colour" hint="e.g. rgba(255,255,255,0.75)" value={phone?.itemColor} maxLength={60} placeholder="the text colour" onChange={set(at('itemColor'))} />
              <TextField label="Space above the list" hint="under the close button, e.g. 48px" value={phone?.listTop} maxLength={40} placeholder="as drawn" onChange={set(at('listTop'))} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Check label="The header button as the list’s last link" value={phone?.ctaInList} onChange={set(at('ctaInList'))} />
              {/* 3.25 */}
              <Check label="The logo at the top" value={phone?.logo} fallback onChange={set(at('logo'))} />
              <Check label="Lines between the links" value={phone?.dividers} fallback onChange={set(at('dividers'))} />
            </div>
            <div className="max-w-[260px]">
              <ChoiceField
                label="Opens a link’s sub-items"
                value={phone?.expandIcon}
                inherited="chevron"
                options={[
                  { value: 'chevron', label: 'A chevron' },
                  { value: 'plus', label: 'A plain +' },
                ]}
                onChange={set(at('expandIcon'))}
              />
            </div>
          </>
        )}
        <p className="m-0 text-[12px] text-smoke">Empty uses the menu above at every width, as before. The empty drawer side follows the one above.</p>
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
        {footer?.logo === 'image' && (
          <Field label="Logo height on phones" hint="px — empty keeps the height above" htmlFor={`${id}-logo-hm`}>
            <Input
              id={`${id}-logo-hm`}
              type="number"
              min={16}
              max={120}
              placeholder="as above"
              value={footer?.logoHeightMobile ?? ''}
              onChange={(e) =>
                set(['chrome', 'footer', 'logoHeightMobile'])(e.target.value === '' ? undefined : Math.min(120, Math.max(16, Math.round(Number(e.target.value) || 40))))
              }
            />
          </Field>
        )}
      </div>
      <div className="mt-4">
        <Check label="Draw the footer as a panel (Shape → Panels)" value={footer?.panel} onChange={set(['chrome', 'footer', 'panel'])} />
        <Check label="Show the contact email" value={footer?.email !== false} onChange={(v) => set(['chrome', 'footer', 'email'])(v ? undefined : false)} />
        <Check label="The copyright line as written, not in capitals" value={footer?.copyrightCase === 'asWritten'} onChange={(v) => set(['chrome', 'footer', 'copyrightCase'])(v ? 'asWritten' : undefined)} />
      </div>
      {/* 3.22 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label="Between the social links"
          hint="when Menus shows them as names or short labels"
          value={footer?.socialSeparator}
          inherited="none"
          options={[
            { value: 'none', label: 'Nothing' },
            { value: 'slash', label: 'A slash — Fb. / Ig.' },
            { value: 'dot', label: 'A dot' },
          ]}
          onChange={set(['chrome', 'footer', 'socialSeparator'])}
        />
        <ChoiceField
          label="Between the legal links"
          hint="Privacy · Terms · Cookies in the bottom row"
          value={footer?.legalSeparator}
          inherited="none"
          options={[
            { value: 'none', label: 'Nothing' },
            { value: 'bar', label: 'A bar — Privacy | Terms' },
            { value: 'slash', label: 'A slash' },
            { value: 'dot', label: 'A dot' },
          ]}
          onChange={set(['chrome', 'footer', 'legalSeparator'])}
        />
        <Field label="Listed apart, as icon and name" hint="these links go under the others, one a line — a phone, messengers">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {SOCIAL_NETWORKS.map((network) => {
              const list = footer?.contactLinks ?? [];
              return (
                <label key={network} className="flex items-center gap-1.5 text-[13px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={list.includes(network)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...list, network] : list.filter((n) => n !== network);
                      set(['chrome', 'footer', 'contactLinks'])(next.length ? next : undefined);
                    }}
                  />
                  {SOCIAL_LABELS[network]}
                </label>
              );
            })}
          </div>
        </Field>
        {/* 3.27 — the head column, and the footer on phones. */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check label="The site’s tagline under the logo" value={footer?.tagline} fallback onChange={set(['chrome', 'footer', 'tagline'])} />
          <Check label="On phones, each menu a list that opens (unticked: open lists)" value={footer?.accordionMobile} fallback onChange={set(['chrome', 'footer', 'accordionMobile'])} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            label="The social and contact links"
            value={footer?.socialPlace}
            inherited="below"
            options={[
              { value: 'below', label: 'Below the columns' },
              { value: 'head', label: 'In the head column, under the logo' },
            ]}
            onChange={set(['chrome', 'footer', 'socialPlace'])}
          />
          <ChoiceField
            label="The bottom row on phones"
            value={footer?.bottomAlignMobile}
            inherited="left"
            options={[
              { value: 'left', label: 'From the left' },
              { value: 'center', label: 'Centred' },
            ]}
            onChange={set(['chrome', 'footer', 'bottomAlignMobile'])}
          />
        </div>
        <p className="m-0 text-[12px] text-smoke">
          A footer column can sit under the one before it (Menus → Footer menu → Stack under the column before). The links’ and the bottom row’s type is Typography → Footer links.
        </p>
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
          {/* 3.22 */}
          <Check
            label="Pause buttons over background and ambient films (off: films are moving pictures only — WCAG 2.2.2 asks for a way to stop them)"
            value={chrome?.videoControls}
            fallback
            onChange={set(['chrome', 'videoControls'])}
          />
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
          {/* 3.24 — over a picture that is a link. */}
          <ChoiceField
            label="Over a linked picture"
            value={chrome?.cursor?.linkedMedia}
            inherited="off"
            options={[
              { value: 'off', label: 'As over any link' },
              { value: 'word', label: 'The word above' },
              { value: 'arrow', label: 'A disc with an arrow' },
            ]}
            onChange={set(['chrome', 'cursor', 'linkedMedia'])}
          />
          {chrome?.cursor?.linkedMedia === 'arrow' && (
            <>
              <NumberField label="The disc’s size" hint="px" min={24} max={160} placeholder="64" value={chrome?.cursor?.discSize} onChange={set(['chrome', 'cursor', 'discSize'])} />
              <TextField label="The disc’s colour" hint="a colour — empty is the text colour at 20%" value={chrome?.cursor?.discColor} maxLength={60} placeholder="rgba(255,255,255,0.2)" onChange={set(['chrome', 'cursor', 'discColor'])} />
            </>
          )}
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
          {/* 3.22 */}
          <Check label="The first page of a visit arrives the same way" value={chrome?.transition?.firstLoad} onChange={set(['chrome', 'transition', 'firstLoad'])} />
          <ChoiceField
            label="A page leaves"
            value={chrome?.transition?.leave}
            inherited="fade"
            options={[
              { value: 'fade', label: 'Fading out' },
              { value: 'fadeUp', label: 'Fading and moving up, as long as it arrives' },
            ]}
            onChange={set(['chrome', 'transition', 'leave'])}
          />
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
                {/* 3.22 — how they read. */}
                <ChoiceField label="Face" value={rails?.font} inherited="label" options={[{ value: 'label', label: 'The labels’ (Typography → Labels)' }, { value: 'body', label: 'The text’s' }, { value: 'display', label: 'The headings’' }]} onChange={set(railsAt('font'))} />
                <ChoiceField label="Letters" value={rails?.case} inherited="label" options={[{ value: 'label', label: 'As the labels' }, { value: 'upper', label: 'Capitals' }, { value: 'none', label: 'As written' }]} onChange={set(railsAt('case'))} />
                <NumberField label="Size" hint="px" min={8} max={24} placeholder="11" value={rails?.size} onChange={set(railsAt('size'))} />
                <ChoiceField label="Weight" value={rails?.weight} options={['400', '500', '600', '700'].map((value) => ({ value, label: value }))} onChange={set(railsAt('weight'))} />
                <ChoiceField label="Between the links" value={rails?.separator} inherited="none" options={[{ value: 'none', label: 'Nothing' }, { value: 'slash', label: 'A slash — Lk. / Be.' }, { value: 'dot', label: 'A dot' }]} onChange={set(railsAt('separator'))} />
                <ChoiceField label="Where" value={rails?.position} inherited="center" options={[{ value: 'center', label: 'Middle of the screen' }, { value: 'bottom', label: 'Bottom of the screen' }]} onChange={set(railsAt('position'))} />
                <Field label="Networks on the rail" hint="none ticked shows every social link">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {SOCIAL_NETWORKS.map((network) => {
                      const list = rails?.networks ?? [];
                      return (
                        <label key={network} className="flex items-center gap-1.5 text-[13px] text-ash">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-flare"
                            checked={list.includes(network)}
                            onChange={(e) => {
                              const next = e.target.checked ? [...list, network] : list.filter((n) => n !== network);
                              set(railsAt('networks'))(next.length ? next : undefined);
                            }}
                          />
                          {SOCIAL_LABELS[network]}
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <ChoiceField label="Written" value={rails?.orientation} inherited="stacked" options={[{ value: 'stacked', label: 'Each part stacked' }, { value: 'row', label: 'One line up the edge' }]} onChange={set(railsAt('orientation'))} />
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
