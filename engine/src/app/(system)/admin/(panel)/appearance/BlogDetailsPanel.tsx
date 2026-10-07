'use client';

import { CardHoverFields } from '@/components/admin/CardHoverFields';
import { Field, Input, Panel, Select } from '@/components/admin/ui';
import type { BlogSettings } from '@/lib/blog';
import type { CardHover } from '@/lib/cardHover';

/* ═══════════════════════════════════════════════════════════════════════════
   Appearance → Blog → Details (3.28): the archive cards, an archive's head,
   filter and pager, and a post page. Every field starts empty, which keeps
   the drawn look; lib/blogCss.ts writes the CSS for what is set. Written as
   lists of fields because there are many and they are all alike.
   ═══════════════════════════════════════════════════════════════════════════ */

type Setter = (path: string[]) => (value: unknown) => void;
type FieldDef =
  | { key: string; label: string; kind: 'text'; hint?: string }
  | { key: string; label: string; kind: 'number'; min: number; max: number; hint?: string }
  | { key: string; label: string; kind: 'check' }
  | { key: string; label: string; kind: 'select'; options: [string, string][] };

const WEIGHTS: [string, string][] = ['300', '400', '500', '600', '700', '800'].map((w) => [w, w]);
const FACES: [string, string][] = [
  ['body', 'The text’s'],
  ['display', 'The headings’'],
];

const CARD: FieldDef[] = [
  { key: 'style', label: 'Card', kind: 'select', options: [['tile', 'A tile with the picture inset'], ['contained', 'Contained — the picture flush, the words on a panel']] },
  { key: 'panel', label: 'Panel colour', kind: 'text', hint: 'e.g. rgba(255,255,255,0.06)' },
  { key: 'padding', label: 'Padding', kind: 'text', hint: 'e.g. 20px 24px' },
  { key: 'paddingMobile', label: 'Padding on phones', kind: 'text', hint: 'e.g. 16px' },
  { key: 'radius', label: 'Corners', kind: 'text', hint: 'e.g. 8px' },
  { key: 'gap', label: 'Space between cards', kind: 'text', hint: 'e.g. 32px' },
  { key: 'columnsTablet', label: 'Columns on tablets', kind: 'number', min: 1, max: 3 },
  { key: 'still', label: 'No colour change when pointed at', kind: 'check' },
  { key: 'dateSize', label: 'Date size', kind: 'text', hint: 'e.g. 14px' },
  { key: 'dateWeight', label: 'Date weight', kind: 'select', options: WEIGHTS },
  { key: 'dateColor', label: 'Date colour', kind: 'text', hint: 'e.g. rgba(255,255,255,0.5)' },
  { key: 'readingWeight', label: 'Reading time weight', kind: 'select', options: WEIGHTS },
  { key: 'titleFont', label: 'Title face', kind: 'select', options: FACES },
  { key: 'titleSize', label: 'Title size', kind: 'text', hint: 'e.g. 20px' },
  { key: 'titleSizeMobile', label: 'Title size on phones', kind: 'text' },
  { key: 'titleWeight', label: 'Title weight', kind: 'select', options: WEIGHTS },
  { key: 'titleLine', label: 'Title line height', kind: 'text', hint: 'e.g. 26px' },
  { key: 'titleTracking', label: 'Title letter spacing', kind: 'text', hint: 'e.g. -0.5px' },
  { key: 'chipStyle', label: 'Category chip', kind: 'select', options: [['outline', 'Outlined'], ['filled', 'Filled']] },
  { key: 'chipBackground', label: 'Chip fill', kind: 'text', hint: 'e.g. rgba(255,255,255,0.08)' },
  { key: 'chipRadius', label: 'Chip corners', kind: 'text', hint: 'e.g. 8px' },
  { key: 'chipSize', label: 'Chip size', kind: 'text' },
  { key: 'chipWeight', label: 'Chip weight', kind: 'select', options: WEIGHTS },
  { key: 'linkSize', label: '“Read more” size', kind: 'text' },
  { key: 'linkWeight', label: '“Read more” weight', kind: 'select', options: WEIGHTS },
  { key: 'linkGap', label: 'Space above “Read more”', kind: 'text', hint: 'then it follows the words' },
];

