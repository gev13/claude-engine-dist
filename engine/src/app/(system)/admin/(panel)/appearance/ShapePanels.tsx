'use client';

import { useId } from 'react';
import { CornerShapeFields } from '@/components/admin/CornerShapeFields';
import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import { Field, Input, Panel } from '@/components/admin/ui';
import { FONT_GROUPS } from '@/lib/fonts';
import type { CornerShape } from '@/lib/shape';
import type { Theme } from '@/lib/theme';
import { CUT_SIZES } from '@/lib/theme-css';

/* ═══════════════════════════════════════════════════════════════════════════
   Appearance: corners, panels, button extras, the eyebrow marker and the
   header's links (2.21)
   ───────────────────────────────────────────────────────────────────────────
   Every control starts at "as it always was" and writes nothing until
   changed, so an untouched theme row stays untouched.
   ═══════════════════════════════════════════════════════════════════════════ */

type Setter = (path: readonly (string | number)[]) => (value: unknown) => void;
type Props = { theme: Theme; set: Setter };

const SHAPE_KINDS: { key: keyof NonNullable<Theme['shape']>; label: string; hint: string }[] = [
  { key: 'cards', label: 'Cards', hint: 'every card, tile and card picture in the blocks' },
  { key: 'buttons', label: 'Buttons', hint: 'all buttons except text links' },
  { key: 'inputs', label: 'Form fields', hint: 'text fields and message boxes' },
  { key: 'chips', label: 'Chips', hint: 'form choices, blog categories and project filters' },
  { key: 'images', label: 'Pictures', hint: 'image blocks set to Cut corners' },
];

/** Appearance → Shape: the corners of each kind of element. */
export function ShapePanel({ theme, set }: Props) {
  return (
    <Panel title="Corners">
      <div className="space-y-6">
        {SHAPE_KINDS.map((kind) => (
          <div key={kind.key} className="border-b-2 border-hairline pb-5 last:border-0 last:pb-0">
            <CornerShapeFields
              label={kind.label}
              value={theme.shape?.[kind.key] as CornerShape | undefined}
              fallbackSize={CUT_SIZES[kind.key]}
              onChange={set(['shape', kind.key])}
            />
            <p className="m-0 mt-2 text-[12px] text-smoke">{kind.hint}</p>
          </div>
        ))}
        <p className="m-0 text-[12px] text-smoke">
          A section’s own corners are set in its Design tab. A cut button keeps its glow; a cut card clips its picture.
        </p>
      </div>
    </Panel>
  );
}

/** Appearance → Shape: what a section marked Panel looks like. */
export function PanelSettingsPanel({ theme, set }: Props) {
  const panel = theme.panel ?? {};
  return (
    <Panel title="Panels">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <LengthField label="Inset from the page edge" value={panel.inset} placeholder="24px" onChange={set(['panel', 'inset'])} />
          <LengthField label="Space between panels" value={panel.gap} placeholder="24px" onChange={set(['panel', 'gap'])} />
          <ColorField label="Panel colour" value={panel.background} placeholder="the surface colour" onChange={set(['panel', 'background'])} />
        </div>
        <CornerShapeFields label="Panel corners" value={panel.shape} fallbackSize={CUT_SIZES.panel} onChange={set(['panel', 'shape'])} roundedLabel="Square" />
        <label className="flex items-center gap-2.5 text-[14px] text-ash">
          <input
            type="checkbox"
            className="h-4 w-4 accent-flare"
            checked={panel.alignContent === true}
            onChange={(e) => set(['panel', 'alignContent'])(e.target.checked || undefined)}
          />
          Line up a panel’s content with the content outside panels
        </label>
        <p className="m-0 text-[12px] text-smoke">
          Tick <strong className="text-bone">Panel</strong> in a section’s Design tab to set it on the page like this. The page
          around the panels is the page colour (Colours → Background). The inset shrinks on small screens by itself.
        </p>
      </div>
    </Panel>
  );
}

