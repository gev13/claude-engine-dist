'use client';

import { Panel } from '@/components/admin/ui';
import { ChoiceField } from '@/components/admin/styleFields';
import { useSavedBlocks } from '@/components/admin/SavedBlocksTools';
import type { CareersLook } from '@/lib/careersLook';

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
          <Check label="The CV as a drop zone" value={careers?.dropZone} onChange={set(at('dropZone'))} />
          <Check label="“Back to the homepage” and “Explore other jobs” under the thanks" value={careers?.doneButtons} onChange={set(at('doneButtons'))} />
          <p className="m-0 text-[12px] text-smoke">Every word on the careers pages is in Site translations, under careers.</p>
        </div>
      </Panel>
    </>
  );
}
