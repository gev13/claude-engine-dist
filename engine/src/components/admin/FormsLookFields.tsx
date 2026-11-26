'use client';

import { CornerShapeFields } from '@/components/admin/CornerShapeFields';
import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';
import { TypeStyleFields } from '@/components/admin/TypeStyleFields';
import { Field, Input } from '@/components/admin/ui';
import type { CornerShape } from '@/lib/shape';
import type { TypeStyle } from '@/lib/typeStyle';

/* 3.37 — the info panel's rows and the form block's spacing. Each field
   writes its key, and removes it once emptied. */

type Props = Record<string, unknown>;
type Setter = (next: Props) => void;

function withKey(props: Props, key: string, value: unknown): Props {
  const next = { ...props };
  if (value === undefined || value === '' || value === null) delete next[key];
  else next[key] = value;
  return next;
}

const str = (props: Props, key: string) => (typeof props[key] === 'string' ? (props[key] as string) : undefined);

/** One type style, folded to nothing once its last field is emptied. */
function TypeBlock({ label, value, onChange }: { label: string; value: TypeStyle | undefined; onChange: (next: TypeStyle | undefined) => void }) {
  return (
    <div className="border-t-2 border-hairline pt-3">
      <p className="m-0 mb-2 text-[12px] text-smoke">{label}</p>
      <TypeStyleFields
        type={value}
        set={(field) => (v) => {
          const next = { ...value, [field]: v } as TypeStyle;
          for (const k of Object.keys(next) as (keyof TypeStyle)[]) if (next[k] === undefined) delete next[k];
          onChange(Object.keys(next).length ? next : undefined);
        }}
      />
    </div>
  );
}

/** The info panel's one-row-each layout: the icon, the words and the spacing. */
export function InfoPanelListFields({ props, set }: { props: Props; set: Setter }) {
  const put = (key: string) => (value: unknown) => set(withKey(props, key, value));
  return (
    <details className="border-2 border-hairline px-3">
      <summary className="cursor-pointer py-2 text-[14px] text-bone">The rows’ icons, words and spacing</summary>
      <div className="flex flex-col gap-3 pt-2 pb-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <ColorField label="Tile behind the icon" hint="transparent for none" placeholder="a faint tint of the text" value={str(props, 'iconTile')} onChange={put('iconTile')} />
          <ColorField label="Icon colour" placeholder="the body text" value={str(props, 'iconColor')} onChange={put('iconColor')} />
          <LengthField label="Icon size" placeholder="e.g. 24px" emptyLabel="20px" value={str(props, 'iconGlyph')} onChange={put('iconGlyph')} />
          <Field label="Icon line thickness" hint="0.5–4; empty is 1.4">
            <Input type="number" min={0.5} max={4} step={0.1} value={typeof props.iconStroke === 'number' ? props.iconStroke : ''} onChange={(e) => put('iconStroke')(e.target.value === '' ? undefined : Math.min(4, Math.max(0.5, Number(e.target.value) || 1.4)))} />
          </Field>
          <LengthField label="Label to value" placeholder="e.g. 12px" emptyLabel="8px" value={str(props, 'labelGap')} onChange={put('labelGap')} />
          <ChoiceField
            label="Icon beside the two lines"
            value={props.rowAlign === 'center' ? 'center' : undefined}
            inherited="start"
            options={[
              { value: 'start', label: 'At the top' },
              { value: 'center', label: 'In the middle' },
            ]}
            onChange={(v) => put('rowAlign')(v === 'center' ? 'center' : undefined)}
          />
          <LengthField label="Space between rows" placeholder="e.g. 48px" emptyLabel="40px" value={str(props, 'rowGap')} onChange={put('rowGap')} />
          <LengthField label="Space between rows on phones" placeholder="e.g. 32px" emptyLabel="as above, else 28px" value={str(props, 'rowGapMobile')} onChange={put('rowGapMobile')} />
        </div>
        <CornerShapeFields label="Tile corners" value={props.iconCorners as CornerShape | undefined} fallbackSize={8} leafSize={12} roundedLabel="As the tile is drawn" perTier onChange={put('iconCorners')} />
        <TypeBlock label="The label" value={props.labelType as TypeStyle | undefined} onChange={put('labelType')} />
        <TypeBlock label="The value" value={props.valueType as TypeStyle | undefined} onChange={put('valueType')} />
      </div>
    </details>
  );
}

/** The form block's space under its heading and above the send button. */
export function FormSpacingFields({ props, set }: { props: Props; set: Setter }) {
  const put = (key: string) => (value: unknown) => set(withKey(props, key, value));
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <LengthField label="Space under the heading" placeholder="e.g. 40px" emptyLabel="36px" value={str(props, 'titleGap')} onChange={put('titleGap')} />
      <LengthField label="— on phones" placeholder="e.g. 32px" emptyLabel="as above" value={str(props, 'titleGapMobile')} onChange={put('titleGapMobile')} />
      <LengthField label="Space above the send button" placeholder="e.g. 40px" emptyLabel="26px" value={str(props, 'submitGap')} onChange={put('submitGap')} />
      <LengthField label="— on phones" placeholder="e.g. 32px" emptyLabel="as above" value={str(props, 'submitGapMobile')} onChange={put('submitGapMobile')} />
    </div>
  );
}
