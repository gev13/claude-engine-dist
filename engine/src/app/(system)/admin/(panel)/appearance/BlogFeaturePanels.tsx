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

/** An object with its unset keys dropped, or undefined when nothing is left. */
function tidy<T extends Record<string, unknown>>(value: T): T | undefined {
  const next = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(next).length ? next : undefined;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="That line’s style"
            value={blog?.eyebrowStyle}
            options={[
              ['rule', 'After a short rule'],
              ['chip', 'The category as a chip (linking to it), the rest beside it'],
              ['plain', 'Text alone'],
            ]}
            onChange={set(['blog', 'eyebrowStyle'])}
          />
          <Field label="The full-width cover’s height" hint="e.g. 600px; empty is the picture’s own shape">
            <Input value={blog?.coverHeight ?? ''} placeholder="600px" maxLength={40} onChange={(e) => set(['blog', 'coverHeight'])(e.target.value.trim() || undefined)} />
          </Field>
          <Field label="— on phones">
            <Input value={blog?.coverHeightMobile ?? ''} placeholder="as above" maxLength={40} onChange={(e) => set(['blog', 'coverHeightMobile'])(e.target.value.trim() || undefined)} />
          </Field>
          <Field label="Cover, then a title card: overlap" hint="how far the card rides up over the cover; 0 starts it right under; empty is 48–120px">
            <Input value={blog?.coverOverlap ?? ''} placeholder="e.g. 80px or 0" maxLength={40} onChange={(e) => set(['blog', 'coverOverlap'])(e.target.value.trim() || undefined)} />
          </Field>
        </div>
        <Check label="“Back to the blog” above the title" checked={blog?.backLink === true} onChange={(v) => set(['blog', 'backLink'])(v || undefined)} />
        <Check label="The excerpt under the title" checked={blog?.excerpt !== false} onChange={(v) => set(['blog', 'excerpt'])(v ? undefined : false)} />
        <div>
          <Check
            label="A row under the title — author, reading time, categories"
            checked={blog?.meta?.off !== true}
            onChange={(v) => set(['blog', 'meta'])(tidy({ ...blog?.meta, off: v ? undefined : true }))}
          />
          {blog?.meta?.off !== true && (
            <div className="mt-2 flex flex-wrap gap-4 pl-6">
              {(['author', 'readingTime', 'categories'] as const).map((part) => (
                <Check
                  key={part}
                  label={{ author: 'The author', readingTime: 'The reading time', categories: 'The categories' }[part]}
                  checked={blog?.meta?.[part] !== false}
                  onChange={(v) => set(['blog', 'meta'])(tidy({ ...blog?.meta, [part]: v ? undefined : false }))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="Share buttons"
            value={share?.position}
            options={[
              ['off', 'None'],
              ['top', 'Above the article'],
              ['bottom', 'Below the article'],
              ['side', 'A bar down the left side (wide screens)'],
              ['beside', 'A column beside the article that follows the reader'],
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
          <Field label="Networks" hint="in the order they are shown; a new one is added at the end">
            {/* 3.22 — the order is the one chosen, not the list's own. */}
            <ol className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
              {networks.map((network, i) => (
                <li key={network} className="flex items-center gap-1 border-2 border-hairline px-2 py-1 text-[13px] text-bone">
                  {SHARE_LABELS[network]}
                  <button type="button" className="px-1 text-smoke hover:text-bone disabled:opacity-30" aria-label={`Move ${SHARE_LABELS[network]} earlier`} disabled={i === 0} onClick={() => set(['blog', 'share'])({ ...share, networks: move(networks, i, i - 1) })}>
                    ‹
                  </button>
                  <button type="button" className="px-1 text-smoke hover:text-bone disabled:opacity-30" aria-label={`Move ${SHARE_LABELS[network]} later`} disabled={i === networks.length - 1} onClick={() => set(['blog', 'share'])({ ...share, networks: move(networks, i, i + 1) })}>
                    ›
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-4">
              {SHARE_NETWORKS.filter((n) => n !== 'native').map((network) => (
                <label key={network} className="flex items-center gap-2 text-[13px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={networks.includes(network)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...networks, network] : networks.filter((n) => n !== network);
                      if (next.length) set(['blog', 'share'])({ ...share, networks: next });
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
          {blog?.prevNext === 'floating' && (
            <div className="flex flex-col justify-end gap-2 sm:col-span-2">
              <Check label="The corner card on phones too" checked={blog?.upNext?.phones === true} onChange={(v) => set(['blog', 'upNext'])(tidy({ ...blog?.upNext, phones: v || undefined }))} />
              <Check
                label="Closing it hides it on this post only (not for the rest of the visit)"
                checked={blog?.upNext?.dismiss === 'post'}
                onChange={(v) => set(['blog', 'upNext'])(tidy({ ...blog?.upNext, dismiss: v ? 'post' : undefined }))}
              />
            </div>
          )}
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
            {(blog?.related?.layout ?? 'grid') === 'grid' && (
              <Choice
                label="Cards"
                hint="the archive’s cards follow Blog navigation and cards below"
                value={blog?.related?.cards}
                options={[['text', 'Text cards (as before)'], ['archive', 'The archive’s cards — pictures, date, reading time']]}
                onChange={(cards) => set(['blog', 'related'])({ source: 'kind', count: 3, layout: 'grid', ...blog?.related, cards })}
              />
            )}
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
        {/* 3.6 — the whole blog hidden, nothing deleted. */}
        <Check
          label="Switch the blog off — its index, categories, posts, search and feeds answer “not found” until it is switched back on"
          checked={blog?.off === true}
          onChange={(v) => set(['blog', 'off'])(v || undefined)}
        />
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
        <Check label="No search box on the blog’s pages" checked={blog?.searchOff === true} onChange={(v) => set(['blog', 'searchOff'])(v || undefined)} />
        {blog?.searchOff !== true && (
          <Check label="The search box at the end of the category bar" checked={blog?.searchInBar === true} onChange={(v) => set(['blog', 'searchInBar'])(v || undefined)} />
        )}
        {blog?.searchInBar === true && (
          <Check label="…on its own row under the chips" checked={blog?.searchBelow === true} onChange={(v) => set(['blog', 'searchBelow'])(v || undefined)} />
        )}
        <Check label="The category bar on every category and research page too" checked={blog?.archiveBar === true} onChange={(v) => set(['blog', 'archiveBar'])(v || undefined)} />
        <Check
          label="One row under the title — breadcrumbs on the left; the result count and the categories on the right"
          checked={blog?.toolbar === true}
          onChange={(v) => set(['blog', 'toolbar'])(v || undefined)}
        />
        <Check label="The “Browse” label before the chips" checked={blog?.browseLabel !== false} onChange={(v) => set(['blog', 'browseLabel'])(v ? undefined : false)} />
        <Check label="The newest post as a large card — picture left — above the list" checked={blog?.featured === true} onChange={(v) => set(['blog', 'featured'])(v || undefined)} />
        <Choice
          label="A category’s label"
          hint="“Category” is a Site translation"
          value={blog?.categoryLabel}
          options={[
            ['eyebrow', 'The blog’s name above the title (as before)'],
            ['subtitle', '“Category” under the title'],
            ['none', 'Neither'],
          ]}
          onChange={set(['blog', 'categoryLabel'])}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="The blog’s search title" hint="used when no page stands at the blog’s address">
            <Input value={blog?.indexSeo?.title ?? ''} maxLength={300} onChange={(e) => set(['blog', 'indexSeo'])(tidy({ ...blog?.indexSeo, title: e.target.value || undefined }))} />
          </Field>
          <Field label="The blog’s search description">
            <Input value={blog?.indexSeo?.description ?? ''} maxLength={1000} onChange={(e) => set(['blog', 'indexSeo'])(tidy({ ...blog?.indexSeo, description: e.target.value || undefined }))} />
          </Field>
        </div>
        <Check
          label="That title exactly as written, without the site’s name after it"
          checked={blog?.indexSeo?.exactTitle === true}
          onChange={(v) => set(['blog', 'indexSeo'])(tidy({ ...blog?.indexSeo, exactTitle: v || undefined }))}
        />
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
            <Check label="The cover (the card grid)" checked={card.image === true} onChange={(v) => setCard('image', v || undefined)} />
            <Check label="The excerpt" checked={card.excerpt !== false} onChange={(v) => setCard('excerpt', v ? undefined : false)} />
            <Check label="The category as a chip under the title" checked={card.categoryPlace === 'under'} onChange={(v) => setCard('categoryPlace', v ? 'under' : undefined)} />

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
