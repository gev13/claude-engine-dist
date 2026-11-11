'use client';

import { Field, Input, Panel } from '@/components/admin/ui';
import { ChoiceField, LengthField } from '@/components/admin/styleFields';
import { TypeStyleFields as TypeFields } from '@/components/admin/TypeStyleFields';
import { useSavedBlocks } from '@/components/admin/SavedBlocksTools';
import { DETAIL_KEYS, type CareersLook, type DetailKey } from '@/lib/careersLook';

/**
 * 3.29 — Appearance → Careers: how the listing, the advert and the
 * application form are drawn. Every control starts at what the pages already
 * draw and writes nothing until changed.
 */

type Setter = (path: readonly (string | number)[]) => (value: unknown) => void;

function Check({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (next: boolean | undefined) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-[14px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={value === true} onChange={(e) => onChange(e.target.checked || undefined)} />
      {label}
    </label>
  );
}

type TextKey = { [K in keyof CareersLook]-?: NonNullable<CareersLook[K]> extends string ? K : never }[keyof CareersLook];
type RowDef = [key: TextKey, label: string, hint?: string];

const LISTING: RowDef[] = [
  ['sectionBackground', 'Section colour', 'a colour, or transparent'],
  ['sectionBackgroundMobile', 'Section colour on phones', 'a colour, or transparent'],
  ['sectionRadius', 'Corners', 'one to four, e.g. 0 0 0 60px'],
  ['sectionRadiusMobile', 'Corners on phones'],
  ['sectionMargin', 'Margin', 'one to four'],
  ['sectionMarginMobile', 'Margin on phones'],
  ['sectionPadding', 'Padding', 'one to four'],
  ['sectionPaddingMobile', 'Padding on phones'],
];
const CARDS: RowDef[] = [
  ['cardBackground', 'Card colour', 'a colour, or transparent'],
  ['cardBackgroundMobile', 'Card colour on phones'],
  ['cardShadow', 'Shadow', 'e.g. 18px 17px 54px rgba(0,0,0,0.1)'],
  ['cardMinHeight', 'Least height'],
  ['cardMinHeightMobile', 'Least height on phones'],
  ['cardPadding', 'Padding', 'one to four'],
  ['cardPaddingMobile', 'Padding on phones'],
  ['cardGap', 'Space between cards'],
  ['cardPartGap', 'Space between a card’s parts'],
  ['cardFootGap', 'Space in its foot'],
  ['cardFootSpace', 'Space above its foot'],
  ['titleHoverColor', 'Title under the pointer'],
  ['buttonFill', 'Button fill'],
  ['buttonText', 'Button words'],
  ['buttonRadius', 'Button corners', 'one to four, e.g. 0 16px 0 16px'],
  ['buttonPadding', 'Button padding', 'e.g. 14px 20px'],
  ['buttonGap', 'Space beside its arrow'],
];
const ADVERT: RowDef[] = [
  ['advertColumns', 'The two columns', 'e.g. 744fr 572fr'],
  ['columnsGap', 'Space between them'],
  ['columnsGapMobile', 'Space on phones'],
  ['stickyTop', 'Sticks this far from the top'],
  ['advertPadding', 'Section padding', 'one to four'],
  ['advertPaddingMobile', 'Section padding on phones'],
  ['titleGap', 'Space under the title'],
  ['titleInset', 'Title inset at the sides'],
  ['panelBackground', 'Panel colour', 'a colour, or transparent'],
  ['panelBackgroundMobile', 'Panel colour on phones'],
  ['panelRadius', 'Panel corners', 'one to four'],
  ['panelRadiusMobile', 'Panel corners on phones'],
  ['panelPadding', 'Panel padding', 'one to four'],
  ['panelPaddingMobile', 'Panel padding on phones'],
  ['panelTop', 'Space above the panel', 'the centred layout'],
  ['sideTop', 'Space above the side column', 'the centred layout'],
  ['sectionsGap', 'Space above each section'],
  ['headingsGap', 'Space under each heading'],
  ['paragraphGap', 'Space between paragraphs'],
  ['datesGap', 'Space above the dates'],
  ['detailsGap', 'Space between the details'],
  ['detailsInset', 'Details inset at the sides'],
  ['iconColor', 'Icon colour'],
  ['coverPosition', 'Cover’s crop', 'e.g. 72% 50% or center top'],
  ['coverPositionMobile', 'Cover’s crop on phones'],
  ['coverRadius', 'Cover’s corners', 'one to four'],
  ['coverRadiusMobile', 'Cover’s corners on phones'],
  ['coverGap', 'Space above the cover'],
];
const APPLY: RowDef[] = [
  ['applyBackground', 'Card colour', 'a colour, or transparent'],
  ['applyBackgroundMobile', 'Card colour on phones'],
  ['applyRadius', 'Corners', 'one to four'],
  ['applyRadiusMobile', 'Corners on phones'],
  ['applyPadding', 'Padding', 'one to four'],
  ['applyPaddingMobile', 'Padding on phones'],
  ['applyTop', 'Space above it'],
  ['groupGap', 'Space under a group label'],
  /* 3.33.1 */
  ['dropBorder', 'Drop zone’s edge', 'e.g. 1.5px dashed #123456'],
  ['dropFill', 'Drop zone’s fill', 'a colour, or transparent'],
  ['dropText', 'Drop zone’s words'],
  ['dropRadius', 'Drop zone’s corners', 'one to four'],
];

/** 3.33 — many small fields, all alike: a value typed in, checked when saved. */
function Rows({ careers, set, defs }: { careers: CareersLook | undefined; set: Setter; defs: RowDef[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {defs.map(([key, label, hint]) => (
        <Field key={key} label={label} hint={hint}>
          <Input value={(careers?.[key] as string | undefined) ?? ''} placeholder="as drawn" spellCheck={false} onChange={(e) => set(['careers', key])(e.target.value.trim() || undefined)} />
        </Field>
      ))}
    </div>
  );
}

export function CareersPanel({ careers, set }: { careers: CareersLook | undefined; set: Setter }) {
  const at = (key: string) => ['careers', key] as const;
  const saved = useSavedBlocks();
  const synced = (saved.items ?? []).filter((item) => item.mode === 'synced');
  return (
    <>
      <Panel title="The listing">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceField
              label="Roles drawn as"
              value={careers?.list}
              inherited="rows"
              options={[
                { value: 'rows', label: 'Rows — title, excerpt, details; open or closed beside' },
                { value: 'cards', label: 'Cards in a grid' },
              ]}
              onChange={set(at('list'))}
            />
            {careers?.list === 'cards' && (
              <ChoiceField
                label="Cards to a row"
                value={careers?.columns ? String(careers.columns) : undefined}
                inherited="3"
                options={[
                  { value: '2', label: 'Two' },
                  { value: '3', label: 'Three' },
                ]}
                onChange={(value) => set(at('columns'))(value === '2' ? 2 : value === '3' ? 3 : undefined)}
              />
            )}
          </div>
          {careers?.list === 'cards' && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Check label="LOCATION · WORKING TIME above each title" value={careers?.kicker} onChange={set(at('kicker'))} />
              <Check label="A button to the advert on each card" value={careers?.button} onChange={set(at('button'))} />
            </div>
          )}
          <p className="m-0 text-[12px] text-smoke">A page at /careers puts its own blocks above the roles — the heading and the words over them are its blocks.</p>
        </div>
      </Panel>
      <Panel title="The advert">
        <div className="space-y-4">
          <ChoiceField
            label="Layout"
            value={careers?.page}
            inherited="standard"
            options={[
              { value: 'standard', label: 'Standard — the details, the text, then the form' },
              { value: 'aside', label: 'The title and cover on the left, a panel with everything else on the right' },
              { value: 'centered', label: 'The heading centred over two columns: the text in a panel, the details above the cover' },
            ]}
            onChange={set(at('page'))}
          />
          <Check label="An icon beside each detail (location, contract, working time…)" value={careers?.icons} onChange={set(at('icons'))} />
          <label className="grid gap-1.5 text-[13px] text-ash">
            After every advert
            <select
              className="h-10 border-2 border-hairline bg-ink px-3 text-[14px] text-bone"
              value={careers?.afterSavedBlock ?? ''}
              onChange={(e) => set(at('afterSavedBlock'))(e.target.value || undefined)}
            >
              <option value="">Nothing</option>
              {synced.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-smoke">a synced saved block — a closing band, say</span>
          </label>
        </div>
      </Panel>
      <Panel title="Type">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="m-0 text-[13px] text-bone">A role’s title in the listing</p>
            <TypeFields type={careers?.cardTitle} set={(key) => set(['careers', 'cardTitle', key])} />
          </div>
          <div className="space-y-2">
            <p className="m-0 text-[13px] text-bone">The advert’s headings — about the role, responsibilities, what we offer</p>
            <TypeFields type={careers?.headings} set={(key) => set(['careers', 'headings', key])} />
          </div>
          <p className="m-0 text-[12px] text-smoke">Each field left empty keeps the drawn look.</p>
        </div>
      </Panel>
      <Panel title="The application form">
        <div className="space-y-3">
          <ChoiceField
            label="The fields"
            value={careers?.form}
            inherited="labels"
            options={[
              { value: 'labels', label: 'Labels above them' },
              { value: 'placeholders', label: 'The words inside them, three short fields to a row' },
            ]}
            onChange={set(at('form'))}
          />
          <div className="max-w-[260px]">
            <LengthField label="Space under the form’s heading" value={careers?.applyGap} placeholder="e.g. 32px" onChange={set(at('applyGap'))} />
          </div>
          <Check label="The CV as a drop zone" value={careers?.dropZone} onChange={set(at('dropZone'))} />
          <Check label="“Back to the homepage” and “Explore other jobs” under the thanks" value={careers?.doneButtons} onChange={set(at('doneButtons'))} />
          <p className="m-0 text-[12px] text-smoke">Every word on the careers pages is in Site translations, under careers.</p>
        </div>
      </Panel>
      {/* 3.33 — every field empty keeps the drawn look. */}
      <Panel title="Details — the listing">
        <Rows careers={careers} set={set} defs={LISTING} />
      </Panel>
      <Panel title="Details — the cards">
        <div className="space-y-5">
          <Rows careers={careers} set={set} defs={CARDS} />
          <Check label="The Explore button in the site’s filled look, rather than outlined" value={careers?.buttonLook === 'primary' ? true : undefined} onChange={(v) => set(at('buttonLook'))(v ? 'primary' : undefined)} />
          {(
            [
              ['kickerType', 'The line above the title'],
              ['excerptType', 'The excerpt'],
              ['postedType', '“Posted …”'],
              ['buttonType', 'The button’s words'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <p className="m-0 text-[13px] text-bone">{label}</p>
              <TypeFields type={careers?.[key]} set={(field) => set(['careers', key, field])} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Details — the advert">
        <div className="space-y-5">
          <Rows careers={careers} set={set} defs={ADVERT} />
          <Check label="The side column stays in view while the text scrolls" value={careers?.sticky} onChange={set(at('sticky'))} />
          <Check label="On phones the centred heading sits at the left" value={careers?.headLeftMobile} onChange={set(at('headLeftMobile'))} />
          {/* 3.33.1 */}
          <Field label="The details’ order" hint={`separated by commas, any of: ${DETAIL_KEYS.join(', ')}; any left out follow`}>
            <Input
              defaultValue={careers?.detailsOrder?.join(', ') ?? ''}
              placeholder="the usual order"
              spellCheck={false}
              onBlur={(e) => {
                const list = [...new Set(e.target.value.split(',').map((key) => key.trim()))].filter((key): key is DetailKey => (DETAIL_KEYS as readonly string[]).includes(key));
                set(at('detailsOrder'))(list.length ? list : undefined);
              }}
            />
          </Field>
          <ChoiceField
            label="Details per row on phones"
            value={careers?.detailsColumnsMobile ? String(careers.detailsColumnsMobile) : undefined}
            options={[
              { value: '1', label: 'One' },
              { value: '2', label: 'Two' },
            ]}
            onChange={(value) => set(at('detailsColumnsMobile'))(value === '1' ? 1 : value === '2' ? 2 : undefined)}
          />
          {(
            [
              ['titleType', 'The title'],
              ['eyebrowType', 'The line above the centred title (its words are in Site translations, careers.hiring)'],
              ['bodyType', 'The advert’s text'],
              ['detailsType', 'The details beside their icons'],
              ['datesLabelType', '“Posted” and “Deadline”'],
              ['datesValueType', 'The dates'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <p className="m-0 text-[13px] text-bone">{label}</p>
              <TypeFields type={careers?.[key]} set={(field) => set(['careers', key, field])} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Details — the application card">
        <div className="space-y-5">
          <Rows careers={careers} set={set} defs={APPLY} />
          {/* 3.33.1 */}
          <Check label="On phones the send button is as wide as its words, at the right" value={careers?.applySubmitWidthMobile === 'own' ? true : undefined} onChange={(v) => set(at('applySubmitWidthMobile'))(v ? 'own' : undefined)} />
          {(
            [
              ['applyTitle', 'Its heading'],
              ['groupType', 'The group labels (“Contact information”)'],
              ['dropLabelType', 'The drop zone’s label'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <p className="m-0 text-[13px] text-bone">{label}</p>
              <TypeFields type={careers?.[key]} set={(field) => set(['careers', key, field])} />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