/** Appearance → Buttons: the face, the glow and where the arrow sits. */
export function ButtonExtrasPanel({ theme, set }: Props) {
  const id = useId();
  const buttons = theme.buttons ?? {};
  return (
    <Panel title="Face, glow, arrows and links">
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField label="Button font" value={buttons.font} inherited="mono" groups={FONT_GROUPS} onChange={set(['buttons', 'font'])} />
        <ChoiceField
          label="The arrow"
          value={buttons.icon}
          inherited="inline"
          options={[
            { value: 'inline', label: 'Beside the label' },
            { value: 'cell', label: 'In a compartment of its own' },
          ]}
          onChange={set(['buttons', 'icon'])}
        />
        <Field label="Glow round the main button" hint="px — 0 or empty for none" htmlFor={`${id}-glow`}>
          <Input
            id={`${id}-glow`}
            type="number"
            min={0}
            max={60}
            placeholder="0"
            value={buttons.glow?.size ?? ''}
            onChange={(e) => set(['buttons', 'glow', 'size'])(e.target.value === '' ? undefined : Math.min(60, Math.max(0, Math.round(Number(e.target.value) || 0))))}
          />
        </Field>
        <ColorField label="Glow colour" value={buttons.glow?.color} placeholder="the button’s own, softened" onChange={set(['buttons', 'glow', 'color'])} />
        <ChoiceField
          label="“Read more” links"
          value={buttons.more}
          inherited="arrow"
          options={[
            { value: 'arrow', label: 'Text and an arrow' },
            { value: 'circle', label: 'Text and an arrow on a circle' },
          ]}
          onChange={set(['buttons', 'more'])}
        />
      </div>
    </Panel>
  );
}

/** Appearance → Typography: the marker in front of each section's small label. */
export function EyebrowMarkerPanel({ theme, set }: Props) {
  return (
    <Panel title="Section label marker">
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          label="In front of a section’s small label"
          value={theme.eyebrow?.marker}
          inherited="rule"
          options={[
            { value: 'rule', label: 'A short line' },
            { value: 'dot', label: 'A dot' },
            { value: 'none', label: 'Nothing' },
          ]}
          onChange={set(['eyebrow', 'marker'])}
        />
        <ColorField label="Marker colour" value={theme.eyebrow?.markerColor} placeholder="the accent" onChange={set(['eyebrow', 'markerColor'])} />
      </div>
    </Panel>
  );
}

/** Appearance → Header & menus: how the header's links are set. */
export function NavTypePanel({ theme, set }: Props) {
  const nav = theme.nav ?? {};
  return (
    <Panel title="Header links">
      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceField label="Font" value={nav.font} inherited="mono" groups={FONT_GROUPS} onChange={set(['nav', 'font'])} />
        <LengthField label="Size" value={nav.size} placeholder="11px" onChange={set(['nav', 'size'])} />
        <ChoiceField
          label="Weight"
          value={nav.weight}
          inherited="400"
          options={(['300', '400', '500', '600', '700'] as const).map((value) => ({ value, label: value }))}
          onChange={set(['nav', 'weight'])}
        />
        <ChoiceField
          label="Case"
          value={nav.transform}
          inherited="uppercase"
          options={[
            { value: 'uppercase', label: 'CAPITALS' },
            { value: 'none', label: 'As typed' },
            { value: 'capitalize', label: 'Each Word' },
            { value: 'lowercase', label: 'lower case' },
          ]}
          onChange={set(['nav', 'transform'])}
        />
        <LengthField label="Letter spacing" value={nav.letterSpacing} placeholder="0.12em" onChange={set(['nav', 'letterSpacing'])} />
        <LengthField label="Space between links" value={nav.gap} placeholder="2px" onChange={set(['nav', 'gap'])} />
        <ColorField label="Link colour" value={nav.color} placeholder="the header’s text" onChange={set(['nav', 'color'])} />
        <ColorField label="Current and hovered" value={nav.activeColor} placeholder="the soft accent" onChange={set(['nav', 'activeColor'])} />
      </div>
    </Panel>
  );
}
