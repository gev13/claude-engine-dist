'use client';

import Link from 'next/link';
import { CardHoverFields } from '@/components/admin/CardHoverFields';
import { Field, Input, Panel, Select } from '@/components/admin/ui';
import type { BlogSettings } from '@/lib/blog';
import { SHARE_LABELS, SHARE_NETWORKS, type ShareNetwork } from '@/lib/share';

/* ═══════════════════════════════════════════════════════════════════════════
   Appearance → Blog: a post's extras and the archives' options (T19/T20, 2.18)
   ───────────────────────────────────────────────────────────────────────────
   Every control starts at "as it always was" — its first option — and
   writes nothing until changed, so an untouched theme row stays untouched.
   ═══════════════════════════════════════════════════════════════════════════ */

type Setter = (path: string[]) => (value: unknown) => void;

function Choice({ label, hint, value, options, onChange }: { label: string; hint?: string; value: string | undefined; options: [string, string][]; onChange: (value: string | undefined) => void }) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value ?? options[0]![0]} onChange={(e) => onChange(e.target.value === options[0]![0] ? undefined : e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function PostFeaturesPanel({ blog, set }: { blog: BlogSettings | undefined; set: Setter }) {
  const share = blog?.share;
  const networks = share?.networks ?? (['facebook', 'x', 'pinterest', 'linkedin'] as ShareNetwork[]);
  return (
    <Panel title="Around each post">
      <div className="space-y-5">
        <Field label="Above the title" hint="the line with the category and date; {category}, {date} and {minutes} are filled in">
          <Input value={blog?.eyebrow ?? ''} placeholder="{category} — {date}" maxLength={80} onChange={(e) => set(['blog', 'eyebrow'])(e.target.value || undefined)} />
        </Field>
        <Check label="“Back to the blog” above the title" checked={blog?.backLink === true} onChange={(v) => set(['blog', 'backLink'])(v || undefined)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="Share buttons"
            value={share?.position}
            options={[
              ['off', 'None'],
              ['top', 'Above the article'],
              ['bottom', 'Below the article'],
              ['side', 'A bar down the left side (wide screens)'],
            ]}
            onChange={(position) => set(['blog', 'share'])(position ? { ...share, position } : undefined)}
          />
          <Choice
            label="Contents"
            hint="the article’s headings, the current one marked"
            value={blog?.toc?.position}
            options={[
              ['off', 'None'],
              ['left', 'A column on the left that follows the reader'],
              ['right', 'A column on the right that follows the reader'],
              ['top', 'A list above the article'],
            ]}
            onChange={(position) => set(['blog', 'toc'])(position ? { levels: 'h2h3', ...blog?.toc, position } : undefined)}
          />
        </div>
        {share?.position && share.position !== 'off' && (
          <Field label="Networks">
            <div className="flex flex-wrap gap-4">
              {SHARE_NETWORKS.filter((n) => n !== 'native').map((network) => (
                <label key={network} className="flex items-center gap-2 text-[13px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={networks.includes(network)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...networks, network] : networks.filter((n) => n !== network);
                      if (next.length) set(['blog', 'share'])({ ...share, networks: SHARE_NETWORKS.filter((n) => next.includes(n)) });
                    }}
                  />
                  {SHARE_LABELS[network]}
                </label>
              ))}
            </div>
          </Field>
        )}
        {blog?.toc?.position && blog.toc.position !== 'off' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contents heading">
              <Input value={blog.toc.title ?? ''} placeholder="On this page" maxLength={80} onChange={(e) => set(['blog', 'toc'])({ ...blog.toc, title: e.target.value || undefined })} />
            </Field>
            <Choice label="Headings listed" value={blog.toc.levels} options={[['h2h3', 'Sections and subsections'], ['h2', 'Sections only']]} onChange={(levels) => set(['blog', 'toc'])({ ...blog.toc, levels: levels ?? 'h2h3' })} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="Previous and next"
            value={blog?.prevNext}
            options={[
              ['off', 'None'],
              ['bottom', 'Two links under the article'],
              ['floating', 'A card in the corner (wide screens)'],
            ]}
            onChange={(value) => set(['blog', 'prevNext'])(value)}
          />
          <Choice
            label="Keep reading"
            value={blog?.related?.source}
            options={[
              ['kind', 'Latest of the same kind (as before)'],
              ['primary', 'From the post’s main category'],
              ['any', 'From any category it shares'],
              ['off', 'None'],
            ]}
            onChange={(source) => set(['blog', 'related'])(source ? { count: 3, layout: 'grid', ...blog?.related, source } : blog?.related?.count || blog?.related?.layout ? { ...blog?.related, source: 'kind' } : undefined)}
          />
        </div>
        {blog?.related?.source !== 'off' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Choice
              label="How many"
              value={blog?.related?.count ? String(blog.related.count) : undefined}
              options={[['3', 'Three'], ['2', 'Two'], ['4', 'Four'], ['6', 'Six']]}
              onChange={(value) => set(['blog', 'related'])({ source: 'kind', layout: 'grid', ...blog?.related, count: Number(value ?? 3) })}
            />
            <Choice
              label="As"
              value={blog?.related?.layout}
              options={[['grid', 'A grid of cards'], ['carousel', 'A carousel']]}
              onChange={(value) => set(['blog', 'related'])({ source: 'kind', count: 3, ...blog?.related, layout: value ?? 'grid' })}
            />
            <Field label="Heading">
              <Input value={blog?.related?.title ?? ''} placeholder="Keep reading" maxLength={80} onChange={(e) => set(['blog', 'related'])({ source: 'kind', count: 3, layout: 'grid', ...blog?.related, title: e.target.value || undefined })} />
            </Field>
          </div>
        )}
        <Check label="An author box under the article — picture, bio and links from each author’s Profile" checked={blog?.authorBox === true} onChange={(v) => set(['blog', 'authorBox'])(v || undefined)} />
      </div>
    </Panel>
  );
}

export function ArchiveFeaturesPanel({ blog, set }: { blog: BlogSettings | undefined; set: Setter }) {
  const card = blog?.card ?? {};
  const setCard = (key: keyof NonNullable<BlogSettings['card']>, value: unknown) => {
    const next = { ...card, [key]: value };
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] === undefined) delete next[k];
    set(['blog', 'card'])(Object.keys(next).length ? next : undefined);
  };
  return (
    <Panel title="Blog navigation and cards">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice label="Categories" value={blog?.filterStyle} options={[['chips', 'A row of chips'], ['dropdown', 'One “Categories” menu']]} onChange={set(['blog', 'filterStyle'])} />
          <Choice
            label="The Research chip"
            value={blog?.chipResearch}
            options={[
              ['auto', 'Only when there is research'],
              ['show', 'Always'],
              ['hide', 'Never'],
            ]}
            onChange={set(['blog', 'chipResearch'])}
          />
        </div>
        <Check label="An “All” chip" checked={blog?.chipAll !== false} onChange={(v) => set(['blog', 'chipAll'])(v ? undefined : false)} />
        <Check label="Breadcrumbs above the title — Home › Blog › Category" checked={blog?.archiveBreadcrumbs === true} onChange={(v) => set(['blog', 'archiveBreadcrumbs'])(v || undefined)} />
        <Check label="The search box at the end of the category bar" checked={blog?.searchInBar === true} onChange={(v) => set(['blog', 'searchInBar'])(v || undefined)} />
        <Check label="The newest post as a large card — picture left — above the list" checked={blog?.featured === true} onChange={(v) => set(['blog', 'featured'])(v || undefined)} />
        <Choice
          label="A category’s heading"
          hint="the picture is set with each category"
          value={blog?.categoryHero}
          options={[
            ['title', 'Its name and description'],
            ['full', 'With its picture beside them'],
          ]}
          onChange={set(['blog', 'categoryHero'])}
        />
        <p className="m-0 text-[12px] text-smoke">
          Blocks above and below every category’s posts are under{' '}
          <Link href="/admin/posts/archive" className="text-flare-soft">
            Posts → Category pages
          </Link>
          . Each category and the whole blog have an RSS feed, set under Permalinks.
        </p>

        <div className="border-t-2 border-hairline pt-5">
          <p className="m-0 mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Each card shows</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Check label="The date" checked={card.date !== false} onChange={(v) => setCard('date', v ? undefined : false)} />

            <Check label="The reading time" checked={card.readingTime === true} onChange={(v) => setCard('readingTime', v || undefined)} />
            <Check label="“Read more →”" checked={card.readMore === true} onChange={(v) => setCard('readMore', v || undefined)} />
          </div>
          <div className="mt-3 grid max-w-[600px] gap-4 sm:grid-cols-2">
            <Choice
              label="The category"
              hint="the card grid leaves it out, the other layouts show it"
              value={card.category === true ? 'show' : card.category === false ? 'hide' : undefined}
              options={[['', 'As the layout draws it'], ['show', 'Show it'], ['hide', 'Leave it out']]}
              onChange={(value) => setCard('category', value === 'show' ? true : value === 'hide' ? false : undefined)}
            />
            <Choice
              label="Picture shape"
              hint="the layouts with pictures"
              value={card.ratio}
              options={[['', 'As the layout draws it'], ['16/9', 'Wide 16:9'], ['3/2', '3:2'], ['4/3', '4:3'], ['1/1', 'Square']]}
              onChange={(value) => setCard('ratio', value || undefined)}
            />
          </div>
          <div className="mt-4 max-w-[600px]">
            <CardHoverFields value={card.hover} onChange={(hover) => setCard('hover', hover)} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