const ARCHIVE: FieldDef[] = [
  { key: 'titleSize', label: 'Title size', kind: 'text', hint: 'e.g. 64px' },
  { key: 'titleSizeTablet', label: 'Title on tablets', kind: 'text' },
  { key: 'titleSizeMobile', label: 'Title on phones', kind: 'text' },
  { key: 'top', label: 'Space above the title', kind: 'text' },
  { key: 'topMobile', label: 'On phones', kind: 'text' },
  { key: 'labelSize', label: '“Category” label size', kind: 'text', hint: 'the label under the title' },
  { key: 'labelWeight', label: 'Label weight', kind: 'select', options: WEIGHTS },
  { key: 'labelColor', label: 'Label colour', kind: 'text' },
  { key: 'labelGap', label: 'Space above the label', kind: 'text' },
  { key: 'crumbSize', label: 'Breadcrumbs size', kind: 'text' },
  { key: 'crumbHomeWeight', label: '“Home” weight', kind: 'select', options: WEIGHTS },
  { key: 'crumbsWithoutBlog', label: 'A category’s trail without the blog (Home › Category)', kind: 'check' },
  { key: 'filterLook', label: 'Category menu', kind: 'select', options: [['menu', '“Categories”'], ['select', 'A select naming the current category']] },
  { key: 'filterBackground', label: 'Menu fill', kind: 'text', hint: 'e.g. rgba(255,255,255,0.05)' },
  { key: 'filterRadius', label: 'Menu corners', kind: 'text' },
  { key: 'filterColor', label: 'Menu text colour', kind: 'text' },
  { key: 'filterSize', label: 'Menu text size', kind: 'text' },
  { key: 'filterHeight', label: 'Menu height', kind: 'text', hint: 'e.g. 36px' },
  { key: 'phoneFilters', label: 'Phones: the count and the categories behind a “Filters” button (with the row under the title)', kind: 'check' },
  { key: 'pagerAlign', label: 'Pager', kind: 'select', options: [['center', 'Centred'], ['left', 'At the left']] },
  { key: 'pagerSize', label: 'Pager buttons', kind: 'text', hint: 'e.g. 44px' },
  { key: 'pagerGap', label: 'Space between them', kind: 'text', hint: 'e.g. 0' },
  { key: 'pagerFont', label: 'Pager face', kind: 'select', options: FACES },
  { key: 'pagerTextSize', label: 'Pager text size', kind: 'text' },
  { key: 'pagerWeight', label: 'Pager weight', kind: 'select', options: WEIGHTS },
  { key: 'pagerHideDisabled', label: 'No “previous” on the first page (nor “next” on the last)', kind: 'check' },
  { key: 'pagerGlyph', label: 'Previous and next', kind: 'select', options: [['chevron', '‹ ›'], ['arrow', '← →']] },
  { key: 'barPadding', label: 'The row’s own space', kind: 'text', hint: 'above and below, e.g. 16px or 16px 24px' },
  { key: 'gridTop', label: 'Row to first cards', kind: 'text', hint: 'e.g. 40px' },
  { key: 'gridBottom', label: 'Under the cards', kind: 'text', hint: 'e.g. 55px' },
];

const POST: FieldDef[] = [
  { key: 'width', label: 'Container width', kind: 'text', hint: 'e.g. 1120px' },
  { key: 'coverGap', label: 'Space under the cover', kind: 'text', hint: 'title in the article’s column' },
  { key: 'sidebarWidth', label: 'Contents column width', kind: 'text', hint: 'e.g. 320px' },
  { key: 'textWidth', label: 'Text column width', kind: 'text', hint: 'e.g. 720px' },
  { key: 'titleSize', label: 'Title size', kind: 'text', hint: 'e.g. 64px' },
  { key: 'titleSizeTablet', label: 'Title on tablets', kind: 'text' },
  { key: 'titleSizeMobile', label: 'Title on phones', kind: 'text' },
  { key: 'titleWidth', label: 'Title width', kind: 'select', options: [['measure', 'About 20 characters'], ['none', 'The column’s']] },
  { key: 'categoryOnly', label: 'In the line above the title, only the category in the accent', kind: 'check' },
  { key: 'lineColor', label: 'That line’s colour', kind: 'text', hint: 'e.g. rgba(255,255,255,0.75)' },
  { key: 'lineSize', label: 'That line’s size', kind: 'text' },
  { key: 'lineFont', label: 'That line’s face', kind: 'select', options: FACES },
  { key: 'tocReveal', label: 'Contents shown once it sticks', kind: 'check' },
  { key: 'tocPanel', label: 'Contents panel', kind: 'text', hint: 'a colour' },
  { key: 'tocTitleSize', label: 'Contents title size', kind: 'text' },
  { key: 'tocTitleWeight', label: 'Contents title weight', kind: 'select', options: WEIGHTS },
  { key: 'tocItemSize', label: 'Contents item size', kind: 'text' },
  { key: 'tocItemColor', label: 'Contents item colour', kind: 'text' },
  { key: 'tocActiveColor', label: 'Contents current item', kind: 'text' },
  { key: 'tocQuestions', label: 'Contents lists the FAQ questions too', kind: 'check' },
  { key: 'shareIcons', label: 'Share icons', kind: 'select', options: [['line', 'Lines'], ['filled', 'Solid']] },
  { key: 'sharePanel', label: 'Share on one panel', kind: 'text', hint: 'its colour' },
  { key: 'shareSize', label: 'Share button size', kind: 'text', hint: 'e.g. 36px' },
  { key: 'sidebarTablet', label: 'Tablets keep the contents beside the article', kind: 'check' },
  { key: 'phoneShare', label: 'Share on phones', kind: 'select', options: [['top', 'Above the article'], ['end', 'At the end']] },
  { key: 'phoneToc', label: 'Contents on phones', kind: 'select', options: [['top', 'Above the article'], ['none', 'None']] },
  { key: 'linkUnderline', label: 'Links in the article underlined', kind: 'select', options: [['true', 'Yes'], ['false', 'No']] },
  { key: 'tableSize', label: 'Table text size', kind: 'text' },
  { key: 'tablePadding', label: 'Table cell padding', kind: 'text', hint: 'e.g. 12px 12px 12px 0' },
  { key: 'tableLines', label: 'Table lines', kind: 'select', options: [['grid', 'Every cell'], ['rows', 'Under each row only']] },
  { key: 'tableLineColor', label: 'Table line colour', kind: 'text' },
  { key: 'markerColor', label: 'List markers’ colour', kind: 'text' },
  { key: 'inlineSpace', label: 'Space around blocks in the article', kind: 'text', hint: '[[block:2]] in a paragraph of its own; e.g. 60px' },
  { key: 'relatedTitleSize', label: 'Related posts: heading size', kind: 'text' },
  { key: 'relatedTitleWeight', label: 'Heading weight', kind: 'select', options: WEIGHTS },
  { key: 'relatedTitleGap', label: 'Space under it', kind: 'text' },
  { key: 'relatedGap', label: 'Space between their cards', kind: 'text' },
  { key: 'relatedWidth', label: 'Their width', kind: 'text', hint: 'e.g. 1120px' },
];

function Fields({ defs, value, set, base }: { defs: FieldDef[]; value: Record<string, unknown> | undefined; set: Setter; base: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {defs.map((def) => {
        const current = value?.[def.key];
        const put = (next: unknown) => set([...base, def.key])(next);
        if (def.kind === 'check') {
          return (
            <label key={def.key} className="flex items-center gap-2 self-end pb-2 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={current === true} onChange={(e) => put(e.target.checked || undefined)} />
              {def.label}
            </label>
          );
        }
        if (def.kind === 'select') {
          return (
            <Field key={def.key} label={def.label}>
              <Select value={current === undefined ? '' : String(current)} onChange={(e) => put(e.target.value === '' ? undefined : e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)}>
                <option value="">As drawn</option>
                {def.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }
        if (def.kind === 'number') {
          return (
            <Field key={def.key} label={def.label} hint={def.hint}>
              <Input type="number" min={def.min} max={def.max} value={typeof current === 'number' ? current : ''} onChange={(e) => put(e.target.value === '' ? undefined : Math.min(def.max, Math.max(def.min, Math.round(Number(e.target.value) || def.min))))} />
            </Field>
          );
        }
        return (
          <Field key={def.key} label={def.label} hint={def.hint}>
            <Input value={typeof current === 'string' ? current : ''} placeholder="as drawn" onChange={(e) => put(e.target.value.trim() || undefined)} />
          </Field>
        );
      })}
    </div>
  );
}

export function BlogDetailsPanel({ blog, set }: { blog: BlogSettings | undefined; set: Setter }) {
  const look = blog?.look;
  return (
    <>
      <Panel title="Details — archive cards">
        <p className="m-0 mb-4 text-[13px] text-smoke">The blog index, categories, related posts drawn as archive cards, and a post list set to the archive’s cards.</p>
        <Fields defs={CARD} value={look?.card} set={set} base={['blog', 'look', 'card']} />
      </Panel>
      <Panel title="Details — archives">
        <Fields defs={ARCHIVE} value={look?.archive} set={set} base={['blog', 'look', 'archive']} />
      </Panel>
      <Panel title="Details — a post">
        <Fields defs={POST} value={look?.post} set={set} base={['blog', 'look', 'post']} />
        <div className="mt-4 border-t-2 border-hairline pt-3">
          <p className="m-0 mb-2 text-[13px] text-ash">Related posts drawn as archive cards, pointed at</p>
          <CardHoverFields value={look?.post?.relatedHover as CardHover | undefined} onChange={(hover) => set(['blog', 'look', 'post', 'relatedHover'])(hover)} />
        </div>
      </Panel>
    </>
  );
}
