'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { AdminButton, Field, Input, Select, Textarea } from '@/components/admin/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import {
  CARD_GRID_VARIANTS,
  CAROUSEL_ARROWS,
  CAROUSEL_INDICATORS,
  CAROUSEL_MODES,
  HERO_VARIANTS,
  MAX_ROW_DEPTH,
  type BlockType,
  blockLabels,
  blockSchemas,
  blockTypes,
} from '@/lib/blocks';
import { COLUMN_PRESETS, COLUMN_SPANS, TEXT_TAGS, TEXT_TAG_LABELS, type BlockStyle } from '@/lib/blockStyle';
import { BlockDesignPanel } from '@/components/admin/BlockDesignPanel';
import { ItemStylePanel } from '@/components/admin/ItemStylePanel';
import { LengthField } from '@/components/admin/styleFields';
import type { ItemStyle } from '@/lib/itemStyle';
import { Wireframe } from '@/components/admin/Wireframe';
import { CARD_GRID_WIREFRAMES, CAROUSEL_WIREFRAMES, HERO_WIREFRAMES, type Shape } from '@/lib/wireframes';
import { CARD_GRID_LABELS, CAROUSEL_LABELS, HERO_LABELS } from '@/lib/blockNames';
import { SOCIAL_LABELS, SOCIAL_NETWORKS } from '@/lib/navigation';
import { VIDEO_HOST_LABEL, parseVideoUrl } from '@/lib/embeds';
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '@/lib/hours';
import { SHARE_LABELS, SHARE_NETWORKS } from '@/lib/share';
import { FORM_FIELD_LABELS, FORM_FIELD_TYPES } from '@/lib/forms';
import { LOTTIE_PLAY, LOTTIE_PLAY_LABELS } from '@/lib/lottie';
import { cn } from '@/lib/utils';

const RichTextEditor = dynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border-2 border-hairline bg-ink px-3 py-8 text-center text-[13px] text-smoke">Loading editor…</div>,
});

type Props = Record<string, unknown>;
type Setter = (next: Props) => void;

const str = (p: Props, k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
const num = (p: Props, k: string, fallback: number) => (typeof p[k] === 'number' ? (p[k] as number) : fallback);
const arr = <T,>(p: Props, k: string): T[] => (Array.isArray(p[k]) ? (p[k] as T[]) : []);

/** Sensible starting props so a newly added block renders something. */
export function blankProps(type: BlockType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { title: 'New section heading', links: [], figure: 'none', layout: 'wide' };
    case 'stats':
      return { items: [{ value: '100%', label: 'caption' }] };
    case 'prose':
      return { title: 'Heading', paragraphs: ['Write here.'], columns: 'one' };
    case 'splitPoints':
      return { title: 'Heading', points: [{ title: 'Point', body: 'Detail.' }] };
    case 'cardGrid':
      return { title: 'Heading', columns: 3, cards: [{ title: 'Card', body: 'Detail.' }] };
    case 'numberedList':
      return { title: 'Heading', items: [{ title: 'Step', body: 'Detail.' }] };
    case 'checkLists':
      return { title: 'Heading', lists: [{ title: 'What this covers', items: ['First item'] }] };
    case 'faq':
      return { title: 'Questions we get asked.', items: [{ question: 'A question?', answer: 'The answer.' }] };
    case 'cta':
      return { title: 'Ready to talk?', links: [{ label: 'Get in touch', href: '/contact' }] };
    case 'pager':
      return { label: 'Next', title: '', href: '' };
    case 'servicesIndex':
      return { title: 'What we test', tier: 'all' };
    case 'postList':
      return { title: 'Recent writing', kind: 'all', limit: 9 };
    case 'contactForm':
      return {};
    case 'infoPanel':
      return { items: [{ label: 'Label', value: 'Value' }] };
    case 'image':
      return { url: '', alt: '' };
    case 'table':
      return { head: ['Column'], rows: [['']] };
    case 'figure':
      return { kind: 'converge', labels: [] };
    case 'spacer':
      return { height: '48px', line: 'none' };
    case 'carousel':
      return {
        mode: 'cards',
        title: 'Heading',
        slides: [
          { title: 'First slide', body: 'A short description.' },
          { title: 'Second slide', body: 'A short description.' },
          { title: 'Third slide', body: 'A short description.' },
          { title: 'Fourth slide', body: 'A short description.' },
        ],
        arrows: 'corner',
        indicator: 'dots',
      };
    case 'marquee':
      return { kind: 'chips', items: [{ label: 'First' }, { label: 'Second' }, { label: 'Third' }, { label: 'Fourth' }] };
    case 'stackedPanels':
      return { panels: [{ title: 'First panel' }, { title: 'Second panel' }, { title: 'Third panel' }] };
    case 'splitMedia':
      return { title: 'Heading', body: 'A short paragraph about this.', links: [] };
    case 'overlayCard':
      return { title: 'Heading', body: 'A short paragraph about this.' };
    case 'mediaBand':
      return { title: 'Heading', links: [] };
    case 'tabs':
      return { tabs: [{ label: 'First', title: 'First tab' }, { label: 'Second', title: 'Second tab' }, { label: 'Third', title: 'Third tab' }] };
    case 'logoWall':
      return { title: 'Trusted by', logos: [{ name: 'Company one' }, { name: 'Company two' }, { name: 'Company three' }] };
    case 'quote':
      return { quote: 'A sentence from someone who uses this.', name: 'Name', role: 'Role, Company', links: [] };
    case 'configurator':
      return { title: 'Choose a colour', options: [{ name: 'Graphite', color: '#2b2b2b' }, { name: 'Silver', color: '#c9ccd1' }] };
    case 'collage':
      return { title: 'Heading', body: 'A short paragraph about this.' };
    case 'appPromo':
      return { title: 'Get the app', screens: [] };
    case 'windowFrame':
      return { chrome: 'browser', address: 'example.com', tabs: [{ label: 'Overview' }] };
    case 'subNav':
      return { name: 'Product', links: [{ label: 'Overview', href: '#overview' }] };
    case 'scrollStory':
      return { title: 'How it works', items: [{ title: 'First step' }, { title: 'Second step' }, { title: 'Third step' }] };
    case 'pinnedMedia':
      return { title: 'Heading', length: 'medium' };
    case 'newsletter':
      return { layout: 'form', title: 'Stay in the loop', buttonLabel: 'Subscribe' };
    case 'heading':
      return { title: 'A heading worth reading', align: 'left', size: 'large' };
    case 'buttons':
      return {
        items: [
          { label: 'Get started', href: '/contact', style: 'primary', icon: 'arrow' },
          { label: 'Learn more', href: '/about', style: 'outline' },
        ],
      };
    case 'notice':
      return { kind: 'info', text: 'A short message for visitors.' };
    case 'progress':
      return { kind: 'bars', items: [{ label: 'Design', value: 80 }, { label: 'Engineering', value: 65 }] };
    case 'countdown':
      return { title: 'Launching soon', target: new Date(Date.now() + 30 * 86_400_000).toISOString() };
    case 'socialLinks':
      return { source: 'site', style: 'outlined' };
    case 'pricing':
      return {
        title: 'Simple pricing',
        plans: [
          { name: 'Starter', price: '$0', period: '/ month', features: [{ text: 'One project', included: true }], button: { label: 'Start free', href: '/contact' } },
          { name: 'Team', price: '$29', period: '/ month', featured: true, badge: 'Popular', features: [{ text: 'Unlimited projects', included: true }], button: { label: 'Get started', href: '/contact' } },
        ],
      };
    case 'team':
      return { title: 'The team', members: [{ name: 'Name', role: 'Role' }] };
    case 'compare':
      return { beforeUrl: '', afterUrl: '', beforeLabel: 'Before', afterLabel: 'After' };
    case 'video':
      return { source: '', videoTitle: '' };
    case 'gallery':
      return { images: [] };
    case 'horizontalAccordion':
      return { panels: [{ title: 'First panel' }, { title: 'Second panel' }, { title: 'Third panel' }] };
    case 'projects':
      return { title: 'Selected work', items: [{ title: 'Project' }] };
    case 'map':
      return { title: 'Find us', address: '' };
    case 'chart':
      return {
        title: 'Visitors by month',
        kind: 'column',
        series: [{ name: 'Visitors' }],
        rows: [
          { label: 'Jan', values: [120] },
          { label: 'Feb', values: [180] },
          { label: 'Mar', values: [240] },
        ],
      };
    case 'hotspots':
      return { title: 'Take a closer look', points: [{ x: 30, y: 40, title: 'First point' }, { x: 65, y: 60, title: 'Second point' }] };
    case 'flipBox':
      return {
        cards: [
          { title: 'First card', backText: 'What is on the back of the card.' },
          { title: 'Second card', backText: 'What is on the back of the card.' },
          { title: 'Third card', backText: 'What is on the back of the card.' },
        ],
      };
    case 'priceList':
      return { title: 'Menu', groups: [{ title: 'Starters', items: [{ name: 'First dish', price: '€8' }, { name: 'Second dish', price: '€9' }] }] };
    case 'businessHours':
      return {
        title: 'Opening hours',
        week: (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => ({ day, slots: [{ open: '09:00', close: '17:00' }] })),
      };
    case 'share':
      return { title: 'Share this page' };
    case 'reviews':
      return { title: 'What people say', items: [{ name: 'Name', rating: 5, text: 'A short review in the customer’s own words.' }] };
    case 'toc':
      return { title: 'On this page' };
    case 'breadcrumbs':
      return {};
    case 'textPath':
      return { text: 'Scroll down', shape: 'circle', centerText: '↓' };
    case 'search':
      return { title: 'Search the blog' };
    case 'form':
      return {
        title: 'Get in touch',
        formName: 'Contact',
        fields: [
          { id: nanoid(8), type: 'text', label: 'Name', required: true, width: 'half' },
          { id: nanoid(8), type: 'email', label: 'Email', required: true, width: 'half' },
          { id: nanoid(8), type: 'textarea', label: 'Message', required: true },
        ],
      };
    case 'lottie':
      return { url: '', play: 'loop' };
    case 'row':
      // A new row starts as two columns, the layout that motivates most rows.
      return {
        columns: [
          { id: nanoid(10), width: { base: 9, mobile: 12 }, blocks: [] },
          { id: nanoid(10), width: { base: 3, mobile: 12 }, blocks: [] },
        ],
        align: 'stretch',
        gap: '32px',
      };
    default:
      return {};
  }
}

/* ── Small building blocks used by every editor ───────────────────────────── */

function Text({
  label,
  k,
  props,
  set,
  placeholder,
  hint,
}: {
  label: string;
  k: string;
  props: Props;
  set: Setter;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input value={str(props, k)} placeholder={placeholder} onChange={(e) => set({ ...props, [k]: e.target.value })} />
    </Field>
  );
}

function Area({
  label,
  k,
  props,
  set,
  rows = 3,
}: {
  label: string;
  k: string;
  props: Props;
  set: Setter;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <Textarea rows={rows} value={str(props, k)} onChange={(e) => set({ ...props, [k]: e.target.value })} />
    </Field>
  );
}

function ToneField({ props, set }: { props: Props; set: Setter }) {
  return (
    <Field label="Background" hint="raised = the darker band">
      <Select value={str(props, 'tone') || 'base'} onChange={(e) => set({ ...props, tone: e.target.value })}>
        <option value="base">Base</option>
        <option value="raised">Raised</option>
      </Select>
    </Field>
  );
}

/**
 * Repeater for an array of objects. Handles add, remove and reorder so each
 * block editor only has to describe one row.
 */
function Repeater<T extends Record<string, unknown>>({
  label,
  items,
  onChange,
  blank,
  addLabel = 'Add item',
  renderRow,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  blank: () => T;
  addLabel?: string;
  renderRow: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row!);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="border-2 border-hairline bg-ink p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-flare">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-1">
                <AdminButton variant="ghost" type="button" onClick={() => move(i, i - 1)} aria-label="Move up" className="px-2 py-1">
                  ↑
                </AdminButton>
                <AdminButton variant="ghost" type="button" onClick={() => move(i, i + 1)} aria-label="Move down" className="px-2 py-1">
                  ↓
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label="Remove"
                  className="px-2 py-1 text-flare-soft"
                >
                  ×
                </AdminButton>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {renderRow(item, (patch) => onChange(items.map((row, j) => (j === i ? { ...row, ...patch } : row))), i)}
            </div>
          </div>
        ))}
      </div>
      <AdminButton variant="secondary" type="button" className="mt-3" onClick={() => onChange([...items, blank()])}>
        {addLabel}
      </AdminButton>
    </div>
  );
}

/** Shared repeaters used by several block types. */

type TitleBody = { title: string; body: string };
function TitleBodyRepeater({ label, items, onChange }: { label: string; items: TitleBody[]; onChange: (n: TitleBody[]) => void }) {
  return (
    <Repeater
      label={label}
      items={items}
      onChange={onChange}
      blank={() => ({ title: '', body: '' })}
      renderRow={(item, update) => (
        <>
          <Field label="Title">
            <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Body">
            <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value })} />
          </Field>
        </>
      )}
    />
  );
}

type LinkItem = { label: string; href: string; variant?: string };
function LinksRepeater({ items, onChange }: { items: LinkItem[]; onChange: (n: LinkItem[]) => void }) {
  return (
    <Repeater
      label="Buttons"
      items={items}
      onChange={onChange}
      addLabel="Add button"
      blank={(): LinkItem => ({ label: '', href: '', variant: 'primary' })}
      renderRow={(item, update) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Label">
            <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
          </Field>
          <Field label="Link">
            <Input value={item.href ?? ''} placeholder="/contact" onChange={(e) => update({ href: e.target.value })} />
          </Field>
          <Field label="Style">
            <Select value={item.variant ?? 'primary'} onChange={(e) => update({ variant: e.target.value })}>
              <option value="primary">Primary</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
            </Select>
          </Field>
        </div>
      )}
    />
  );
}

/**
 * A list of strings, one control each.
 *
 * `multiline` gives each entry a textarea instead of a single-line input. That
 * matters for prose: in a plain `<input>` the Enter key does nothing at all, so
 * a line break could not even be typed, let alone rendered. Lists of short
 * things — options, features, tags — stay single-line, where Enter has no
 * business anyway.
 */
function StringListRepeater({
  label,
  items,
  onChange,
  multiline = false,
  hint,
}: {
  label: string;
  items: string[];
  onChange: (n: string[]) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const update = (i: number, next: string) => onChange(items.map((v, j) => (j === i ? next : v)));

  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</div>
      {hint && <p className="m-0 mb-2 text-[12px] leading-relaxed text-smoke">{hint}</p>}
      {items.map((item, i) => (
        <div key={i} className={cn('mb-2 flex gap-2', multiline ? 'items-start' : 'items-center')}>
          {multiline ? (
            <Textarea rows={3} value={item} onChange={(e) => update(i, e.target.value)} />
          ) : (
            <Input value={item} onChange={(e) => update(i, e.target.value)} />
          )}
          <AdminButton
            variant="ghost"
            type="button"
            className="px-2 py-1 text-flare-soft"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label={`Remove item ${i + 1}`}
          >
            ×
          </AdminButton>
        </div>
      ))}
      <AdminButton variant="secondary" type="button" onClick={() => onChange([...items, ''])}>
        Add line
      </AdminButton>
    </div>
  );
}

function ImageField({ props, set }: { props: Props; set: Setter }) {
  const [open, setOpen] = useState(false);
  const url = str(props, 'url');
  return (
    <>
      <Field label="Image">
        <div className="flex items-center gap-2">
          <Input readOnly value={url} placeholder="No image chosen" className="flex-1" />
          <AdminButton variant="secondary" type="button" onClick={() => setOpen(true)}>
            Choose
          </AdminButton>
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="mt-3 max-h-40 w-auto border-2 border-hairline" />
        )}
      </Field>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(media) =>
          set({ ...props, url: media.url, mediaId: media.id, alt: media.altText || str(props, 'alt'), width: media.width ?? undefined, height: media.height ?? undefined })
        }
      />
    </>
  );
}

/** A Lottie file from the media library; its size is copied so the space is held before it loads. */
function LottieField({ props, set }: { props: Props; set: Setter }) {
  const [open, setOpen] = useState(false);
  return (
    <Field label="Animation" hint="a Lottie .json file — upload it in the media library, or with Upload in the picker">
      <div className="flex items-center gap-2">
        <Input readOnly value={str(props, 'url')} placeholder="No animation chosen" className="flex-1" />
        <AdminButton variant="secondary" type="button" onClick={() => setOpen(true)}>
          Choose
        </AdminButton>
      </div>
      <MediaPicker
        open={open}
        accept="animation"
        onClose={() => setOpen(false)}
        onSelect={(media) =>
          set({ ...props, url: media.url, mediaId: media.id, width: media.width ?? undefined, height: media.height ?? undefined, label: str(props, 'label') || media.altText || undefined })
        }
      />
    </Field>
  );
}

/* ── Pattern-library helpers ─────────────────────────────────────────────── */

/** Sets an optional key, or removes it when the value is empty. */
function withOpt(props: Props, key: string, value: unknown): Props {
  const next = { ...props };
  if (value === undefined || value === '' || value === null) delete next[key];
  else next[key] = value;
  return next;
}

/** An image or video from the media library, with Choose and Clear. */
function MediaInput({
  label,
  value,
  onChange,
  accept = 'image',
  hint,
}: {
  label: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  accept?: 'image' | 'video';
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        {value && accept === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-10 w-14 shrink-0 border-2 border-hairline object-cover" />
        )}
        <Input readOnly value={value ?? ''} placeholder="None" className="flex-1" />
        <AdminButton variant="secondary" type="button" onClick={() => setOpen(true)}>
          Choose
        </AdminButton>
        {value && (
          <AdminButton variant="ghost" type="button" onClick={() => onChange(undefined)}>
            Clear
          </AdminButton>
        )}
      </div>
      <MediaPicker
        open={open}
        accept={accept}
        onClose={() => setOpen(false)}
        onSelect={(media) => {
          onChange(media.url);
          setOpen(false);
        }}
      />
    </Field>
  );
}

/** An optional {label, href} pair, edited as two fields. */
function OptLink({ label, props, set, k }: { label: string; props: Props; set: Setter; k: string }) {
  const value = (props[k] ?? {}) as { label?: string; href?: string };
  const update = (patch: { label?: string; href?: string }) => {
    const next = { ...value, ...patch };
    set(withOpt(props, k, next.label || next.href ? next : undefined));
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} — label`}>
        <Input value={value.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
      </Field>
      <Field label={`${label} — link`}>
        <Input value={value.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
      </Field>
    </div>
  );
}

/** A layout choice shown as wireframe cards — the picture is the point of the choice. */
function VariantCards<T extends string>({
  label,
  value,
  options,
  labels,
  wires,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  wires: Record<T, readonly Shape[]>;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              'cursor-pointer border-2 p-2 transition-colors has-[:focus-visible]:border-flare-hot',
              value === option ? 'border-flare' : 'border-hairline hover:border-rule',
            )}
          >
            <input type="radio" name={label} className="sr-only" checked={value === option} onChange={() => onChange(option)} />
            <Wireframe shapes={wires[option]} />
            <span className={cn('mt-1.5 block text-[12px] leading-snug', value === option ? 'text-bone' : 'text-ash')}>
              {labels[option]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}


/** An image or video prop, removed again when cleared. */
function PropMedia({
  label,
  k,
  props,
  set,
  accept = 'image',
  hint,
}: {
  label: string;
  k: string;
  props: Props;
  set: Setter;
  accept?: 'image' | 'video';
  hint?: string;
}) {
  return <MediaInput label={label} hint={hint} accept={accept} value={str(props, k) || undefined} onChange={(v) => set(withOpt(props, k, v))} />;
}

/** A link prop, removed when empty so an optional link never fails validation. */
function PropHref({ label, k, props, set, hint }: { label: string; k: string; props: Props; set: Setter; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={str(props, k)} placeholder="/path or https://" spellCheck={false} onChange={(e) => set(withOpt(props, k, e.target.value.trim()))} />
    </Field>
  );
}

function PropSelect({
  label,
  k,
  props,
  set,
  options,
  fallback,
  hint,
}: {
  label: string;
  k: string;
  props: Props;
  set: Setter;
  options: readonly (readonly [string, string])[];
  fallback: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Select value={str(props, k) || fallback} onChange={(e) => set({ ...props, [k]: e.target.value })}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function PropCheck({ label, k, props, set }: { label: string; k: string; props: Props; set: Setter }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={props[k] === true} onChange={(e) => set({ ...props, [k]: e.target.checked })} />
      {label}
    </label>
  );
}

/** A checkbox for an option that is on unless someone switches it off. */
function PropCheckOn({ label, k, props, set }: { label: string; k: string; props: Props; set: Setter }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={props[k] !== false} onChange={(e) => set({ ...props, [k]: e.target.checked })} />
      {label}
    </label>
  );
}

/** Buttons as {label, href} pairs, capped at `max`. */
function LibLinksField({
  props,
  set,
  label = 'Buttons',
  k = 'links',
  max = 2,
}: {
  props: Props;
  set: Setter;
  label?: string;
  k?: string;
  max?: number;
}) {
  return (
    <Repeater
      label={`${label} (up to ${max})`}
      items={arr<{ label: string; href: string }>(props, k)}
      onChange={(next) => set({ ...props, [k]: next.slice(0, max) })}
      blank={() => ({ label: '', href: '' })}
      addLabel="Add"
      renderRow={(item, update) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label">
            <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
          </Field>
          <Field label="Link">
            <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
          </Field>
        </div>
      )}
    />
  );
}

/** An optional {label, href} inside a repeater row. */
function ItemLink({
  label = 'Button',
  value,
  onChange,
}: {
  label?: string;
  value?: { label?: string; href?: string };
  onChange: (next: { label: string; href: string } | undefined) => void;
}) {
  const current = value ?? {};
  const update = (patch: { label?: string; href?: string }) => {
    const next = { label: current.label ?? '', href: current.href ?? '', ...patch };
    onChange(next.label || next.href ? next : undefined);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} — label`}>
        <Input value={current.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
      </Field>
      <Field label={`${label} — link`}>
        <Input value={current.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
      </Field>
    </div>
  );
}

const OVERLAY_OPTIONS = [
  ['none', 'None'],
  ['light', 'Light'],
  ['medium', 'Medium'],
  ['strong', 'Strong'],
] as const;

type TabItem = { label: string; title?: string; body?: string; imageUrl?: string; alt?: string; link?: { label: string; href: string } };
type LogoItem = { name: string; imageUrl?: string; href?: string };
type ColourItem = { name: string; color: string; imageUrl?: string; alt?: string };
type ScreenItem = { imageUrl: string; alt?: string };
type ViewItem = { label: string; imageUrl?: string; alt?: string; code?: string };
type GridCard = { eyebrow?: string; title: string; body?: string; href?: string; imageUrl?: string; alt?: string; buttonLabel?: string; badge?: string; points?: string[]; style?: ItemStyle };
type FaqEntry = { question: string; answer: string; imageUrl?: string; alt?: string };
type StatItem = { value: string; label: string; unit?: string; iconUrl?: string };
type StoryItem = { title: string; body?: string; imageUrl?: string; alt?: string };
type ButtonItem = { label: string; href: string; style?: string; icon?: string; iconSide?: string; iconOnly?: boolean; shadow?: boolean };
type ProgressItem = { label: string; value: number; note?: string };
type SocialItem = { network: string; href: string };
type PlanItem = {
  name: string;
  tagline?: string;
  price: string;
  period?: string;
  yearlyPrice?: string;
  yearlyPeriod?: string;
  badge?: string;
  featured?: boolean;
  description?: string;
  features?: { text: string; included: boolean }[];
  button?: { label: string; href: string };
};
type MemberItem = { name: string; role?: string; bio?: string; imageUrl?: string; links?: SocialItem[] };
type GalleryImage = { url: string; alt?: string; caption?: string; href?: string };
type AccordionPanel = { title: string; label?: string; body?: string; imageUrl?: string; alt?: string; link?: { label: string; href: string } };
type ProjectItem = {
  title: string;
  category?: string;
  year?: string;
  summary?: string;
  imageUrl?: string;
  hoverImageUrl?: string;
  alt?: string;
  href?: string;
};
type DetailItem = { label: string; value: string };
type StepItem = { title: string; body: string; label?: string };
type TabRow = TabItem & { iconUrl?: string };

type ChartRow = { label: string; values: number[] };
type HotspotPoint = { x: number; y: number; title: string; body?: string; imageUrl?: string; link?: { label: string; href: string } };
type FlipCard = { title: string; text?: string; imageUrl?: string; iconUrl?: string; backTitle?: string; backText?: string; link?: { label: string; href: string } };
type PriceItem = { name: string; price?: string; description?: string; imageUrl?: string; tags?: string[]; badge?: string };
type PriceGroup = { title?: string; note?: string; items: PriceItem[] };
type HoursDay = { day: Weekday; slots: { open: string; close: string }[] };
type NoteItem = { label: string; text: string };
type ReviewItem = { name: string; meta?: string; avatarUrl?: string; rating?: number; title?: string; text: string; date?: string; source?: string };
type ReviewSummary = { rating: number; count?: string; label?: string; link?: { label: string; href: string } };
type PlaylistItem = { source: string; videoTitle: string; posterUrl?: string; duration?: string };
type FormFieldRow = { id: string; type: string; label: string; required?: boolean; placeholder?: string; help?: string; options?: string[]; width?: string };

const SIZE_OPTIONS: [string, string][] = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
const HEAD_FIELDS = (props: Record<string, unknown>, set: (p: Record<string, unknown>) => void) => (
  <>
    <ToneField props={props} set={set} />
    <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
    <Text label="Heading" k="title" props={props} set={set} />
    <Area label="Intro" k="intro" props={props} set={set} rows={2} />
  </>
);

/** A number input that stores nothing when it is cleared. */
function OptNumber({ label, k, props, set, hint, step = 'any' }: { label: string; k: string; props: Record<string, unknown>; set: (p: Record<string, unknown>) => void; hint?: string; step?: string }) {
  const value = props[k];
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        step={step}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => set({ ...props, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}
      />
    </Field>
  );
}

/** A stored ISO date as the value a datetime-local input expects, in local time. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Stars in halves, or none. */
function RatingSelect({ value, onChange }: { value?: number; onChange: (next: number | undefined) => void }) {
  return (
    <Field label="Stars" hint="optional">
      <Select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}>
        <option value="">None</option>
        {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** An icon-list entry: a plain string as stored before P3-B3, or one with a link and small print. */
type ListEntry = string | { text: string; href?: string; note?: string };
type EntryRow = { text: string; href?: string; note?: string };

/** Entries stay plain strings until they gain a link or small print, so old lists are untouched. */
function EntriesField({ items, onChange }: { items: ListEntry[]; onChange: (next: ListEntry[]) => void }) {
  const rows: EntryRow[] = items.map((item) => (typeof item === 'string' ? { text: item } : item));
  const store = (next: EntryRow[]) =>
    onChange(next.map((e) => (e.href || e.note ? { text: e.text, ...(e.href ? { href: e.href } : {}), ...(e.note ? { note: e.note } : {}) } : e.text)));
  return (
    <Repeater
      label="Entries"
      items={rows}
      onChange={store}
      blank={(): EntryRow => ({ text: '' })}
      addLabel="Add entry"
      renderRow={(item, update) => (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Text">
            <Input value={item.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
          </Field>
          <Field label="Link (optional)">
            <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
          </Field>
          <Field label="Small print (optional)">
            <Input value={item.note ?? ''} onChange={(e) => update({ note: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  );
}

const clampPercent = (value: string) => Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 10) / 10));

/** The picture with its pins; a click places the point being edited. */
function HotspotPlacer({ imageUrl, points, active, onPlace }: { imageUrl: string; points: HotspotPoint[]; active: number; onPlace: (x: number, y: number) => void }) {
  if (!imageUrl) return <p className="m-0 text-[13px] text-smoke">Choose a picture, then click it to place each point.</p>;
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Click the picture to place point {active + 1}</div>
      <div
        className="relative inline-block max-w-full cursor-crosshair border-2 border-hairline"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          onPlace(clampPercent(String(((e.clientX - box.left) / box.width) * 100)), clampPercent(String(((e.clientY - box.top) / box.height) * 100)));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="block max-h-80 w-auto max-w-full" />
        {points.map((pt, i) => (
          <span
            key={i}
            className={cn(
              'pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink text-[11px] font-bold',
              i === active ? 'bg-flare text-ink' : 'bg-bone text-ink',
            )}
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function HotspotsFields({ props, set }: { props: Props; set: Setter }) {
  const [placing, setPlacing] = useState(0);
  const points = arr<HotspotPoint>(props, 'points');
  const place = (x: number, y: number) => {
    if (!points[placing]) return;
    set({ ...props, points: points.map((pt, i) => (i === placing ? { ...pt, x, y } : pt)) });
  };

  return (
    <>
      {HEAD_FIELDS(props, set)}
      <PropMedia label="Picture" k="imageUrl" props={props} set={set} />
      <Text label="Picture description" k="alt" props={props} set={set} hint="for screen readers" />
      <div className="grid gap-3 sm:grid-cols-3">
        <PropSelect label="Pins" k="marker" fallback="dot" options={[['dot', 'Dots'], ['number', 'Numbers'], ['plus', 'Plus signs']]} props={props} set={set} />
        <PropSelect label="Cards open" k="trigger" fallback="click" options={[['click', 'On click or tap'], ['hover', 'On hover (tap still works)']]} props={props} set={set} />
        <PropSelect label="Picture width" k="width" fallback="full" options={[['full', 'Full width'], ['medium', 'Medium'], ['small', 'Small']]} props={props} set={set} />
      </div>
      <div className="flex flex-wrap gap-5">
        <PropCheckOn label="Pins pulse gently" k="pulse" props={props} set={set} />
        <PropCheck label="Also list the points beside the picture" k="list" props={props} set={set} />
      </div>
      <HotspotPlacer imageUrl={str(props, 'imageUrl')} points={points} active={placing} onPlace={place} />
      <Repeater
        label="Points (up to 12)"
        items={points}
        onChange={(next) => set({ ...props, points: next.slice(0, 12) })}
        blank={(): HotspotPoint => ({ x: 50, y: 50, title: '' })}
        addLabel="Add point"
        renderRow={(item, update, i) => (
          <>
            <div className="grid gap-3 sm:grid-cols-[2fr_0.8fr_0.8fr_auto]">
              <Field label="Title">
                <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
              </Field>
              <Field label="Across (%)">
                <Input type="number" min={0} max={100} step="0.1" value={item.x ?? 50} onChange={(e) => update({ x: clampPercent(e.target.value) })} />
              </Field>
              <Field label="Down (%)">
                <Input type="number" min={0} max={100} step="0.1" value={item.y ?? 50} onChange={(e) => update({ y: clampPercent(e.target.value) })} />
              </Field>
              <div className="flex items-end pb-1">
                <AdminButton variant="secondary" type="button" aria-pressed={placing === i} onClick={() => setPlacing(i)}>
                  {placing === i ? 'Placing ✓' : 'Place'}
                </AdminButton>
              </div>
            </div>
            <Field label="Text">
              <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} />
            </Field>
            <MediaInput label="Picture in the card" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
            <ItemLink label="Link" value={item.link} onChange={(link) => update({ link })} />
          </>
        )}
      />
      <Text label="Caption" k="caption" props={props} set={set} />
    </>
  );
}

function HoursFields({ props, set }: { props: Props; set: Setter }) {
  const week = arr<HoursDay>(props, 'week');
  const slotsOf = (day: Weekday) => week.find((d) => d.day === day)?.slots ?? [];
  const setDay = (day: Weekday, slots: HoursDay['slots']) =>
    set({ ...props, week: WEEKDAYS.map((d) => ({ day: d, slots: d === day ? slots : slotsOf(d) })).filter((d) => d.slots.length > 0) });
  const copyMonday = () =>
    set({ ...props, week: WEEKDAYS.map((d) => ({ day: d, slots: ['tue', 'wed', 'thu', 'fri'].includes(d) ? slotsOf('mon') : slotsOf(d) })).filter((d) => d.slots.length > 0) });

  return (
    <>
      {HEAD_FIELDS(props, set)}
      <div className="grid gap-3 sm:grid-cols-3">
        <PropSelect label="Style" k="style" fallback="list" options={[['list', 'List'], ['card', 'Card, status across the top'], ['compact', 'Compact']]} props={props} set={set} />
        <PropSelect label="Clock" k="clock" fallback="24h" options={[['24h', '24-hour (17:30)'], ['12h', '12-hour (5:30 pm)']]} props={props} set={set} />
        <PropSelect label="Week starts on" k="firstDay" fallback="mon" options={[['mon', 'Monday'], ['sun', 'Sunday']]} props={props} set={set} />
      </div>
      <div className="flex flex-wrap gap-5">
        <PropCheckOn label="Show “Open now” / “Closed now”" k="status" props={props} set={set} />
        <PropCheckOn label="Mark today" k="today" props={props} set={set} />
        <PropCheckOn label="Join days with the same hours (Mon – Fri)" k="merge" props={props} set={set} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time zone" hint="empty = the site’s time zone (Settings)">
          <Input value={str(props, 'timeZone')} placeholder="Europe/London" spellCheck={false} onChange={(e) => set(withOpt(props, 'timeZone', e.target.value.trim()))} />
        </Field>
        <Text label="Word for a closed day" k="closedLabel" props={props} set={set} placeholder="Closed" />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Hours — a closing time before the opening time runs past midnight</span>
          <AdminButton variant="ghost" type="button" className="px-2 py-1" onClick={copyMonday}>
            Copy Monday to Tue–Fri
          </AdminButton>
        </div>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map((day) => {
            const slots = slotsOf(day);
            return (
              <div key={day} className="grid items-center gap-2 border-2 border-hairline bg-ink p-3 sm:grid-cols-[110px_1fr]">
                <span className="text-[14px] text-bone">{WEEKDAY_LABELS[day].long}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {slots.length === 0 && <span className="text-[13px] text-smoke">Closed</span>}
                  {slots.map((slot, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <Input type="time" aria-label={`${WEEKDAY_LABELS[day].long} opens`} className="w-[120px]" value={slot.open} onChange={(e) => setDay(day, slots.map((s, j) => (j === i ? { ...s, open: e.target.value } : s)))} />
                      <span className="text-smoke">–</span>
                      <Input type="time" aria-label={`${WEEKDAY_LABELS[day].long} closes`} className="w-[120px]" value={slot.close} onChange={(e) => setDay(day, slots.map((s, j) => (j === i ? { ...s, close: e.target.value } : s)))} />
                      <AdminButton variant="ghost" type="button" className="px-2 py-1 text-flare-soft" aria-label={`Remove these ${WEEKDAY_LABELS[day].long} hours`} onClick={() => setDay(day, slots.filter((_, j) => j !== i))}>
                        ×
                      </AdminButton>
                    </span>
                  ))}
                  {slots.length < 3 && (
                    <AdminButton variant="secondary" type="button" onClick={() => setDay(day, [...slots, slots.length ? { open: '13:00', close: '17:00' } : { open: '09:00', close: '17:00' }])}>
                      {slots.length ? 'Add hours' : 'Open this day'}
                    </AdminButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Repeater
        label="Special days (up to 8)"
        items={arr<NoteItem>(props, 'notes')}
        onChange={(notes) => set({ ...props, notes: notes.slice(0, 8) })}
        blank={(): NoteItem => ({ label: '', text: '' })}
        addLabel="Add special day"
        renderRow={(item, update) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Day">
              <Input value={item.label ?? ''} placeholder="25 December" onChange={(e) => update({ label: e.target.value })} />
            </Field>
            <Field label="Hours">
              <Input value={item.text ?? ''} placeholder="Closed" onChange={(e) => update({ text: e.target.value })} />
            </Field>
          </div>
        )}
      />
      <OptLink label="Button under the hours" props={props} set={set} k="link" />
    </>
  );
}

function SocialRowFields({ item, update }: { item: SocialItem; update: (patch: Partial<SocialItem>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
      <Field label="Network">
        <Select value={item.network ?? 'linkedin'} onChange={(e) => update({ network: e.target.value })}>
          {SOCIAL_NETWORKS.map((n) => (
            <option key={n} value={n}>
              {SOCIAL_LABELS[n]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Profile link">
        <Input value={item.href ?? ''} placeholder="https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
      </Field>
    </div>
  );
}

/** The classic hero's diagram and layout controls. */
function ClassicHeroFigure({ props, set }: { props: Props; set: Setter }) {
  return (
    <>
      <Field label="Figure" hint="the diagram beside the heading">
        <Select value={str(props, 'figure') || 'none'} onChange={(e) => set({ ...props, figure: e.target.value })}>
          <option value="none">None</option>
          <option value="converge">Converging diagram — two sources meeting</option>
          <option value="layers">Layer stack — surfaces, last one highlighted</option>
        </Select>
      </Field>
      {(str(props, 'figure') === 'converge' || str(props, 'figure') === 'layers') && (
        <StringListRepeater
          label={
            str(props, 'figure') === 'converge'
              ? 'Figure labels — first source, second source, destination'
              : 'Figure labels — outermost first; the last is highlighted'
          }
          items={arr<string>(props, 'figureLabels')}
          onChange={(figureLabels) => set({ ...props, figureLabels })}
        />
      )}
      <Field label="Layout">
        <Select value={str(props, 'layout') || 'split'} onChange={(e) => set({ ...props, layout: e.target.value })}>
          <option value="split">Split (text + figure)</option>
          <option value="wide">Wide (text only)</option>
        </Select>
      </Field>
    </>
  );
}


const INDICATOR_LABELS: Record<(typeof CAROUSEL_INDICATORS)[number], string> = {
  dots: 'Dots',
  pill: 'Dots with a stretched active pill',
  ring: 'Dots with a ring on the active one',
  progress: 'Progress lines',
  capsule: 'Capsule — arrows and dots together',
  counter: 'Counter (02 / 05)',
  numbers: 'Numbers (01 02 03)',
  thumbs: 'Thumbnails of the slides',
  chapters: 'The slide titles, as a list',
  none: 'None',
};

const ARROW_LABELS: Record<(typeof CAROUSEL_ARROWS)[number], string> = {
  corner: 'Top right, beside the heading',
  side: 'On the sides',
  edge: 'At the screen edges, cards peeking both sides',
  none: 'None — swipe and indicators only',
};

type PanelItem = {
  eyebrow?: string;
  title: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  buttonLabel?: string;
  href?: string;
};

type SlideItem = {
  eyebrow?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  href?: string;
  buttonLabel?: string;
  badge?: string;
  price?: string;
  swatches?: string[];
  caption?: string;
  specs?: { label: string; value: string }[];
  rating?: number;
};

function SlideFields({ item, update, mode }: { item: SlideItem; update: (patch: Partial<SlideItem>) => void; mode: string }) {
  const opt = (key: keyof SlideItem) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    update({ [key]: e.target.value || undefined } as Partial<SlideItem>);
  // V8 — a testimonial keeps its quote in the text, the name in the title and the role in the caption.
  if (mode === 'quotes') {
    return (
      <>
        <Field label="Quote">
          <Textarea rows={3} value={item.body ?? ''} onChange={opt('body')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={item.title ?? ''} onChange={opt('title')} />
          </Field>
          <Field label="Role or company">
            <Input value={item.caption ?? ''} onChange={opt('caption')} />
          </Field>
        </div>
        <RatingSelect value={item.rating} onChange={(rating) => update({ rating })} />
        <MediaInput label="Photo (optional)" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
      </>
    );
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Eyebrow">
          <Input value={item.eyebrow ?? ''} onChange={opt('eyebrow')} />
        </Field>
        <Field label="Title">
          <Input value={item.title ?? ''} onChange={opt('title')} />
        </Field>
      </div>
      <Field label="Text">
        <Textarea rows={2} value={item.body ?? ''} onChange={opt('body')} />
      </Field>
      <MediaInput label="Image" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
      {(mode === 'hero' || mode === 'heroCards' || mode === 'media') && (
        <MediaInput label="Video" hint="plays muted in a loop; the image becomes its poster" accept="video" value={item.videoUrl} onChange={(videoUrl) => update({ videoUrl })} />
      )}
      <Field label="Image description" hint="for screen readers">
        <Input value={item.alt ?? ''} onChange={opt('alt')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Link">
          <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={opt('href')} />
        </Field>
        <Field label="Button label">
          <Input value={item.buttonLabel ?? ''} placeholder="Learn more" onChange={opt('buttonLabel')} />
        </Field>
      </div>
      {(mode === 'media' || mode === 'coverflow') && (
        <Field label="Caption">
          <Input value={item.caption ?? ''} onChange={opt('caption')} />
        </Field>
      )}
      {(mode === 'media' || mode === 'hero') && (
        <Field label="Specifications" hint="up to five, one per line as “Label: value”; shown beside the picture in an image slider">
          <Textarea
            rows={3}
            value={(item.specs ?? []).map((s) => `${s.label}: ${s.value}`).join('\n')}
            onChange={(e) => {
              const list = e.target.value
                .split('\n')
                .map((line) => {
                  const at = line.indexOf(':');
                  return at === -1 ? { label: '', value: '' } : { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
                })
                .filter((s) => s.label && s.value)
                .slice(0, 5);
              update({ specs: list.length ? list : undefined });
            }}
          />
        </Field>
      )}
      {(mode === 'products' || mode === 'cards') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Badge" hint="e.g. New">
            <Input value={item.badge ?? ''} maxLength={24} onChange={opt('badge')} />
          </Field>
          <Field label="Price" hint="shown as written">
            <Input value={item.price ?? ''} maxLength={40} onChange={opt('price')} />
          </Field>
        </div>
      )}
      {(mode === 'products' || mode === 'cards') && <RatingSelect value={item.rating} onChange={(rating) => update({ rating })} />}
      {mode === 'products' && (
        <Field label="Colour swatches" hint="hex colours separated by commas, e.g. #1b1b1b, #d4c3a3">
          <Input
            value={(item.swatches ?? []).join(', ')}
            spellCheck={false}
            onChange={(e) => {
              const list = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
              update({ swatches: list.length ? list : undefined });
            }}
          />
        </Field>
      )}
    </>
  );
}

function CarouselFields({ props, set }: { props: Props; set: Setter }) {
  const mode = str(props, 'mode') || 'cards';
  const perView = (props.perView ?? {}) as { base?: number; laptop?: number; tablet?: number; mobile?: number };
  const trackMode = mode === 'cards' || mode === 'products' || mode === 'heroCards';

  return (
    <>
      <VariantCards
        label="Kind of slider"
        value={mode as (typeof CAROUSEL_MODES)[number]}
        options={CAROUSEL_MODES}
        labels={CAROUSEL_LABELS}
        wires={CAROUSEL_WIREFRAMES}
        onChange={(m) => set({ ...props, mode: m })}
      />

      {/* A full-screen or split-screen slider carries its words on the slides themselves. */}
      {mode !== 'hero' && mode !== 'splitScreen' && (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <OptLink label="Link beside the heading" props={props} set={set} k="link" />
        </>
      )}

      <Repeater
        label="Slides"
        items={arr<SlideItem>(props, 'slides')}
        onChange={(slides) => set({ ...props, slides })}
        blank={() => ({ title: '' })}
        addLabel="Add slide"
        renderRow={(item, update) => <SlideFields item={item} update={update} mode={mode} />}
      />

      <details open>
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone">Controls</summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Indicator">
              <Select value={str(props, 'indicator') || 'dots'} onChange={(e) => set({ ...props, indicator: e.target.value })}>
                {CAROUSEL_INDICATORS.map((k) => (
                  <option key={k} value={k}>
                    {INDICATOR_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Arrows">
              <Select value={str(props, 'arrows') || 'corner'} onChange={(e) => set({ ...props, arrows: e.target.value })}>
                {CAROUSEL_ARROWS.map((k) => (
                  <option key={k} value={k}>
                    {ARROW_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {mode === 'hero' && (
              <Field label="Direction">
                <Select value={str(props, 'direction') || 'horizontal'} onChange={(e) => set({ ...props, direction: e.target.value })}>
                  <option value="horizontal">Sideways</option>
                  <option value="vertical">Up and down</option>
                </Select>
              </Field>
            )}
            {!trackMode && (
              <Field label="Transition">
                <Select value={str(props, 'transition') || 'slide'} onChange={(e) => set({ ...props, transition: e.target.value })}>
                  <option value="slide">Slide</option>
                  <option value="fade">Fade</option>
                </Select>
              </Field>
            )}
            <Field label="Seconds per slide" hint="while autoplaying">
              <Input
                type="number"
                min={2}
                max={20}
                value={num(props, 'interval', 6)}
                onChange={(e) => set({ ...props, interval: Math.min(20, Math.max(2, Number(e.target.value) || 6)) })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[14px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.autoplay === true} onChange={(e) => set({ ...props, autoplay: e.target.checked })} />
              Autoplay — a pause button is always shown with it
            </label>
            <label className="flex items-center gap-2 text-[14px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.loop !== false} onChange={(e) => set({ ...props, loop: e.target.checked })} />
              Loop back to the start
            </label>
            {(mode === 'hero' || mode === 'media' || mode === 'splitScreen') && (
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.kenBurns === true} onChange={(e) => set({ ...props, kenBurns: e.target.checked })} />
                Drift and zoom the pictures slowly
              </label>
            )}
            {trackMode && (
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.drag === true} onChange={(e) => set({ ...props, drag: e.target.checked })} />
                Drag the slides with a mouse
              </label>
            )}
          </div>
          {trackMode && (
            <Field label="Cards in view" hint="per screen size; a fraction such as 1.2 lets the next card peek">
              <div className="grid grid-cols-4 gap-2">
                {(['base', 'laptop', 'tablet', 'mobile'] as const).map((tier) => (
                  <label key={tier} className="text-[11px] text-smoke">
                    {tier === 'base' ? 'Large' : tier === 'laptop' ? 'Desktop' : tier === 'tablet' ? 'Tablet' : 'Mobile'}
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      step={0.05}
                      value={perView[tier] ?? ''}
                      placeholder="auto"
                      onChange={(e) => {
                        const next = { ...perView };
                        const value = Number(e.target.value);
                        if (e.target.value === '' || !Number.isFinite(value)) delete next[tier];
                        else next[tier] = Math.min(6, Math.max(1, value));
                        if (next.base === undefined && Object.keys(next).length > 0) next.base = next.laptop ?? 4;
                        set(withOpt(props, 'perView', Object.keys(next).length ? next : undefined));
                      }}
                    />
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>
      </details>

      {mode === 'hero' && (
        <Repeater
          label="Category strip under the slider"
          items={arr<{ label: string; href: string }>(props, 'strip')}
          onChange={(strip) => set({ ...props, strip })}
          blank={() => ({ label: '', href: '' })}
          addLabel="Add category"
          renderRow={(item, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label">
                <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
              </Field>
              <Field label="Link">
                <Input value={item.href ?? ''} spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
              </Field>
            </div>
          )}
        />
      )}
    </>
  );
}

/* ── Rows and columns ─────────────────────────────────────────────────────────
   The one editor that edits other blocks. A column's block list needs add,
   reorder, delete and an expandable editor, which is what this provides — and
   because a column may hold another row, this editor reaches itself through
   `BlockFields`, carrying a depth so it stops where the renderer stops
   (`MAX_ROW_DEPTH`). Offering a row the renderer would drop is the one thing
   worse than not offering it at all.

   Reordering here is buttons rather than drag-and-drop: dragging *between*
   containers is a different problem from dragging within one, and buttons are
   both reliable and keyboard-accessible. The top-level list keeps its dragging.
   ──────────────────────────────────────────────────────────────────────────── */

type Column = {
  id: string;
  width: { base: number; laptop?: number; tablet?: number; mobile?: number };
  style?: BlockStyle;
  blocks: AnyBlockLike[];
};

type AnyBlockLike = { id: string; type: string; props: Record<string, unknown>; style?: BlockStyle };

const readColumns = (props: Props): Column[] => (Array.isArray(props.columns) ? (props.columns as Column[]) : []);

/** The width a breakpoint takes when nobody has set one — the same chain `rowToCss` walks. */
function inheritedSpan(width: Column['width'], key: 'laptop' | 'tablet' | 'mobile'): number {
  if (key === 'laptop') return width.base;
  if (key === 'tablet') return width.laptop ?? width.base;
  return width.tablet ?? width.laptop ?? width.base;
}

function RowFields({ props, set, depth }: { props: Props; set: Setter; depth: number }) {
  const columns = readColumns(props);
  const [openColumn, setOpenColumn] = useState<string | null>(columns[0]?.id ?? null);

  const setColumns = (next: Column[]) => set({ ...props, columns: next });

  function applyPreset(spans: number[]) {
    const next: Column[] = spans.map((base, i) => {
      const existing = columns[i];
      return {
        id: existing?.id ?? nanoid(10),
        // Stacking full width on a phone is right far more often than not, and
        // it is the first thing anyone would set by hand.
        width: { base, mobile: 12 },
        style: existing?.style,
        blocks: existing?.blocks ?? [],
      };
    });

    // Columns beyond the new layout would take their blocks with them, so
    // their contents move into the last surviving column instead.
    const orphaned = columns.slice(spans.length).flatMap((c) => c.blocks);
    if (orphaned.length && next.length) {
      next[next.length - 1] = {
        ...next[next.length - 1]!,
        blocks: [...next[next.length - 1]!.blocks, ...orphaned],
      };
    }

    setColumns(next);
  }

  const currentPreset = COLUMN_PRESETS.find(
    (preset) =>
      preset.spans.length === columns.length && preset.spans.every((s, i) => s === columns[i]?.width.base),
  );

  return (
    <>
      <Field label="Column layout" hint="widths are twelfths, so 3/4 + 1/4 is 9 + 3">
        <div className="flex flex-wrap gap-1.5">
          {COLUMN_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.spans)}
              className={cn(
                'border-2 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] transition-colors',
                currentPreset?.label === preset.label
                  ? 'border-flare text-bone'
                  : 'border-hairline text-smoke hover:text-bone',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Gap between columns" k="gap" props={props} set={set} placeholder="32px" />
        <Text label="Minimum height" k="minHeight" props={props} set={set} placeholder="none" />
        <Field label="Column alignment" hint="how columns line up when they differ in height">
          <Select
            value={str(props, 'align') || 'stretch'}
            onChange={(e) => set({ ...props, align: e.target.value })}
          >
            <option value="stretch">Stretch — equal height</option>
            <option value="start">Top</option>
            <option value="center">Middle</option>
            <option value="end">Bottom</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-[14px] text-ash">
        <input
          type="checkbox"
          checked={props.reverseOnMobile === true}
          onChange={(e) => {
            const next = { ...props };
            if (e.target.checked) next.reverseOnMobile = true;
            else delete next.reverseOnMobile;
            set(next);
          }}
          className="h-4 w-4 accent-flare"
        />
        Reverse the stacking order on mobile — puts the last column first
      </label>

      <div className="flex flex-col gap-2">
        {columns.map((column, ci) => (
          <ColumnEditor
            key={column.id}
            column={column}
            index={ci}
            total={columns.length}
            open={openColumn === column.id}
            onToggle={() => setOpenColumn(openColumn === column.id ? null : column.id)}
            onChange={(next) => setColumns(columns.map((c) => (c.id === column.id ? next : c)))}
            depth={depth}
          />
        ))}
      </div>
    </>
  );
}

function ColumnEditor({
  column,
  index,
  total,
  open,
  onToggle,
  onChange,
  depth,
}: {
  column: Column;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Column) => void;
  /** The depth of this column's own row; its blocks sit one deeper. */
  depth: number;
}) {
  const [tab, setTab] = useState<'blocks' | 'design'>('blocks');
  const [adding, setAdding] = useState(false);
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const childDepth = depth + 1;
  const canNestRow = childDepth <= MAX_ROW_DEPTH;

  const choices = useMemo(() => {
    const available = canNestRow ? blockTypes : blockTypes.filter((t) => t !== 'row');
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (type) => blockLabels[type].toLowerCase().includes(q) || type.toLowerCase().includes(q),
    );
  }, [canNestRow, query]);

  const setBlocks = (blocks: AnyBlockLike[]) => onChange({ ...column, blocks });

  function move(from: number, to: number) {
    if (to < 0 || to >= column.blocks.length) return;
    const next = [...column.blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setBlocks(next);
  }

  return (
    <div className="border-2 border-hairline bg-ink">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 bg-transparent p-0 text-left"
        >
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-flare">
            Column {index + 1} of {total}
          </span>
          <span className="truncate text-[12px] text-smoke">
            {column.width.base}/12 · {column.blocks.length} block{column.blocks.length === 1 ? '' : 's'}
          </span>
        </button>
        <AdminButton variant="ghost" type="button" onClick={onToggle} className="px-2 py-1">
          {open ? '−' : '+'}
        </AdminButton>
      </div>

      {open && (
        <div className="border-t-2 border-hairline p-3">
          <div className="mb-3 flex gap-1 border-b-2 border-hairline">
            {(['blocks', 'design'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  '-mb-0.5 border-b-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                  tab === t ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
                )}
              >
                {t === 'blocks' ? 'Blocks' : 'Width & design'}
              </button>
            ))}
          </div>

          {tab === 'design' ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {(['base', 'laptop', 'tablet', 'mobile'] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === 'base' ? 'Width' : key === 'laptop' ? '≤1440' : key === 'tablet' ? '≤1024' : '≤768'
                    }
                    hint={key === 'base' ? 'in twelfths' : undefined}
                  >
                    <Select
                      value={String(column.width[key] ?? '')}
                      onChange={(e) => {
                        const width = { ...column.width };
                        if (e.target.value) width[key] = Number(e.target.value);
                        else if (key !== 'base') delete width[key];
                        onChange({ ...column, width });
                      }}
                    >
                      {/* "Inherit" alone made every unset width look the same;
                          naming the width it inherits is the whole answer. */}
                      {key !== 'base' && <option value="">Inherit — {inheritedSpan(column.width, key)}/12</option>}
                      {COLUMN_SPANS.map((n) => (
                        <option key={n} value={n}>
                          {n}/12
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>

              <BlockDesignPanel
                style={column.style}
                onChange={(style) => {
                  const next = { ...column };
                  if (style) next.style = style;
                  else delete next.style;
                  onChange(next);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {column.blocks.length === 0 && (
                <p className="m-0 py-3 text-center text-[13px] text-smoke">This column is empty.</p>
              )}

              {column.blocks.map((child, bi) => (
                <div key={child.id} className="border-2 border-hairline bg-surface">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setOpenBlock(openBlock === child.id ? null : child.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 bg-transparent p-0 text-left"
                    >
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-flare">
                        {blockLabels[child.type as BlockType] ?? child.type}
                      </span>
                      <span className="truncate text-[12px] text-ash">{str(child.props, 'title')}</span>
                    </button>
                    <AdminButton
                      variant="ghost"
                      type="button"
                      onClick={() => move(bi, bi - 1)}
                      disabled={bi === 0}
                      className="px-2 py-1"
                      aria-label="Move up"
                    >
                      ↑
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      type="button"
                      onClick={() => move(bi, bi + 1)}
                      disabled={bi === column.blocks.length - 1}
                      className="px-2 py-1"
                      aria-label="Move down"
                    >
                      ↓
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      type="button"
                      onClick={() => setBlocks(column.blocks.filter((b) => b.id !== child.id))}
                      className="px-2 py-1 text-flare-soft"
                      aria-label="Remove block"
                    >
                      ×
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      type="button"
                      onClick={() => setOpenBlock(openBlock === child.id ? null : child.id)}
                      className="px-2 py-1"
                    >
                      {openBlock === child.id ? '−' : '+'}
                    </AdminButton>
                  </div>

                  {openBlock === child.id && (
                    <div className="flex flex-col gap-4 border-t-2 border-hairline p-3">
                      <BlockFields
                        type={child.type as BlockType}
                        props={child.props ?? {}}
                        depth={childDepth}
                        set={(next) =>
                          setBlocks(column.blocks.map((b) => (b.id === child.id ? { ...b, props: next } : b)))
                        }
                      />
                      <details>
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone">
                          Design options for this block
                        </summary>
                        <div className="pt-4">
                          <BlockDesignPanel
                            blockType={child.type}
                            style={child.style}
                            onChange={(style) =>
                              setBlocks(
                                column.blocks.map((b) => {
                                  if (b.id !== child.id) return b;
                                  const next = { ...b };
                                  if (style) next.style = style;
                                  else delete next.style;
                                  return next;
                                }),
                              )
                            }
                          />
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}

              {adding ? (
                <div className="border-2 border-flare bg-surface p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                      Add a block to this column
                    </span>
                    <AdminButton variant="ghost" type="button" onClick={() => setAdding(false)} className="px-2 py-1">
                      Cancel
                    </AdminButton>
                  </div>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search blocks…"
                    aria-label="Search blocks"
                    className="mb-2 w-full border-2 border-hairline bg-ink px-2.5 py-1.5 text-[12px] text-bone placeholder:text-smoke focus:border-flare focus:outline-none"
                  />
                  {/* Past the nesting limit the renderer drops a row, so the
                      editor stops offering one — and says why, rather than
                      leaving somebody hunting for a block that used to be
                      in the list. */}
                  {!canNestRow && (
                    <p className="m-0 mb-2 text-[11px] text-smoke">
                      Rows nest {MAX_ROW_DEPTH} deep; this column is already at the limit.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {choices.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setBlocks([...column.blocks, { id: nanoid(10), type, props: blankProps(type) }]);
                          setAdding(false);
                          setQuery('');
                        }}
                        className="border-2 border-hairline px-2 py-1.5 text-left text-[12px] text-ash hover:border-flare hover:text-bone"
                      >
                        {blockLabels[type]}
                      </button>
                    ))}
                    {choices.length === 0 && (
                      <p className="m-0 col-span-full py-2 text-[12px] text-smoke">No block matches “{query}”.</p>
                    )}
                  </div>
                </div>
              ) : (
                <AdminButton variant="ghost" type="button" onClick={() => setAdding(true)} className="justify-center">
                  + Add block to this column
                </AdminButton>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── The per-type editors ─────────────────────────────────────────────────── */

/**
 * The heading-or-plain-text control.
 *
 * Rendered for any block whose schema declares `titleAs`, rather than being
 * repeated in fourteen editor branches — adding it to a new block's schema is
 * all that is needed for the control to appear.
 */
function TitleTag({ type, props, set }: { type: BlockType; props: Props; set: Setter }) {
  if (!('titleAs' in blockSchemas[type].shape)) return null;

  return (
    <Field
      label="Title renders as"
      hint="h1–h6 take the theme's heading scale; the plain options take the body style"
    >
      <Select
        value={str(props, 'titleAs')}
        onChange={(e) => {
          const next = { ...props };
          if (e.target.value) next.titleAs = e.target.value;
          else delete next.titleAs;
          set(next);
        }}
      >
        <option value="">Default for this block</option>
        {TEXT_TAGS.map((tag) => (
          <option key={tag} value={tag}>
            {TEXT_TAG_LABELS[tag]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function BlockFields({
  type,
  props,
  set,
  depth = 1,
}: {
  type: BlockType;
  props: Props;
  set: Setter;
  /** How many rows this block sits inside, counting itself if it is one. */
  depth?: number;
}) {
  return (
    <>
      <TypeFields type={type} props={props} set={set} depth={depth} />
      <TitleTag type={type} props={props} set={set} />
    </>
  );
}

function TypeFields({
  type,
  props,
  set,
  depth,
}: {
  type: BlockType;
  props: Props;
  set: Setter;
  depth: number;
}) {
  switch (type) {
    case 'hero': {
      const variant = str(props, 'variant') || 'classic';
      return (
        <>
          <VariantCards
            label="Layout"
            value={variant as (typeof HERO_VARIANTS)[number]}
            options={HERO_VARIANTS}
            labels={HERO_LABELS}
            wires={HERO_WIREFRAMES}
            onChange={(v) => set(withOpt(props, 'variant', v === 'classic' ? undefined : v))}
          />
          {variant !== 'classic' && (
            <>
              <MediaInput label="Image" hint={variant === 'split' ? 'the visual beside the text' : 'fills the hero'} value={str(props, 'imageUrl') || undefined} onChange={(v) => set(withOpt(props, 'imageUrl', v))} />
              <MediaInput label="Video" hint="optional; plays muted in a loop, with a pause button" accept="video" value={str(props, 'videoUrl') || undefined} onChange={(v) => set(withOpt(props, 'videoUrl', v))} />
              <Text label="Image description" k="alt" props={props} set={set} hint="for screen readers" />
              <OptLink label="Announcement pill" props={props} set={set} k="announcement" />
              <div className="grid gap-3 sm:grid-cols-3">
                {(variant === 'mediaCenter' || variant === 'mediaBottomLeft' || variant === 'shaped' || variant === 'layered') && (
                  <>
                    <Field label="Height">
                      <Select value={str(props, 'height') || 'tall'} onChange={(e) => set({ ...props, height: e.target.value })}>
                        <option value="auto">Fit the content</option>
                        <option value="tall">Tall — most of the screen</option>
                        <option value="screen">Full screen</option>
                      </Select>
                    </Field>
                    <Field label="Darken the media" hint="keeps text readable">
                      <Select value={str(props, 'overlay') || 'medium'} onChange={(e) => set({ ...props, overlay: e.target.value })}>
                        <option value="none">None</option>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="strong">Strong</option>
                      </Select>
                    </Field>
                  </>
                )}
                {variant === 'split' && (
                  <Field label="Visual on the">
                    <Select value={str(props, 'mediaSide') || 'right'} onChange={(e) => set({ ...props, mediaSide: e.target.value })}>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </Select>
                  </Field>
                )}
              </div>
              {(variant === 'mediaCenter' || variant === 'mediaBottomLeft' || variant === 'layered') && (
                <label className="flex items-center gap-2 text-[14px] text-ash">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.scrollCue === true} onChange={(e) => set(withOpt(props, 'scrollCue', e.target.checked || undefined))} />
                  Show a scroll-down cue
                </label>
              )}
              {variant === 'layered' && (
                <>
                  <Repeater
                    label="Layers (up to three) — furthest back first"
                    items={arr<{ imageUrl?: string; alt?: string; depth?: string }>(props, 'layers')}
                    onChange={(layers) => set({ ...props, layers })}
                    blank={() => ({ imageUrl: '', depth: 'middle' })}
                    addLabel="Add a layer"
                    renderRow={(item, update) => (
                      <>
                        <MediaInput label="Picture" hint="a cut-out PNG sits best over the background" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Depth" hint="how far it moves as the page scrolls">
                            <Select value={item.depth ?? 'middle'} onChange={(e) => update({ depth: e.target.value })}>
                              <option value="back">Back — moves least</option>
                              <option value="middle">Middle</option>
                              <option value="front">Front — moves most</option>
                            </Select>
                          </Field>
                          <Field label="Description" hint="for screen readers; leave empty if it is decoration">
                            <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                          </Field>
                        </div>
                      </>
                    )}
                  />
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.pointerParallax === true} onChange={(e) => set({ ...props, pointerParallax: e.target.checked })} />
                    The layers also lean towards the mouse
                  </label>
                </>
              )}
            </>
          )}
          <Text label="Kicker" k="kicker" props={props} set={set} hint="e.g. Services / 02" />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Lede" k="lede" props={props} set={set} rows={2} />
          <Area label="Body" k="body" props={props} set={set} rows={4} />
          <LinksRepeater items={arr<LinkItem>(props, 'links')} onChange={(links) => set({ ...props, links })} />
          {variant === 'classic' && (
            <ClassicHeroFigure props={props} set={set} />
          )}
        </>
      );
    }

    case 'carousel':
      return <CarouselFields props={props} set={set} />;

    case 'marquee': {
      const kind = str(props, 'kind') || 'logos';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Shows">
              <Select value={kind} onChange={(e) => set({ ...props, kind: e.target.value })}>
                <option value="logos">Logos</option>
                <option value="quotes">Quotes</option>
                <option value="chips">Tags</option>
                <option value="text">Big text</option>
                <option value="photos">Photos</option>
              </Select>
            </Field>
            <Field label="Rows">
              <Select value={String(num(props, 'rows', 1))} onChange={(e) => set({ ...props, rows: Number(e.target.value) })}>
                <option value="1">One</option>
                <option value="2">Two, opposite directions</option>
              </Select>
            </Field>
            <Field label="Speed">
              <Select value={str(props, 'speed') || 'normal'} onChange={(e) => set({ ...props, speed: e.target.value })}>
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Moves" k="direction" fallback="left" options={[['left', 'To the left'], ['right', 'To the right']]} props={props} set={set} />
            {kind === 'photos' && (
              <PropSelect label="Photo shape" k="photoRatio" fallback="4/3" options={[['4/3', 'Landscape 4:3'], ['3/4', 'Portrait 3:4'], ['1/1', 'Square'], ['16/9', 'Wide 16:9']]} props={props} set={set} />
            )}
            {kind === 'text' && (
              <PropSelect label="Between items" k="separator" fallback="dot" options={[['dot', 'Dot •'], ['star', 'Star ✦'], ['slash', 'Slash /'], ['none', 'Nothing']]} props={props} set={set} />
            )}
            <div className="flex items-end pb-3">
              <PropCheck label="Slow down on hover, instead of pausing" k="hoverSlow" props={props} set={set} />
            </div>
          </div>
          <Repeater
            label="Items"
            items={arr<{ label?: string; imageUrl?: string; quote?: string; name?: string; role?: string; rating?: number; href?: string }>(props, 'items')}
            onChange={(items) => set({ ...props, items })}
            blank={() => ({ label: '' })}
            addLabel="Add item"
            renderRow={(item, update) => (
              <>
                {kind === 'quotes' ? (
                  <>
                    <Field label="Quote">
                      <Textarea rows={2} value={item.quote ?? ''} onChange={(e) => update({ quote: e.target.value || undefined })} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name">
                        <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value || undefined })} />
                      </Field>
                      <Field label="Role">
                        <Input value={item.role ?? ''} onChange={(e) => update({ role: e.target.value || undefined })} />
                      </Field>
                    </div>
                    <RatingSelect value={item.rating} onChange={(rating) => update({ rating })} />
                  </>
                ) : (
                  <Field
                    label={kind === 'logos' ? 'Name' : kind === 'photos' ? 'Caption' : 'Label'}
                    hint={kind === 'logos' ? 'used as alt text, or shown when there is no logo' : kind === 'photos' ? 'shown under the photo and describes it' : undefined}
                  >
                    <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value || undefined })} />
                  </Field>
                )}
                {kind !== 'text' && (
                  <MediaInput label={kind === 'logos' ? 'Logo' : kind === 'quotes' || kind === 'photos' ? 'Photo' : 'Icon'} value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                )}
                <Field label="Link" hint="optional">
                  <Input value={item.href ?? ''} spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
                </Field>
              </>
            )}
          />
        </>
      );
    }

    case 'stackedPanels':
      return (
        <Repeater
          label="Panels"
          items={arr<PanelItem>(props, 'panels')}
          onChange={(panels) => set({ ...props, panels })}
          blank={(): PanelItem => ({ title: '' })}
          addLabel="Add panel"
          renderRow={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Eyebrow">
                  <Input value={item.eyebrow ?? ''} onChange={(e) => update({ eyebrow: e.target.value || undefined })} />
                </Field>
                <Field label="Title">
                  <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                </Field>
              </div>
              <Field label="Text">
                <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} />
              </Field>
              <MediaInput label="Image" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
              <MediaInput label="Video" accept="video" value={item.videoUrl} onChange={(videoUrl) => update({ videoUrl })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Button label">
                  <Input value={item.buttonLabel ?? ''} onChange={(e) => update({ buttonLabel: e.target.value || undefined })} />
                </Field>
                <Field label="Link">
                  <Input value={item.href ?? ''} spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
                </Field>
              </div>
            </>
          )}
        />
      );

    case 'heading': {
      const kinetic = str(props, 'animation') === 'kinetic';
      return (
        <>
          <ToneField props={props} set={set} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centred']]} props={props} set={set} />
            <PropSelect
              label="Size"
              k="size"
              fallback="large"
              options={[['medium', 'Medium'], ['large', 'Large'], ['display', 'Display — very large'], ['lede', 'Statement — large body text']]}
              props={props}
              set={set}
            />
            <PropSelect label="Layout" k="layout" fallback="stacked" options={[['stacked', 'Subtitle below'], ['split', 'Subtitle beside the heading']]} props={props} set={set} />
            {/* Only means anything beside the heading; stacked has nothing to line up. */}
            {props.layout === 'split' && (
              <PropSelect
                label="Line them up"
                k="splitAlign"
                fallback="center"
                options={[['top', 'At the top'], ['center', 'Centred'], ['bottom', 'At the bottom']]}
                props={props}
                set={set}
              />
            )}
            <PropSelect label="Divider" k="divider" fallback="none" options={[['none', 'None'], ['line', 'Thin line'], ['accent', 'Short accent bar']]} props={props} set={set} />
            <PropSelect label="Letters" k="textStyle" fallback="solid" options={[['solid', 'Solid'], ['outline', 'Outlined'], ['gradient', 'Gradient']]} props={props} set={set} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Badge" k="badge" props={props} set={set} hint="a small pill above, e.g. New" />
            <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          </div>
          <Area label="Heading" k="title" props={props} set={set} rows={2} />
          <PropSelect
            label="Animation"
            k="animation"
            fallback="none"
            options={[['none', 'None'], ['kinetic', 'Words light up as it scrolls into view']]}
            hint="shown fully lit for visitors who ask for less motion"
            props={props}
            set={set}
          />
          {!kinetic && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Text label="Highlight these words" k="highlight" props={props} set={set} hint="copied exactly from the heading" />
                <PropSelect
                  label="Highlight style"
                  k="highlightStyle"
                  fallback="color"
                  options={[
                    ['color', 'Accent colour'],
                    ['marker', 'Marker'],
                    ['underline', 'Underline'],
                    ['circle', 'Hand-drawn circle'],
                    ['curly', 'Curly underline'],
                    ['strike', 'Struck through'],
                    ['zigzag', 'Zigzag underline'],
                    ['double', 'Double underline'],
                    ['outline', 'Outlined letters'],
                    ['gradient', 'Gradient'],
                  ]}
                  props={props}
                  set={set}
                />
              </div>
              <StringListRepeater label="Changing words after the heading (optional)" items={arr<string>(props, 'rotating')} onChange={(rotating) => set({ ...props, rotating: rotating.slice(0, 8) })} />
              {arr<string>(props, 'rotating').length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <PropSelect
                    label="How the words change"
                    k="rotateEffect"
                    fallback="typing"
                    options={[['typing', 'Typed letter by letter'], ['slide', 'Slide up'], ['fade', 'Fade'], ['flip', 'Flip'], ['blur', 'Blur in']]}
                    hint="visitors who ask for less motion see the first word"
                    props={props}
                    set={set}
                  />
                  {(str(props, 'rotateEffect') || 'typing') === 'typing' && (
                    <PropSelect label="Typing speed" k="typingSpeed" fallback="normal" options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} props={props} set={set} />
                  )}
                </div>
              )}
            </>
          )}
          <Area label="Subtitle" k="subtitle" props={props} set={set} rows={2} />
        </>
      );
    }

    case 'buttons':
      return (
        <>
          <ToneField props={props} set={set} />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} props={props} set={set} />
            <div className="flex items-end pb-3">
              <PropCheck label="Stretch to full width" k="fullWidth" props={props} set={set} />
            </div>
          </div>
          <Repeater
            label="Buttons (up to 6)"
            items={arr<ButtonItem>(props, 'items')}
            onChange={(items) => set({ ...props, items: items.slice(0, 6) })}
            blank={(): ButtonItem => ({ label: 'Button', href: '/' })}
            addLabel="Add button"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label" hint="also the name screen readers hear">
                    <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
                  </Field>
                  <Field label="Link">
                    <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() })} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Style">
                    <Select value={item.style ?? 'primary'} onChange={(e) => update({ style: e.target.value })}>
                      <option value="primary">Filled</option>
                      <option value="outline">Outlined</option>
                      <option value="soft">Soft</option>
                      <option value="text">Text link</option>
                    </Select>
                  </Field>
                  <Field label="Icon">
                    <Select value={item.icon ?? 'none'} onChange={(e) => update({ icon: e.target.value })}>
                      <option value="none">None</option>
                      <option value="arrow">Arrow</option>
                      <option value="plus">Plus</option>
                      <option value="play">Play</option>
                      <option value="mail">Mail</option>
                    </Select>
                  </Field>
                  <Field label="Icon side">
                    <Select value={item.iconSide ?? 'right'} onChange={(e) => update({ iconSide: e.target.value })}>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.iconOnly === true} onChange={(e) => update({ iconOnly: e.target.checked })} />
                    Icon only
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.shadow === true} onChange={(e) => update({ shadow: e.target.checked })} />
                    Shadow
                  </label>
                </div>
              </>
            )}
          />
        </>
      );

    case 'notice':
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Kind" k="kind" fallback="info" options={[['info', 'Information'], ['success', 'Success'], ['warning', 'Warning'], ['danger', 'Danger']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} props={props} set={set} />
            <PropSelect label="Width" k="width" fallback="full" options={[['full', 'Full width'], ['fit', 'Fit the text']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre']]} props={props} set={set} />
          </div>
          <Text label="Title" k="title" props={props} set={set} hint="optional, shown in bold" />
          <Area label="Message" k="text" props={props} set={set} rows={2} />
          <OptLink label="Link" props={props} set={set} k="link" />
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-[14px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.icon !== false} onChange={(e) => set({ ...props, icon: e.target.checked })} />
              Show the icon
            </label>
            <PropCheck label="Visitors can close it" k="dismissible" props={props} set={set} />
          </div>
        </>
      );

    case 'progress': {
      const rings = str(props, 'kind') === 'rings';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Shape" k="kind" fallback="bars" options={[['bars', 'Bars'], ['rings', 'Rings']]} props={props} set={set} />
            <PropSelect label="Thickness" k="thickness" fallback="regular" options={[['thin', 'Thin'], ['regular', 'Regular'], ['bold', 'Bold']]} props={props} set={set} />
            {rings ? (
              <PropSelect label="Label" k="labelPosition" fallback="below" options={[['below', 'Below the ring'], ['beside', 'Beside the ring']]} props={props} set={set} />
            ) : (
              <div className="flex items-end pb-3">
                <PropCheck label="Value in a bubble on the bar" k="tooltip" props={props} set={set} />
              </div>
            )}
          </div>
          <Repeater
            label="Items"
            items={arr<ProgressItem>(props, 'items')}
            onChange={(items) => set({ ...props, items: items.slice(0, 12) })}
            blank={(): ProgressItem => ({ label: '', value: 50 })}
            addLabel="Add item"
            renderRow={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[2fr_0.8fr_2fr]">
                <Field label="Label">
                  <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Value (%)">
                  <Input type="number" min={0} max={100} value={item.value ?? 0} onChange={(e) => update({ value: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
                </Field>
                <Field label="Note" hint="optional">
                  <Input value={item.note ?? ''} onChange={(e) => update({ note: e.target.value || undefined })} />
                </Field>
              </div>
            )}
          />
        </>
      );
    }

    case 'countdown': {
      const units = arr<string>(props, 'units').length ? arr<string>(props, 'units') : ['days', 'hours', 'minutes', 'seconds'];
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <Field label="Counts down to" hint="your local time">
            <Input type="datetime-local" value={toLocalInput(str(props, 'target'))} onChange={(e) => set({ ...props, target: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Style" k="style" fallback="boxed" options={[['boxed', 'Boxed numbers'], ['plain', 'Plain numbers'], ['inline', 'One line']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="center" options={[['center', 'Centre'], ['left', 'Left']]} props={props} set={set} />
          </div>
          <Field label="Show">
            <div className="flex flex-wrap gap-4">
              {(['months', 'days', 'hours', 'minutes', 'seconds'] as const).map((unit) => (
                <label key={unit} className="flex items-center gap-2 text-[14px] capitalize text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={units.includes(unit)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...units, unit] : units.filter((u) => u !== unit);
                      const ordered = ['months', 'days', 'hours', 'minutes', 'seconds'].filter((u) => next.includes(u));
                      if (ordered.length) set({ ...props, units: ordered });
                    }}
                  />
                  {unit}
                </label>
              ))}
            </div>
          </Field>
          <PropCheck label="Colons between the numbers" k="dividers" props={props} set={set} />
          <Text label="Text once it is over" k="expiredText" props={props} set={set} placeholder="We are live." />
        </>
      );
    }

    case 'socialLinks': {
      const custom = str(props, 'source') === 'custom';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Label above the links" k="title" props={props} set={set} placeholder="Follow us" />
          <PropSelect
            label="Links"
            k="source"
            fallback="site"
            options={[['site', 'The site’s links (Menus → Social links)'], ['custom', 'A list just for this block']]}
            props={props}
            set={set}
          />
          {custom && (
            <Repeater
              label="Profiles"
              items={arr<SocialItem>(props, 'links')}
              onChange={(links) => set({ ...props, links: links.slice(0, 10) })}
              blank={(): SocialItem => ({ network: 'linkedin', href: '' })}
              addLabel="Add profile"
              renderRow={(item, update) => <SocialRowFields item={item} update={update} />}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Style"
              k="style"
              fallback="outlined"
              options={[['plain', 'Icons'], ['outlined', 'Outlined circles'], ['filled', 'Filled circles'], ['boxed', 'Boxed'], ['text', 'Names']]}
              props={props}
              set={set}
            />
            <PropSelect label="Size" k="size" fallback="medium" options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="center" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} props={props} set={set} />
          </div>
          <PropCheck label="Use each network’s brand colour" k="brandColors" props={props} set={set} />
        </>
      );
    }

    case 'pricing': {
      const switching = str(props, 'billing') === 'switch';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Layout" k="layout" fallback="cards" options={[['cards', 'Separate cards'], ['contained', 'One panel']]} props={props} set={set} />
            <PropSelect label="Billing" k="billing" fallback="single" options={[['single', 'One price'], ['switch', 'Monthly / yearly switch']]} props={props} set={set} />
            <PropSelect label="Button" k="buttonPosition" fallback="bottom" options={[['bottom', 'Below the features'], ['top', 'Above the features']]} props={props} set={set} />
          </div>
          {switching && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Monthly label" k="monthlyLabel" props={props} set={set} placeholder="Monthly" />
              <Text label="Yearly label" k="yearlyLabel" props={props} set={set} placeholder="Yearly" />
              <Text label="Yearly note" k="yearlyNote" props={props} set={set} placeholder="Save 20%" />
            </div>
          )}
          <Repeater
            label="Plans (up to 4)"
            items={arr<PlanItem>(props, 'plans')}
            onChange={(plans) => set({ ...props, plans: plans.slice(0, 4) })}
            blank={(): PlanItem => ({ name: '', price: '' })}
            addLabel="Add plan"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Tagline">
                    <Input value={item.tagline ?? ''} onChange={(e) => update({ tagline: e.target.value || undefined })} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={switching ? 'Monthly price' : 'Price'} hint="shown as written">
                    <Input value={item.price ?? ''} placeholder="$29" onChange={(e) => update({ price: e.target.value })} />
                  </Field>
                  <Field label="Period">
                    <Input value={item.period ?? ''} placeholder="/ month" onChange={(e) => update({ period: e.target.value || undefined })} />
                  </Field>
                  {switching && (
                    <>
                      <Field label="Yearly price">
                        <Input value={item.yearlyPrice ?? ''} placeholder="$23" onChange={(e) => update({ yearlyPrice: e.target.value || undefined })} />
                      </Field>
                      <Field label="Yearly period">
                        <Input value={item.yearlyPeriod ?? ''} placeholder="/ month, billed yearly" onChange={(e) => update({ yearlyPeriod: e.target.value || undefined })} />
                      </Field>
                    </>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Badge" hint="e.g. Most popular">
                    <Input value={item.badge ?? ''} onChange={(e) => update({ badge: e.target.value || undefined })} />
                  </Field>
                  <label className="flex items-end gap-2 pb-3 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.featured === true} onChange={(e) => update({ featured: e.target.checked })} />
                    Highlight this plan
                  </label>
                </div>
                <Field label="Description">
                  <Textarea rows={2} value={item.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
                </Field>
                <Field label="Features" hint="one per line; start a line with - for a feature the plan does not include">
                  <Textarea
                    rows={5}
                    value={(item.features ?? []).map((f) => (f.included === false ? `- ${f.text}` : f.text)).join('\n')}
                    onChange={(e) =>
                      update({
                        features: e.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .slice(0, 16)
                          .map((line) => (line.startsWith('-') ? { text: line.replace(/^-\s*/, ''), included: false } : { text: line, included: true })),
                      })
                    }
                  />
                </Field>
                <ItemLink value={item.button} onChange={(button) => update({ button })} />
              </>
            )}
          />
          <Text label="Footnote" k="footnote" props={props} set={set} placeholder="Prices exclude VAT." />
        </>
      );
    }

    case 'team':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Layout"
              k="variant"
              fallback="cards"
              options={[['cards', 'Cards'], ['overlay', 'Details on hover'], ['split', 'Profile beside the portraits']]}
              props={props}
              set={set}
            />
            <Field label="Per row">
              <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4">Four</option>
              </Select>
            </Field>
            <PropSelect label="Photo on hover" k="hover" fallback="none" options={[['none', 'No effect'], ['scale', 'Zoom in'], ['greyscale', 'Greyscale until hovered']]} props={props} set={set} />
          </div>
          <Repeater
            label="Members"
            items={arr<MemberItem>(props, 'members')}
            onChange={(members) => set({ ...props, members: members.slice(0, 16) })}
            blank={(): MemberItem => ({ name: '' })}
            addLabel="Add member"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Role">
                    <Input value={item.role ?? ''} onChange={(e) => update({ role: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Short bio">
                  <Textarea rows={2} value={item.bio ?? ''} onChange={(e) => update({ bio: e.target.value || undefined })} />
                </Field>
                <MediaInput label="Photo" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                <Repeater
                  label="Profiles (up to 4)"
                  items={item.links ?? []}
                  onChange={(links) => update({ links: links.slice(0, 4) })}
                  blank={(): SocialItem => ({ network: 'linkedin', href: '' })}
                  addLabel="Add profile"
                  renderRow={(link, updateLink) => <SocialRowFields item={link} update={updateLink} />}
                />
              </>
            )}
          />
        </>
      );

    case 'compare':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-2">
            {(['before', 'after'] as const).map((side) => (
              <div key={side} className="grid gap-3">
                <MediaInput label={side === 'before' ? 'Before' : 'After'} value={str(props, `${side}Url`) || undefined} onChange={(url) => set({ ...props, [`${side}Url`]: url ?? '' })} />
                <Text label="Label on the picture" k={`${side}Label`} props={props} set={set} placeholder={side === 'before' ? 'Before' : 'After'} />
                <Text label="Description" k={`${side}Alt`} props={props} set={set} hint="for screen readers" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Direction" k="orientation" fallback="horizontal" options={[['horizontal', 'Side by side'], ['vertical', 'Top and bottom']]} props={props} set={set} />
            <PropSelect label="Handle" k="handle" fallback="circle" options={[['circle', 'Round handle'], ['arrows', 'Arrows'], ['line', 'Line only']]} props={props} set={set} />
            <PropSelect
              label="Shape"
              k="ratio"
              fallback="16/9"
              options={[['16/9', 'Wide 16:9'], ['4/3', '4:3'], ['1/1', 'Square'], ['3/4', 'Portrait 3:4'], ['21/9', 'Cinema 21:9']]}
              props={props}
              set={set}
            />
          </div>
          <Field label="Handle starts at (%)">
            <Input type="number" min={0} max={100} value={num(props, 'start', 50)} onChange={(e) => set({ ...props, start: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })} />
          </Field>
          <Text label="Caption" k="caption" props={props} set={set} />
        </>
      );

    case 'video': {
      const parsed = parseVideoUrl(str(props, 'source'));
      const where =
        parsed === null
          ? 'A YouTube or Vimeo link, or a video uploaded to the media library'
          : parsed.kind === 'file'
            ? 'A video from the media library'
            : `Loads from ${VIDEO_HOST_LABEL[parsed.kind]} only when a visitor presses play`;
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <Field label="Video" hint={where}>
            <Input value={str(props, 'source')} placeholder="https://www.youtube.com/watch?v=…" spellCheck={false} onChange={(e) => set({ ...props, source: e.target.value.trim() })} />
          </Field>
          <Text label="Video title" k="videoTitle" props={props} set={set} hint="names the player and its play button for screen readers" />
          <MediaInput label="Preview picture (optional)" value={str(props, 'posterUrl') || undefined} onChange={(posterUrl) => set({ ...props, posterUrl: posterUrl || undefined })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Plays" k="display" fallback="inline" options={[['inline', 'In place'], ['button', 'Over the page']]} props={props} set={set} />
            <PropSelect label="Shape" k="ratio" fallback="16/9" options={[['16/9', 'Wide 16:9'], ['4/3', '4:3'], ['1/1', 'Square'], ['21/9', 'Cinema 21:9']]} props={props} set={set} />
            <PropSelect label="Play button" k="buttonStyle" fallback="filled" options={[['filled', 'Filled'], ['outlined', 'Outlined'], ['blurred', 'Frosted glass']]} props={props} set={set} />
            <PropSelect label="Button size" k="buttonSize" fallback="medium" options={SIZE_OPTIONS} props={props} set={set} />
          </div>
          <Text label="Text beside the play button" k="buttonLabel" props={props} set={set} placeholder="Watch the film" />
          <Text label="Caption" k="caption" props={props} set={set} />
          <Repeater
            label="More videos — a playlist (up to 12)"
            items={arr<PlaylistItem>(props, 'playlist')}
            onChange={(playlist) => set({ ...props, playlist: playlist.slice(0, 12) })}
            blank={(): PlaylistItem => ({ source: '', videoTitle: '' })}
            addLabel="Add video"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_0.6fr]">
                  <Field label="Video" hint="YouTube, Vimeo or the media library">
                    <Input value={item.source ?? ''} placeholder="https://…" spellCheck={false} onChange={(e) => update({ source: e.target.value.trim() })} />
                  </Field>
                  <Field label="Title">
                    <Input value={item.videoTitle ?? ''} onChange={(e) => update({ videoTitle: e.target.value })} />
                  </Field>
                  <Field label="Length">
                    <Input value={item.duration ?? ''} placeholder="4:12" onChange={(e) => update({ duration: e.target.value || undefined })} />
                  </Field>
                </div>
                <MediaInput label="Preview picture" value={item.posterUrl} onChange={(posterUrl) => update({ posterUrl })} />
              </>
            )}
          />
          {arr<PlaylistItem>(props, 'playlist').length > 0 && (
            <PropSelect label="Playlist sits" k="playlistPosition" fallback="side" options={[['side', 'Beside the player'], ['below', 'Below the player']]} props={props} set={set} />
          )}
        </>
      );
    }

    case 'gallery': {
      const layout = str(props, 'layout') || 'grid';
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Layout" k="layout" fallback="grid" options={[['grid', 'Even grid'], ['masonry', 'Masonry — natural shapes'], ['metro', 'Metro — mixed tile sizes']]} props={props} set={set} />
            <Field label="Per row">
              <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <PropSelect label="Space between" k="gap" fallback="medium" options={[['none', 'None'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} props={props} set={set} />
            {layout === 'grid' && (
              <PropSelect label="Picture shape" k="ratio" fallback="square" options={[['square', 'Square'], ['landscape', 'Landscape'], ['portrait', 'Portrait']]} props={props} set={set} />
            )}
            <PropSelect label="On hover" k="hover" fallback="zoom" options={[['zoom', 'Zoom in'], ['lift', 'Lift'], ['greyscale', 'Greyscale until hovered'], ['none', 'Nothing']]} props={props} set={set} />
            <PropSelect label="Captions" k="captions" fallback="none" options={[['none', 'Hidden'], ['below', 'Below each picture'], ['overlay', 'Over each picture']]} props={props} set={set} />
          </div>
          <label className="flex items-center gap-2 text-[14px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.lightbox !== false} onChange={(e) => set({ ...props, lightbox: e.target.checked })} />
            Open pictures in a full-screen viewer
          </label>
          <Repeater
            label="Pictures (up to 40)"
            items={arr<GalleryImage>(props, 'images')}
            onChange={(images) => set({ ...props, images: images.slice(0, 40) })}
            blank={(): GalleryImage => ({ url: '' })}
            addLabel="Add picture"
            renderRow={(item, update) => (
              <>
                <MediaInput label="Picture" value={item.url || undefined} onChange={(url) => update({ url: url ?? '' })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Description" hint="for screen readers">
                    <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                  </Field>
                  <Field label="Caption">
                    <Input value={item.caption ?? ''} onChange={(e) => update({ caption: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Link (optional)" hint="a linked picture opens the link instead of the viewer">
                  <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
                </Field>
              </>
            )}
          />
          <OptLink label="Button below the pictures" props={props} set={set} k="link" />
        </>
      );
    }

    case 'horizontalAccordion':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Opens" k="trigger" fallback="click" options={[['click', 'On click or tap'], ['hover', 'On hover (click still works)']]} props={props} set={set} />
            <PropSelect label="Height" k="height" fallback="medium" options={[['medium', 'Medium'], ['tall', 'Tall']]} props={props} set={set} />
          </div>
          <Repeater
            label="Panels (2 to 6)"
            items={arr<AccordionPanel>(props, 'panels')}
            onChange={(panels) => set({ ...props, panels: panels.slice(0, 6) })}
            blank={(): AccordionPanel => ({ title: '' })}
            addLabel="Add panel"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title">
                    <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label="Small label" hint="shown when the panel is open">
                    <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Text">
                  <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} />
                </Field>
                <MediaInput label="Picture" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl: imageUrl || undefined })} />
                <Field label="Picture description" hint="for screen readers">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
                <ItemLink value={item.link} onChange={(link) => update({ link })} />
              </>
            )}
          />
        </>
      );

    case 'projects': {
      const layout = str(props, 'layout') || 'classic';
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Layout"
              k="layout"
              fallback="classic"
              options={[['classic', 'Classic cards'], ['overlay', 'Details over the picture'], ['minimal', 'Minimal'], ['metro', 'Metro — mixed tile sizes'], ['list', 'Big-text list'], ['carousel', 'Carousel — swipe through']]}
              props={props}
              set={set}
            />
            {layout !== 'list' && (
              <>
                <Field label="Per row">
                  <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                    <option value="2">Two</option>
                    <option value="3">Three</option>
                    <option value="4">Four</option>
                  </Select>
                </Field>
                <PropSelect
                  label="On hover"
                  k="hover"
                  fallback="zoom"
                  options={[['zoom', 'Zoom in'], ['swap', 'Show the second picture'], ['greyscale', 'Greyscale until hovered'], ['none', 'Nothing']]}
                  props={props}
                  set={set}
                />
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-end gap-2 pb-3 text-[14px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.filter !== false} onChange={(e) => set({ ...props, filter: e.target.checked })} />
              Filter by category
            </label>
            {props.filter !== false && <Text label="“All” button" k="allLabel" props={props} set={set} placeholder="All" />}
          </div>
          <Repeater
            label="Projects (up to 24)"
            items={arr<ProjectItem>(props, 'items')}
            onChange={(items) => set({ ...props, items: items.slice(0, 24) })}
            blank={(): ProjectItem => ({ title: '' })}
            addLabel="Add project"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-[2fr_1.2fr_0.8fr]">
                  <Field label="Title">
                    <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label="Category" hint="also the filter">
                    <Input value={item.category ?? ''} onChange={(e) => update({ category: e.target.value || undefined })} />
                  </Field>
                  <Field label="Year">
                    <Input value={item.year ?? ''} onChange={(e) => update({ year: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Summary" hint="shown by the classic layout">
                  <Textarea rows={2} value={item.summary ?? ''} onChange={(e) => update({ summary: e.target.value || undefined })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MediaInput label="Picture" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl: imageUrl || undefined })} />
                  <MediaInput label="Second picture (hover)" value={item.hoverImageUrl} onChange={(hoverImageUrl) => update({ hoverImageUrl: hoverImageUrl || undefined })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Picture description" hint="for screen readers">
                    <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                  </Field>
                  <Field label="Link">
                    <Input value={item.href ?? ''} placeholder="/path or https://" spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
                  </Field>
                </div>
              </>
            )}
          />
          <OptLink label="Button below the projects" props={props} set={set} k="link" />
        </>
      );
    }

    case 'map': {
      const osm = (str(props, 'provider') || 'openstreetmap') === 'openstreetmap';
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <Field label="Address" hint="line breaks are kept">
            <Textarea rows={3} value={str(props, 'address')} onChange={(e) => set({ ...props, address: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <PropSelect label="Map from" k="provider" fallback="openstreetmap" options={[['openstreetmap', 'OpenStreetMap'], ['google', 'Google Maps']]} props={props} set={set} />
            <OptNumber label="Latitude" k="lat" props={props} set={set} hint={osm ? 'needed to draw the map' : 'optional'} />
            <OptNumber label="Longitude" k="lng" props={props} set={set} hint={osm ? 'needed to draw the map' : 'optional'} />
            <Field label="Zoom" hint="3 = country, 19 = street">
              <Input type="number" min={3} max={19} value={num(props, 'zoom', 15)} onChange={(e) => set({ ...props, zoom: Math.min(19, Math.max(3, Math.round(Number(e.target.value) || 15))) })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Layout" k="layout" fallback="card" options={[['card', 'Card over the map'], ['split', 'Details beside the map'], ['full', 'Full width, card over it']]} props={props} set={set} />
            <PropSelect label="Height" k="height" fallback="medium" options={[['short', 'Short'], ['medium', 'Medium'], ['tall', 'Tall']]} props={props} set={set} />
            <div className="flex items-end pb-3">
              <PropCheck label="Greyscale map" k="greyscale" props={props} set={set} />
            </div>
          </div>
          <Repeater
            label="Details (up to 6)"
            items={arr<DetailItem>(props, 'details')}
            onChange={(details) => set({ ...props, details: details.slice(0, 6) })}
            blank={(): DetailItem => ({ label: '', value: '' })}
            addLabel="Add detail"
            renderRow={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <Field label="Label">
                  <Input value={item.label ?? ''} placeholder="Opening hours" onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Value">
                  <Input value={item.value ?? ''} onChange={(e) => update({ value: e.target.value })} />
                </Field>
              </div>
            )}
          />
          <OptLink label="Button on the card" props={props} set={set} k="link" />
        </>
      );
    }

    case 'chart': {
      const series = arr<{ name: string }>(props, 'series');
      const rows = arr<ChartRow>(props, 'rows');
      const kind = str(props, 'kind') || 'column';
      const round = kind === 'pie' || kind === 'doughnut';
      const count = round ? 1 : Math.max(1, Math.min(4, series.length));
      const fit = (values: number[] | undefined, n: number) => Array.from({ length: n }, (_, i) => values?.[i] ?? 0);
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Chart"
              k="kind"
              fallback="column"
              options={[['column', 'Columns'], ['bar', 'Horizontal bars'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['doughnut', 'Doughnut']]}
              props={props}
              set={set}
            />
            <PropSelect label="Colours" k="palette" fallback="multi" options={[['multi', 'Several colours'], ['accent', 'Shades of the accent'], ['mono', 'Shades of the text colour']]} props={props} set={set} />
            <PropSelect label="Height" k="height" fallback="medium" options={[['small', 'Short'], ['medium', 'Medium'], ['large', 'Tall']]} props={props} set={set} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Before each value" k="prefix" props={props} set={set} placeholder="$" />
            <Text label="After each value" k="suffix" props={props} set={set} placeholder="%" />
          </div>
          <div className="flex flex-wrap gap-5">
            <PropCheckOn label="Show the values" k="values" props={props} set={set} />
            <PropCheckOn label="Show the key" k="legend" props={props} set={set} />
            {!round && <PropCheckOn label="Grid lines and scale" k="grid" props={props} set={set} />}
            <PropCheckOn label="Draw in when scrolled to" k="animate" props={props} set={set} />
          </div>
          <Repeater
            label={round ? 'Series — a pie shows the first' : 'Series (up to 4)'}
            items={series}
            onChange={(next) => {
              const kept = next.slice(0, 4);
              set({ ...props, series: kept, rows: rows.map((row) => ({ ...row, values: fit(row.values, Math.max(1, kept.length)) })) });
            }}
            blank={() => ({ name: '' })}
            addLabel="Add series"
            renderRow={(item, update) => (
              <Field label="Name" hint="shown in the key">
                <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
              </Field>
            )}
          />
          <Repeater
            label={round ? 'Slices (up to 16)' : 'Data (up to 16 rows)'}
            items={rows}
            onChange={(next) => set({ ...props, rows: next.slice(0, 16) })}
            blank={(): ChartRow => ({ label: '', values: fit([], Math.max(1, series.length)) })}
            addLabel={round ? 'Add slice' : 'Add row'}
            renderRow={(item, update) => (
              <div className="grid gap-3" style={{ gridTemplateColumns: `minmax(0, 1.4fr) repeat(${count}, minmax(0, 1fr))` }}>
                <Field label="Label">
                  <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                {Array.from({ length: count }, (_, s) => (
                  <Field key={s} label={series[s]?.name || `Value ${s + 1}`}>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={item.values?.[s] ?? 0}
                      onChange={(e) => {
                        const values = fit(item.values, Math.max(count, item.values?.length ?? 0));
                        values[s] = Math.max(0, Number(e.target.value) || 0);
                        update({ values });
                      }}
                    />
                  </Field>
                ))}
              </div>
            )}
          />
          <Text label="Caption" k="caption" props={props} set={set} placeholder="Source: …" />
        </>
      );
    }

    case 'hotspots':
      return <HotspotsFields props={props} set={set} />;

    case 'flipBox':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Effect" k="effect" fallback="flip" options={[['flip', 'Turns over'], ['slide', 'Back slides in'], ['fade', 'Back fades in']]} props={props} set={set} />
            <PropSelect label="Direction" k="direction" fallback="horizontal" options={[['horizontal', 'Sideways'], ['vertical', 'Up and down']]} props={props} set={set} />
            <Field label="Per row">
              <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4">Four</option>
              </Select>
            </Field>
            <PropSelect label="Height" k="height" fallback="medium" options={[['small', 'Short'], ['medium', 'Medium'], ['large', 'Tall']]} props={props} set={set} />
            <PropSelect label="Text" k="align" fallback="center" options={[['center', 'Centred'], ['left', 'Bottom left']]} props={props} set={set} />
          </div>
          <Repeater
            label="Cards (up to 12)"
            items={arr<FlipCard>(props, 'cards')}
            onChange={(cards) => set({ ...props, cards: cards.slice(0, 12) })}
            blank={(): FlipCard => ({ title: '' })}
            addLabel="Add card"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Front — title">
                    <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <Field label="Front — text">
                    <Input value={item.text ?? ''} onChange={(e) => update({ text: e.target.value || undefined })} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MediaInput label="Front — picture" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                  <MediaInput label="Front — icon" value={item.iconUrl} onChange={(iconUrl) => update({ iconUrl })} />
                </div>
                <Field label="Back — title" hint="the front title when empty">
                  <Input value={item.backTitle ?? ''} onChange={(e) => update({ backTitle: e.target.value || undefined })} />
                </Field>
                <Field label="Back — text">
                  <Textarea rows={3} value={item.backText ?? ''} onChange={(e) => update({ backText: e.target.value || undefined })} />
                </Field>
                <ItemLink label="Back — button" value={item.link} onChange={(link) => update({ link })} />
              </>
            )}
          />
        </>
      );

    case 'priceList':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Layout" k="layout" fallback="list" options={[['list', 'One column'], ['columns', 'Two columns'], ['cards', 'Cards with photos']]} props={props} set={set} />
            <PropSelect label="Between name and price" k="leader" fallback="dots" options={[['dots', 'Dotted line'], ['line', 'Solid line'], ['none', 'Nothing']]} props={props} set={set} />
            <PropSelect label="Groups" k="groupNav" fallback="stacked" options={[['stacked', 'One under another'], ['tabs', 'Tabs — one at a time']]} props={props} set={set} />
          </div>
          <Repeater
            label="Groups (up to 8)"
            items={arr<PriceGroup>(props, 'groups')}
            onChange={(groups) => set({ ...props, groups: groups.slice(0, 8) })}
            blank={(): PriceGroup => ({ items: [{ name: '' }] })}
            addLabel="Add group"
            renderRow={(group, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Group title" hint="also the tab's name">
                    <Input value={group.title ?? ''} onChange={(e) => update({ title: e.target.value || undefined })} />
                  </Field>
                  <Field label="Note">
                    <Input value={group.note ?? ''} placeholder="Served until 11:30" onChange={(e) => update({ note: e.target.value || undefined })} />
                  </Field>
                </div>
                <Repeater
                  label="Items (up to 30)"
                  items={group.items ?? []}
                  onChange={(items) => update({ items: items.slice(0, 30) })}
                  blank={(): PriceItem => ({ name: '' })}
                  addLabel="Add item"
                  renderRow={(item, updateItem) => (
                    <>
                      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                        <Field label="Name">
                          <Input value={item.name ?? ''} onChange={(e) => updateItem({ name: e.target.value })} />
                        </Field>
                        <Field label="Price" hint="as written">
                          <Input value={item.price ?? ''} placeholder="€8" onChange={(e) => updateItem({ price: e.target.value || undefined })} />
                        </Field>
                        <Field label="Badge">
                          <Input value={item.badge ?? ''} placeholder="New" onChange={(e) => updateItem({ badge: e.target.value || undefined })} />
                        </Field>
                      </div>
                      <Field label="Description">
                        <Textarea rows={2} value={item.description ?? ''} onChange={(e) => updateItem({ description: e.target.value || undefined })} />
                      </Field>
                      <MediaInput label="Photo" value={item.imageUrl} onChange={(imageUrl) => updateItem({ imageUrl })} />
                      <StringListRepeater label="Tags (up to 4)" items={item.tags ?? []} onChange={(tags) => updateItem({ tags: tags.slice(0, 4) })} />
                    </>
                  )}
                />
              </>
            )}
          />
          <Text label="Footnote" k="footnote" props={props} set={set} placeholder="Prices include VAT." />
        </>
      );

    case 'businessHours':
      return <HoursFields props={props} set={set} />;

    case 'share': {
      const chosen = arr<string>(props, 'networks').length ? arr<string>(props, 'networks') : ['x', 'linkedin', 'facebook', 'whatsapp', 'email', 'copy'];
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Label above the buttons" k="title" props={props} set={set} placeholder="Share this page" />
          <Text label="Message" k="text" props={props} set={set} hint="goes with the link where the network allows; the page title when empty" />
          <Field label="Buttons">
            <div className="flex flex-wrap gap-4">
              {SHARE_NETWORKS.map((network) => (
                <label key={network} className="flex items-center gap-2 text-[14px] text-ash">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-flare"
                    checked={chosen.includes(network)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...chosen, network] : chosen.filter((n) => n !== network);
                      const ordered = SHARE_NETWORKS.filter((n) => next.includes(n));
                      if (ordered.length) set({ ...props, networks: ordered });
                    }}
                  />
                  {network === 'native' ? 'More (the phone’s own share sheet)' : SHARE_LABELS[network]}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <PropSelect label="Style" k="style" fallback="buttons" options={[['buttons', 'Buttons with names'], ['icons', 'Icons'], ['outlined', 'Outlined circles'], ['text', 'Names only']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={SIZE_OPTIONS} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} props={props} set={set} />
            <PropSelect label="Position" k="position" fallback="inline" options={[['inline', 'In the page'], ['floating', 'Floating at the side (wide screens)']]} props={props} set={set} />
          </div>
          <PropCheck label="Use each network’s brand colour" k="brandColors" props={props} set={set} />
        </>
      );
    }

    case 'lottie':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <LottieField props={props} set={set} />
          <Text label="What it shows" k="label" props={props} set={set} hint="read to screen-reader users; leave empty when it is only decoration" />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Plays" k="play" fallback="loop" options={LOTTIE_PLAY.map((p) => [p, LOTTIE_PLAY_LABELS[p]] as const)} props={props} set={set} />
            <OptNumber label="Speed" k="speed" step="0.25" hint="1 is normal, from 0.25 to 3" props={props} set={set} />
            <PropSelect
              label="Still frame"
              k="still"
              fallback="first"
              options={[['first', 'First frame'], ['last', 'Last frame']]}
              hint="shown before it plays, and to visitors who ask for less motion"
              props={props}
              set={set}
            />
            <PropSelect label="Colour" k="color" fallback="original" options={[['original', 'As drawn'], ['accent', 'Site accent'], ['text', 'Text colour']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['full', 'Full width']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="center" options={[['left', 'Left'], ['center', 'Centred'], ['right', 'Right']]} props={props} set={set} />
          </div>
          <Text label="Caption" k="caption" props={props} set={set} />
        </>
      );

    case 'form':
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <Text label="Form name" k="formName" props={props} set={set} hint="labels its answers in Form submissions" />
            <PropSelect label="Layout" k="layout" fallback="card" options={[['card', 'In a card'], ['plain', 'On the page']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centred']]} props={props} set={set} />
          </div>
          <Repeater
            label="Questions (up to 30) — add a “New step” to split the form into steps"
            items={arr<FormFieldRow>(props, 'fields')}
            onChange={(fields) => set({ ...props, fields: fields.slice(0, 30) })}
            blank={(): FormFieldRow => ({ id: nanoid(8), type: 'text', label: '', width: 'full' })}
            addLabel="Add question"
            renderRow={(item, update) => {
              const choices = ['select', 'radio', 'checkboxes'].includes(item.type);
              const step = item.type === 'step';
              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1.2fr_2fr]">
                    <Field label="Kind">
                      <Select value={item.type} onChange={(e) => update({ type: e.target.value })}>
                        {FORM_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FORM_FIELD_LABELS[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={step ? 'Step title' : item.type === 'consent' ? 'Text beside the tick box' : 'Question'}>
                      <Input value={item.label ?? ''} maxLength={160} onChange={(e) => update({ label: e.target.value })} />
                    </Field>
                  </div>
                  {!step && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="flex items-end gap-2 pb-3 text-[14px] text-ash">
                          <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.required === true} onChange={(e) => update({ required: e.target.checked })} />
                          Required
                        </label>
                        {item.type !== 'consent' && (
                          <Field label="Width">
                            <Select value={item.width ?? 'full'} onChange={(e) => update({ width: e.target.value })}>
                              <option value="full">Full width</option>
                              <option value="half">Half — two side by side</option>
                            </Select>
                          </Field>
                        )}
                        {!choices && item.type !== 'consent' && item.type !== 'date' && (
                          <Field label="Placeholder">
                            <Input value={item.placeholder ?? ''} maxLength={120} onChange={(e) => update({ placeholder: e.target.value || undefined })} />
                          </Field>
                        )}
                      </div>
                      {choices && (
                        <Field label="Options, one per line" hint="up to 20">
                          <Textarea
                            rows={4}
                            value={(item.options ?? []).join('\n')}
                            onChange={(e) => update({ options: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 20) })}
                          />
                        </Field>
                      )}
                      <Field label="Help text" hint="optional, shown under the question">
                        <Input value={item.help ?? ''} maxLength={200} onChange={(e) => update({ help: e.target.value || undefined })} />
                      </Field>
                    </>
                  )}
                </>
              );
            }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Text label="Button" k="submitLabel" props={props} set={set} placeholder="Send" />
            <Text label="Thank-you heading" k="successTitle" props={props} set={set} placeholder="Thank you — that is with us." />
            <Text label="Thank-you text" k="successText" props={props} set={set} />
          </div>
          <p className="m-0 text-[13px] text-smoke">Answers are listed under Enquiries → Form submissions. Nothing is emailed yet: the site has no mail service configured.</p>
        </>
      );

    case 'reviews': {
      const summary = props.summary as ReviewSummary | undefined;
      const setSummary = (patch: Partial<ReviewSummary> | null) =>
        set(withOpt(props, 'summary', patch === null ? undefined : { rating: 5, ...summary, ...patch }));
      return (
        <>
          {HEAD_FIELDS(props, set)}
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Layout" k="layout" fallback="grid" options={[['grid', 'Grid'], ['masonry', 'Masonry'], ['list', 'List']]} props={props} set={set} />
            <Field label="Per row">
              <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4">Four</option>
              </Select>
            </Field>
            <PropSelect label="Rating summary sits" k="summaryPosition" fallback="top" options={[['top', 'Beside the heading'], ['side', 'In a column beside the reviews']]} props={props} set={set} />
          </div>
          <label className="flex items-center gap-2 text-[14px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={Boolean(summary)} onChange={(e) => setSummary(e.target.checked ? {} : null)} />
            Show a rating summary (for example 4.8 from 1,932 reviews)
          </label>
          {summary && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Average rating (0–5)">
                  <Input type="number" min={0} max={5} step="0.1" value={summary.rating ?? 5} onChange={(e) => setSummary({ rating: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })} />
                </Field>
                <Field label="How many">
                  <Input value={summary.count ?? ''} placeholder="1,932 reviews" onChange={(e) => setSummary({ count: e.target.value || undefined })} />
                </Field>
                <Field label="Where from">
                  <Input value={summary.label ?? ''} placeholder="on Google" onChange={(e) => setSummary({ label: e.target.value || undefined })} />
                </Field>
              </div>
              <ItemLink label="Summary link" value={summary.link} onChange={(link) => setSummary({ link })} />
            </>
          )}
          <Repeater
            label="Reviews (up to 24)"
            items={arr<ReviewItem>(props, 'items')}
            onChange={(items) => set({ ...props, items: items.slice(0, 24) })}
            blank={(): ReviewItem => ({ name: '', rating: 5, text: '' })}
            addLabel="Add review"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_1.4fr_0.8fr]">
                  <Field label="Name">
                    <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Role, company or place">
                    <Input value={item.meta ?? ''} onChange={(e) => update({ meta: e.target.value || undefined })} />
                  </Field>
                  <Field label="Stars">
                    <Select value={item.rating === undefined ? '' : String(item.rating)} onChange={(e) => update({ rating: e.target.value === '' ? undefined : Number(e.target.value) })}>
                      <option value="">None</option>
                      {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Headline" hint="optional">
                  <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value || undefined })} />
                </Field>
                <Field label="Review">
                  <Textarea rows={3} value={item.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date">
                    <Input value={item.date ?? ''} placeholder="March 2026" onChange={(e) => update({ date: e.target.value || undefined })} />
                  </Field>
                  <Field label="Source">
                    <Input value={item.source ?? ''} placeholder="Google" onChange={(e) => update({ source: e.target.value || undefined })} />
                  </Field>
                </div>
                <MediaInput label="Photo" value={item.avatarUrl} onChange={(avatarUrl) => update({ avatarUrl })} hint="their initial is shown without one" />
              </>
            )}
          />
          <OptLink label="Button below the reviews" props={props} set={set} k="link" />
        </>
      );
    }

    case 'toc':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Title" k="title" props={props} set={set} placeholder="On this page" />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Style" k="style" fallback="boxed" options={[['boxed', 'Boxed'], ['list', 'Plain list'], ['numbered', 'Numbered']]} props={props} set={set} />
            <PropSelect label="Headings" k="levels" fallback="h2h3" options={[['h2h3', 'Sections and sub-sections'], ['h2', 'Sections only']]} props={props} set={set} />
            <PropSelect
              label="Lists the headings"
              k="scope"
              fallback="page"
              options={[['page', 'On the whole page'], ['row', 'In the same row']]}
              hint="“same row” for a contents list beside an article"
              props={props}
              set={set}
            />
          </div>
          <div className="flex flex-wrap gap-5">
            <PropCheckOn label="Mark the section being read" k="highlight" props={props} set={set} />
            <PropCheck label="Stick while scrolling" k="sticky" props={props} set={set} />
            <PropCheck label="Can be folded away (folded on phones)" k="collapsible" props={props} set={set} />
          </div>
          <p className="m-0 text-[13px] text-smoke">The list is built from the page’s headings when it loads, so it always matches them.</p>
        </>
      );

    case 'breadcrumbs': {
      const custom = str(props, 'source') === 'custom';
      return (
        <>
          <ToneField props={props} set={set} />
          <PropSelect
            label="Trail"
            k="source"
            fallback="page"
            options={[['page', 'The page’s own trail (what search engines are told)'], ['custom', 'A trail written here']]}
            props={props}
            set={set}
          />
          {custom && <LibLinksField props={props} set={set} label="Links before this page" k="items" max={6} />}
          <Text label="This page’s name" k="current" props={props} set={set} hint="empty = the page title" />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Style" k="style" fallback="plain" options={[['plain', 'Plain'], ['pill', 'Pills'], ['boxed', 'In a box']]} props={props} set={set} />
            <PropSelect label="Between the links" k="separator" fallback="chevron" options={[['chevron', '›  chevron'], ['slash', '/  slash'], ['dot', '·  dot'], ['arrow', '→  arrow']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre']]} props={props} set={set} />
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div className="pb-3">
              <PropCheckOn label="Start with Home" k="showHome" props={props} set={set} />
            </div>
            <Text label="Home label" k="homeLabel" props={props} set={set} placeholder="Home" />
          </div>
        </>
      );
    }

    case 'textPath':
      return (
        <>
          <ToneField props={props} set={set} />
          <Field label="Text" hint="around a circle, short text repeats to fill it">
            <Input value={str(props, 'text')} onChange={(e) => set({ ...props, text: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Shape" k="shape" fallback="circle" options={[['circle', 'Around a circle'], ['arc', 'Along an arc'], ['wave', 'Along a wave']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={SIZE_OPTIONS} props={props} set={set} />
            <PropSelect
              label="Turning"
              k="spin"
              fallback="slow"
              options={[['none', 'Still'], ['slow', 'Slowly'], ['fast', 'Faster']]}
              hint="circles only; still for visitors who ask for less motion"
              props={props}
              set={set}
            />
            <PropSelect label="Colour" k="color" fallback="text" options={[['text', 'Text colour'], ['accent', 'Accent']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="center" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} props={props} set={set} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="In the middle (circle)" k="centerText" props={props} set={set} placeholder="↓" />
            <PropMedia label="Picture in the middle (circle)" k="centerImageUrl" props={props} set={set} />
          </div>
          <PropHref label="Link (optional)" k="href" props={props} set={set} />
        </>
      );

    case 'search':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Placeholder" k="placeholder" props={props} set={set} placeholder="Search articles" />
            <Text label="Button" k="buttonLabel" props={props} set={set} placeholder="Search" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Style" k="style" fallback="bar" options={[['bar', 'Field with a button'], ['pill', 'Rounded'], ['underline', 'Underlined'], ['minimal', 'Field with an arrow']]} props={props} set={set} />
            <PropSelect label="Size" k="size" fallback="medium" options={SIZE_OPTIONS} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre']]} props={props} set={set} />
          </div>
          <Text label="Label before the suggestions" k="suggestionsLabel" props={props} set={set} placeholder="Popular:" />
          <StringListRepeater label="Suggested searches (up to 8)" items={arr<string>(props, 'suggestions')} onChange={(suggestions) => set({ ...props, suggestions: suggestions.slice(0, 8) })} />
          <p className="m-0 text-[13px] text-smoke">Searches the blog; results open on the blog page.</p>
        </>
      );

    case 'scrollStory':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <label className="flex items-center gap-2 text-[14px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.numbered !== false} onChange={(e) => set({ ...props, numbered: e.target.checked })} />
            Number the steps (01, 02, …)
          </label>
          <Repeater
            label="Steps (2–8)"
            items={arr<StoryItem>(props, 'items')}
            onChange={(items) => set({ ...props, items: items.slice(0, 8) })}
            blank={(): StoryItem => ({ title: '' })}
            addLabel="Add step"
            renderRow={(item, update) => (
              <>
                <Field label="Title">
                  <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label="Text">
                  <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} />
                </Field>
                <MediaInput label="Picture for this step" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                <Field label="Picture description">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
              </>
            )}
          />
        </>
      );

    case 'pinnedMedia':
      return (
        <>
          <ToneField props={props} set={set} />
          <PropMedia label="Video" k="videoUrl" accept="video" hint="moves forward and back with the scroll; muted" props={props} set={set} />
          <PropMedia label="Picture" k="imageUrl" hint="the video's first frame, or — without a video — a picture that slowly zooms" props={props} set={set} />
          <Text label="Description" k="alt" props={props} set={set} hint="for screen readers" />
          <PropSelect
            label="How long it holds still"
            k="length"
            fallback="medium"
            options={[['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']]}
            hint="visitors who ask for less motion see a still frame and no pinning"
            props={props}
            set={set}
          />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={2} />
        </>
      );

    case 'newsletter':
      return (
        <>
          <PropSelect
            label="Layout"
            k="layout"
            fallback="form"
            options={[['form', 'Email field with an inline button'], ['centered', 'Centred, heading over the field']]}
            hint="for a heading with a button to a sign-up page, use a call to action, inline layout"
            props={props}
            set={set}
          />
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Button label" k="buttonLabel" props={props} set={set} placeholder="Subscribe" />
            <Text label="Field placeholder" k="placeholder" props={props} set={set} placeholder="Your email address" />
          </div>
          <PropSelect
            label="Email field"
            k="fieldStyle"
            fallback="standard"
            options={[['standard', 'Rounded field, square button'], ['pill', 'Rounded field and button'], ['underline', 'Underlined']]}
            props={props}
            set={set}
          />
          <Field label="Consent text" hint="shown beside a checkbox the visitor must tick; leave empty for none">
            <Textarea rows={2} value={str(props, 'consentText')} onChange={(e) => set({ ...props, consentText: e.target.value })} />
          </Field>
          <Text label="Thank-you message" k="successText" props={props} set={set} placeholder="Thanks — you’re on the list." />
          <p className="m-0 text-[13px] text-smoke">
            Sign-ups are listed under Enquiries → Newsletter sign-ups. Nothing is emailed yet: the site has no mail service
            configured.
          </p>
        </>
      );

    case 'splitMedia':
      return (
        <>
          <ToneField props={props} set={set} />
          <PropMedia label="Image" k="imageUrl" props={props} set={set} />
          <PropMedia label="Video" k="videoUrl" accept="video" hint="optional; plays muted in a loop, with a pause button" props={props} set={set} />
          <Text label="Image description" k="alt" props={props} set={set} hint="for screen readers" />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect label="Image on the" k="mediaSide" fallback="left" options={[['left', 'Left'], ['right', 'Right']]} props={props} set={set} />
            <PropSelect
              label="Corners"
              k="shape"
              fallback="rounded"
              options={[['square', 'Square'], ['rounded', 'Rounded'], ['organic', 'One large rounded corner']]}
              props={props}
              set={set}
            />
            <PropSelect
              label="Image shape"
              k="ratio"
              fallback="portrait"
              options={[['portrait', 'Portrait'], ['square', 'Square'], ['landscape', 'Landscape']]}
              props={props}
              set={set}
            />
          </div>
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={4} />
          <LibLinksField props={props} set={set} />
        </>
      );

    case 'overlayCard':
      return (
        <>
          <PropMedia label="Image" k="imageUrl" props={props} set={set} />
          <Text label="Image description" k="alt" props={props} set={set} hint="for screen readers" />
          <PropSelect
            label="Card position"
            k="placement"
            fallback="overlapBottom"
            options={[
              ['overlapBottom', 'Overlapping the image’s bottom edge'],
              ['insideLeft', 'Inside the image, on the left'],
              ['insideRight', 'Inside the image, on the right'],
            ]}
            hint="on phones the card always sits under the image"
            props={props}
            set={set}
          />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={3} />
          <OptLink label="Button" props={props} set={set} k="link" />
        </>
      );

    case 'mediaBand':
      return (
        <>
          <PropMedia label="Image" k="imageUrl" props={props} set={set} />
          <PropMedia label="Video" k="videoUrl" accept="video" hint="optional; plays muted in a loop, with a pause button" props={props} set={set} />
          <Text label="Image description" k="alt" props={props} set={set} hint="for screen readers" />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Text position"
              k="position"
              fallback="bottomLeft"
              options={[['center', 'Centre'], ['bottomLeft', 'Bottom left'], ['topLeft', 'Top left'], ['left', 'Left, middle'], ['right', 'Right']]}
              hint="phones use bottom left"
              props={props}
              set={set}
            />
            <PropSelect
              label="Height"
              k="height"
              fallback="tall"
              options={[['short', 'Short'], ['medium', 'Medium'], ['tall', 'Tall'], ['screen', 'Full screen']]}
              props={props}
              set={set}
            />
            <PropSelect label="Darken the media" k="overlay" fallback="medium" options={[...OVERLAY_OPTIONS, ['gradient', 'Darker towards the bottom']]} props={props} set={set} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect
              label="Drift with the scroll"
              k="parallax"
              fallback="none"
              options={[['none', 'No — stays put'], ['vertical', 'Up and down'], ['horizontal', 'Sideways']]}
              hint="still for visitors who ask for less motion"
              props={props}
              set={set}
            />
            {(str(props, 'parallax') || 'none') !== 'none' && (
              <PropSelect label="Drift strength" k="strength" fallback="medium" options={[['subtle', 'Subtle'], ['medium', 'Medium'], ['strong', 'Strong']]} props={props} set={set} />
            )}
          </div>
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={2} />
          <LibLinksField props={props} set={set} />
        </>
      );

    case 'tabs':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <PropSelect
            label="Tab bar"
            k="barPosition"
            fallback="below"
            options={[['below', 'Below the panel'], ['above', 'Above the panel']]}
            hint="on phones the tabs become a dropdown above the panel"
            props={props}
            set={set}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect
              label="Tab style"
              k="style"
              fallback="pill"
              options={[['pill', 'Pills'], ['underline', 'Underlined'], ['text', 'Large text'], ['switch', 'Switch — two or three options, centred']]}
              props={props}
              set={set}
            />
            <PropSelect
              label="Direction"
              k="orientation"
              fallback="horizontal"
              options={[['horizontal', 'Across'], ['vertical', 'Down the side (ignores the bar position)']]}
              props={props}
              set={set}
            />
          </div>
          <Repeater
            label="Tabs"
            items={arr<TabRow>(props, 'tabs')}
            onChange={(tabs) => set({ ...props, tabs: tabs.slice(0, 8) })}
            blank={(): TabRow => ({ label: '' })}
            addLabel="Add tab"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tab label">
                    <Input value={item.label ?? ''} maxLength={40} onChange={(e) => update({ label: e.target.value })} />
                  </Field>
                  <Field label="Panel heading">
                    <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value || undefined })} />
                  </Field>
                </div>
                <Field label="Panel text">
                  <Textarea rows={3} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} />
                </Field>
                <MediaInput label="Image" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                <Field label="Image description" hint="for screen readers">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
                <MediaInput label="Tab icon (optional)" value={item.iconUrl} onChange={(iconUrl) => update({ iconUrl: iconUrl || undefined })} />
                <ItemLink value={item.link} onChange={(link) => update({ link })} />
              </>
            )}
          />
        </>
      );

    case 'logoWall':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Heading alignment" k="align" fallback="center" options={[['center', 'Centred'], ['left', 'Left']]} props={props} set={set} />
            <Field label="Logos per row" hint="tablets show up to four, phones two or three">
              <Select value={String(num(props, 'columns', 6))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Cells" k="style" fallback="tiles" options={[['tiles', 'Soft tiles'], ['grid', 'Lines between cells'], ['plain', 'No cells']]} props={props} set={set} />
            <div className="flex items-end pb-3">
              <PropCheck label="Name under each logo" k="captions" props={props} set={set} />
            </div>
          </div>
          <PropCheck label="Draw the logos inside a rounded card" k="framed" props={props} set={set} />
          <Repeater
            label="Logos"
            items={arr<LogoItem>(props, 'logos')}
            onChange={(logos) => set({ ...props, logos })}
            blank={(): LogoItem => ({ name: '' })}
            addLabel="Add logo"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" hint="the image's alt text, or shown when there is no image">
                    <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Link" hint="optional">
                    <Input value={item.href ?? ''} spellCheck={false} onChange={(e) => update({ href: e.target.value.trim() || undefined })} />
                  </Field>
                </div>
                <MediaInput label="Logo" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
              </>
            )}
          />
          <OptLink label="Link below the logos" props={props} set={set} k="link" />
        </>
      );

    case 'quote':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} hint="e.g. the company's name" />
          <Area label="Quote" k="quote" props={props} set={set} rows={4} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Name" k="name" props={props} set={set} />
            <Text label="Role" k="role" props={props} set={set} />
          </div>
          <PropMedia label="Photo of the person" k="avatarUrl" props={props} set={set} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Photo" k="avatarPosition" fallback="caption" options={[['caption', 'Beside the name'], ['above', 'Large, above the quote']]} props={props} set={set} />
            <PropSelect label="Photo size" k="avatarSize" fallback="medium" options={SIZE_OPTIONS} props={props} set={set} />
          </div>
          <PropMedia label="Picture beside the quote" k="imageUrl" props={props} set={set} hint="leave empty for a centred quote on its own" />
          <PropMedia label="Video" k="videoUrl" accept="video" hint="plays with sound and controls when someone presses play" props={props} set={set} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Picture description" k="alt" props={props} set={set} />
            <Text label="Play button label" k="mediaLabel" props={props} set={set} placeholder="Watch the video" />
          </div>
          <LibLinksField props={props} set={set} />
        </>
      );

    case 'configurator':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <Repeater
            label="Colours"
            items={arr<ColourItem>(props, 'options')}
            onChange={(options) => set({ ...props, options: options.slice(0, 12) })}
            blank={(): ColourItem => ({ name: '', color: '#888888' })}
            addLabel="Add colour"
            renderRow={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input value={item.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Swatch colour">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Pick the swatch colour"
                        className="h-10 w-12 shrink-0 cursor-pointer border-2 border-hairline bg-transparent"
                        value={/^#[0-9a-f]{6}$/i.test(item.color ?? '') ? item.color : '#888888'}
                        onChange={(e) => update({ color: e.target.value })}
                      />
                      <Input value={item.color ?? ''} spellCheck={false} onChange={(e) => update({ color: e.target.value.trim() })} />
                    </div>
                  </Field>
                </div>
                <MediaInput label="Picture in this colour" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                <Field label="Picture description" hint="defaults to the colour's name">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
              </>
            )}
          />
        </>
      );

    case 'collage':
      return (
        <>
          <ToneField props={props} set={set} />
          <PropMedia label="Large photo" k="largeUrl" props={props} set={set} />
          <Text label="Large photo description" k="largeAlt" props={props} set={set} />
          <PropMedia label="Small photo" k="smallUrl" props={props} set={set} hint="sits offset, overlapping the large one" />
          <Text label="Small photo description" k="smallAlt" props={props} set={set} />
          <PropSelect
            label="Layout"
            k="textSide"
            fallback="left"
            options={[['left', 'Text left, small photo right'], ['right', 'Text right, small photo left']]}
            props={props}
            set={set}
          />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={4} />
          <OptLink label="Button" props={props} set={set} k="link" />
        </>
      );

    case 'appPromo':
      return (
        <>
          <ToneField props={props} set={set} />
          <PropMedia label="App icon" k="iconUrl" props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Text" k="body" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropHref label="App Store link" k="appStoreHref" props={props} set={set} />
            <PropHref label="Google Play link" k="playStoreHref" props={props} set={set} />
          </div>
          <Repeater
            label="Phone screens (up to 3)"
            items={arr<ScreenItem>(props, 'screens')}
            onChange={(screens) => set({ ...props, screens: screens.slice(0, 3) })}
            blank={(): ScreenItem => ({ imageUrl: '' })}
            addLabel="Add screen"
            renderRow={(item, update) => (
              <>
                <MediaInput label="Screenshot" value={item.imageUrl || undefined} onChange={(imageUrl) => update({ imageUrl: imageUrl ?? '' })} />
                <Field label="Description">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
              </>
            )}
          />
        </>
      );

    case 'windowFrame': {
      const chrome = str(props, 'chrome') || 'browser';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect label="Window" k="chrome" fallback="browser" options={[['browser', 'Browser'], ['app', 'App window'], ['terminal', 'Terminal']]} props={props} set={set} />
            <Text label={chrome === 'browser' ? 'Address' : 'Window title'} k="address" props={props} set={set} />
          </div>
          {chrome === 'app' && (
            <StringListRepeater label="Sidebar entries (hidden on phones)" items={arr<string>(props, 'sidebar')} onChange={(sidebar) => set({ ...props, sidebar })} />
          )}
          <Repeater
            label="Views"
            items={arr<ViewItem>(props, 'tabs')}
            onChange={(tabs) => set({ ...props, tabs: tabs.slice(0, 6) })}
            blank={(): ViewItem => ({ label: '' })}
            addLabel="Add view"
            renderRow={(item, update) => (
              <>
                <Field label="Tab label" hint="tabs show when there is more than one view">
                  <Input value={item.label ?? ''} maxLength={40} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <MediaInput label="Screenshot" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                <Field label="Screenshot description">
                  <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                </Field>
                <Field label="Code" hint="shown instead of the screenshot; plain text">
                  <Textarea rows={6} className="font-mono text-[13px]" value={item.code ?? ''} onChange={(e) => update({ code: e.target.value || undefined })} />
                </Field>
              </>
            )}
          />
        </>
      );
    }

    case 'subNav':
      return (
        <>
          <Text label="Product or section name" k="name" props={props} set={set} />
          <LibLinksField props={props} set={set} label="Links" max={8} />
          <p className="m-0 text-[13px] text-smoke">
            Links starting with # jump to a section on this page and light up as it scrolls past. Give that
            section the same anchor in its Design tab.
          </p>
          <OptLink label="Button" props={props} set={set} k="cta" />
        </>
      );

    case 'stats': {
      const variant = str(props, 'variant') || 'tiles';
      return (
        <>
          <PropSelect
            label="Layout"
            k="variant"
            fallback="tiles"
            options={[['tiles', 'Tiles'], ['figures', 'Large figures, optionally under a picture'], ['counters', 'Counters that count up, with icons']]}
            props={props}
            set={set}
          />
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          {variant === 'counters' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <PropSelect label="Icons" k="iconPosition" fallback="top" options={[['top', 'Above the number'], ['left', 'Beside the number']]} props={props} set={set} />
              <label className="flex items-end gap-2 pb-3 text-[14px] text-ash">
                <input type="checkbox" className="h-4 w-4 accent-flare" checked={props.countUp !== false} onChange={(e) => set({ ...props, countUp: e.target.checked })} />
                Count up when scrolled into view
              </label>
            </div>
          )}
          {variant === 'figures' && (
            <>
              <PropMedia label="Picture above the figures" k="imageUrl" props={props} set={set} />
              <Text label="Picture description" k="alt" props={props} set={set} />
            </>
          )}
          <Repeater
            label="Figures"
            items={arr<StatItem>(props, 'items')}
            onChange={(items) => set({ ...props, items })}
            blank={(): StatItem => ({ value: '', label: '' })}
            addLabel="Add figure"
            renderRow={(item, update) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_0.6fr_2fr]">
                <Field label="Value">
                  <Input value={item.value ?? ''} placeholder="300+" onChange={(e) => update({ value: e.target.value })} />
                </Field>
                <Field label="Unit" hint="e.g. mm, %, h">
                  <Input value={item.unit ?? ''} maxLength={12} onChange={(e) => update({ unit: e.target.value || undefined })} />
                </Field>
                <Field label="Caption">
                  <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                {variant === 'counters' && (
                  <div className="sm:col-span-3">
                    <MediaInput label="Icon (optional)" value={item.iconUrl} onChange={(iconUrl) => update({ iconUrl: iconUrl || undefined })} />
                  </div>
                )}
              </div>
            )}
          />
          <Text label="Footnote" k="footnote" props={props} set={set} />
        </>
      );
    }

    case 'prose':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <PropSelect
            label="Style"
            k="variant"
            fallback="default"
            options={[['default', 'Normal text'], ['footnotes', 'Small print — footnotes and disclaimers']]}
            hint="for small print, a numbered list reads as footnotes"
            props={props}
            set={set}
          />
          <Field label="Columns">
            <Select value={str(props, 'columns') || 'one'} onChange={(e) => set({ ...props, columns: e.target.value })}>
              <option value="one">One column</option>
              <option value="two">Two columns</option>
            </Select>
          </Field>
          <StringListRepeater
            label="Paragraphs"
            hint="One box per paragraph. Enter starts a new line inside the same paragraph."
            multiline
            items={arr<string>(props, 'paragraphs')}
            onChange={(paragraphs) => set({ ...props, paragraphs })}
          />
          <Field label="Rich text" hint="overrides the paragraphs above when used">
            <RichTextEditor value={str(props, 'html')} onChange={(html) => set({ ...props, html })} height={280} />
          </Field>
        </>
      );

    case 'splitPoints':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={3} />
          <TitleBodyRepeater
            label="Points"
            items={arr<TitleBody>(props, 'points')}
            onChange={(points) => set({ ...props, points })}
          />
        </>
      );

    case 'cardGrid': {
      const variant = str(props, 'variant') || 'cards';
      return (
        <>
          <VariantCards
            label="Layout"
            value={variant as (typeof CARD_GRID_VARIANTS)[number]}
            options={CARD_GRID_VARIANTS}
            labels={CARD_GRID_LABELS}
            wires={CARD_GRID_WIREFRAMES}
            onChange={(v) => set({ ...props, variant: v })}
          />
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Columns" hint="tablets show two, phones one">
              <Select
                value={String(num(props, 'columns', 3))}
                onChange={(e) => set({ ...props, columns: Number(e.target.value) })}
              >
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4">Four</option>
              </Select>
            </Field>
            {/* The distance between cards, which a card's own margin cannot
                change — that shifts a card inside its cell instead. */}
            <LengthField
              label="Space between cards"
              value={str(props, 'gap') || undefined}
              emptyLabel="this layout's own"
              onChange={(gap: string | undefined) => set({ ...props, gap })}
            />
          </div>
          {variant === 'icons' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <PropSelect
                label="Icon"
                k="iconStyle"
                fallback="boxed"
                options={[['boxed', 'In a rounded box'], ['circle', 'In a circle'], ['outlined', 'Outlined box'], ['plain', 'On its own']]}
                props={props}
                set={set}
              />
              <PropSelect
                label="Icon position"
                k="iconPosition"
                fallback="top"
                options={[['top', 'Above the text'], ['left', 'Beside the text'], ['floating', 'Floating over a card']]}
                props={props}
                set={set}
              />
            </div>
          )}
          {['icons', 'imageCards', 'overlay', 'rows'].includes(variant) && (
            <div className="grid gap-3 sm:grid-cols-3">
              <PropSelect label="On hover" k="hover" fallback="none" options={[['none', 'Nothing'], ['lift', 'Lift'], ['zoom', variant === 'rows' ? 'Highlight the border' : 'Zoom the picture']]} props={props} set={set} />
              <div className="flex items-end pb-3">
                <PropCheck label="Shadow" k="shadow" props={props} set={set} />
              </div>
              {(variant === 'imageCards' || variant === 'overlay') && (
                <div className="flex items-end pb-3">
                  <PropCheck label="Every other column lower" k="offset" props={props} set={set} />
                </div>
              )}
            </div>
          )}
          <Repeater
            label="Cards"
            items={arr<GridCard>(props, 'cards')}
            onChange={(cards) => set({ ...props, cards })}
            blank={(): GridCard => ({ title: '', body: '' })}
            addLabel="Add card"
            renderRow={(item, update) => (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Eyebrow">
                    <Input value={item.eyebrow ?? ''} onChange={(e) => update({ eyebrow: e.target.value })} />
                  </Field>
                  <Field label="Link">
                    <Input value={item.href ?? ''} placeholder="/services/…" onChange={(e) => update({ href: e.target.value })} />
                  </Field>
                </div>
                <Field label="Badge" hint="a flag in the corner — “New”, “Coming soon”, “Sold out”">
                  <Input
                    value={item.badge ?? ''}
                    maxLength={24}
                    placeholder="none"
                    onChange={(e) => update({ badge: e.target.value || undefined })}
                  />
                </Field>
                <Field label="Title">
                  <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label="Body">
                  <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value })} />
                </Field>
                {variant === 'rows' && (
                  <StringListRepeater label="Checklist (up to 8)" items={item.points ?? []} onChange={(points) => update({ points: points.slice(0, 8) })} />
                )}
                <ItemStylePanel value={item.style} onChange={(style) => update({ style })} />
                {variant !== 'cards' && (
                  <>
                    <MediaInput label={variant === 'icons' || variant === 'rows' ? 'Icon' : 'Image'} value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {variant !== 'icons' && variant !== 'rows' && (
                        <Field label="Image description">
                          <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                        </Field>
                      )}
                      <Field label="Button label" hint="shown when the card has a link">
                        <Input value={item.buttonLabel ?? ''} maxLength={40} onChange={(e) => update({ buttonLabel: e.target.value || undefined })} />
                      </Field>
                    </div>
                  </>
                )}
              </>
            )}
          />
        </>
      );
    }

    case 'numberedList':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <PropSelect
            label="Layout"
            k="variant"
            fallback="grid"
            options={[['grid', 'Grid of numbered cards'], ['steps', 'Steps joined by a line'], ['timeline', 'Timeline, each under its label']]}
            props={props}
            set={set}
          />
          {str(props, 'variant') === 'timeline' ? (
            <Repeater
              label="Timeline items"
              items={arr<StepItem>(props, 'items')}
              onChange={(items) => set({ ...props, items })}
              blank={(): StepItem => ({ title: '', body: '' })}
              addLabel="Add item"
              renderRow={(item, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                    <Field label="Label" hint="a year or a date">
                      <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value || undefined })} />
                    </Field>
                    <Field label="Title">
                      <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Text">
                    <Textarea rows={2} value={item.body ?? ''} onChange={(e) => update({ body: e.target.value })} />
                  </Field>
                </>
              )}
            />
          ) : (
            <TitleBodyRepeater
              label="Numbered items"
              items={arr<TitleBody>(props, 'items')}
              onChange={(items) => set({ ...props, items })}
            />
          )}
        </>
      );

    case 'checkLists': {
      const custom = str(props, 'icon') === 'custom';
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <PropSelect
              label="Marker"
              k="icon"
              fallback="check"
              options={[['check', 'Tick'], ['arrow', 'Arrow'], ['dot', 'Dot'], ['star', 'Star'], ['plus', 'Plus'], ['number', 'Number'], ['custom', 'My own icon'], ['none', 'None']]}
              props={props}
              set={set}
            />
            <PropSelect label="Layout" k="layout" fallback="rows" options={[['rows', 'Rows with lines'], ['plain', 'Plain list'], ['inline', 'In a line'], ['grid', 'Grid']]} props={props} set={set} />
          </div>
          {custom && <PropMedia label="Icon" k="iconUrl" hint="a small square picture, shown before every entry" props={props} set={set} />}
          <Repeater
            label="Lists"
            items={arr<{ title?: string; items: ListEntry[] }>(props, 'lists')}
            onChange={(lists) => set({ ...props, lists })}
            blank={() => ({ title: '', items: [] })}
            addLabel="Add list"
            renderRow={(item, update) => (
              <>
                <Field label="List heading">
                  <Input value={item.title ?? ''} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <EntriesField items={item.items ?? []} onChange={(items) => update({ items })} />
              </>
            )}
          />
        </>
      );
    }

    case 'faq': {
      const variant = str(props, 'variant') || 'list';
      return (
        <>
          <PropSelect
            label="Layout"
            k="variant"
            fallback="list"
            options={[['list', 'Heading beside the questions'], ['media', 'Questions beside a picture that follows the open one']]}
            props={props}
            set={set}
          />
          {variant === 'list' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <PropSelect
                label="Style"
                k="style"
                fallback="lines"
                options={[['lines', 'Lines between questions'], ['filled', 'Filled boxes'], ['contained', 'All in one panel'], ['outlined', 'Outlined boxes']]}
                props={props}
                set={set}
              />
              <PropSelect label="Marker" k="icon" fallback="plus" options={[['plus', 'Plus'], ['chevron', 'Chevron'], ['arrow', 'Arrow']]} props={props} set={set} />
            </div>
          )}
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Repeater
            label="Questions"
            items={arr<FaqEntry>(props, 'items')}
            onChange={(items) => set({ ...props, items })}
            blank={(): FaqEntry => ({ question: '', answer: '' })}
            addLabel="Add question"
            renderRow={(item, update) => (
              <>
                <Field label="Question">
                  <Input value={item.question ?? ''} onChange={(e) => update({ question: e.target.value })} />
                </Field>
                <Field label="Answer">
                  <Textarea rows={3} value={item.answer ?? ''} onChange={(e) => update({ answer: e.target.value })} />
                </Field>
                {variant === 'media' && (
                  <>
                    <MediaInput label="Picture for this item" value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
                    <Field label="Picture description">
                      <Input value={item.alt ?? ''} onChange={(e) => update({ alt: e.target.value || undefined })} />
                    </Field>
                  </>
                )}
              </>
            )}
          />
        </>
      );
    }

    case 'cta':
      return (
        <>
          <PropSelect
            label="Layout"
            k="variant"
            fallback="band"
            options={[['band', 'Full-width coloured band'], ['big', 'Huge centred headline'], ['card', 'Compact card'], ['inline', 'Inline — text beside the buttons']]}
            props={props}
            set={set}
          />
          {(str(props, 'variant') || 'band') !== 'band' && <ToneField props={props} set={set} />}
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Body" k="body" props={props} set={set} rows={3} />
          <LinksRepeater items={arr<LinkItem>(props, 'links')} onChange={(links) => set({ ...props, links })} />
        </>
      );

    case 'pager':
      return (
        <>
          <Text label="Label" k="label" props={props} set={set} placeholder="Next service" />
          <Text label="Title" k="title" props={props} set={set} />
          <Text label="Link" k="href" props={props} set={set} placeholder="/services/…" />
        </>
      );

    case 'servicesIndex':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <Field label="Which services" hint="cards are generated from the site's service list">
            <Select value={str(props, 'tier') || 'all'} onChange={(e) => set({ ...props, tier: e.target.value })}>
              <option value="all">All services</option>
              <option value="primary">Core only</option>
              <option value="secondary">Specialist only</option>
            </Select>
          </Field>
        </>
      );

    case 'postList':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={2} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Kind">
              <Select value={str(props, 'kind') || 'all'} onChange={(e) => set({ ...props, kind: e.target.value })}>
                <option value="all">Everything</option>
                <option value="article">Articles</option>
                <option value="research">Research</option>
              </Select>
            </Field>
            <Text label="Category slug" k="categorySlug" props={props} set={set} placeholder="optional" />
            <Field label="How many">
              <Input
                type="number"
                min={1}
                max={48}
                value={num(props, 'limit', 9)}
                onChange={(e) => set({ ...props, limit: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PropSelect
              label="Layout"
              k="variant"
              fallback="cards"
              options={[
                ['cards', 'Text cards'],
                ['news', 'News cards with cover image and a “View all” button'],
                ['list', 'List — cover beside the text'],
                ['minimal', 'Minimal — titles and dates'],
                ['overlay', 'Text over the cover'],
                ['compact', 'Compact — small thumbnails'],
                ['wide', 'Wide — one post per row'],
                ['carousel', 'Carousel — cards you can swipe'],
                ['featured', 'Featured — one large post, the rest beside it'],
              ]}
              props={props}
              set={set}
            />
            <Field label="Per row" hint="card, news, text-over-cover and carousel layouts">
              <Select value={String(num(props, 'columns', 3))} onChange={(e) => set({ ...props, columns: Number(e.target.value) })}>
                <option value="2">Two</option>
                <option value="3">Three</option>
              </Select>
            </Field>
          </div>
          {!['cards', 'news', 'carousel', 'featured'].includes(str(props, 'variant') || 'cards') && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PropSelect
                label="Show"
                k="pagination"
                fallback="none"
                options={[['none', 'All at once'], ['more', 'A few, then a “Show more” button'], ['pages', 'A page at a time, with page numbers']]}
                props={props}
                set={set}
              />
              {(str(props, 'pagination') || 'none') !== 'none' && (
                <Field label="Per page" hint="“How many” above is the total">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={num(props, 'perPage', 6)}
                    onChange={(e) => set({ ...props, perPage: Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  />
                </Field>
              )}
            </div>
          )}
        </>
      );

    case 'contactForm':
      return (
        <>
          <Text label="Eyebrow" k="eyebrow" props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Area label="Intro" k="intro" props={props} set={set} rows={3} />
          <PropSelect
            label="Layout"
            k="layout"
            fallback="stacked"
            options={[['stacked', 'Heading above the form'], ['centered', 'Centred heading over a narrower form'], ['split', 'Text and a picture beside a form card']]}
            props={props}
            set={set}
          />
          {str(props, 'layout') === 'split' && (
            <>
              <Area label="Text beside the form" k="body" props={props} set={set} rows={3} />
              <PropMedia label="Picture beside the form" k="imageUrl" props={props} set={set} />
              <Text label="Picture description" k="alt" props={props} set={set} />
            </>
          )}
          <p className="m-0 text-[13px] text-smoke">
            The form fields themselves are fixed, so submissions stay consistent with the enquiries table.
          </p>
        </>
      );

    case 'infoPanel':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <Repeater
            label="Rows"
            items={arr<{ label: string; value: string }>(props, 'items')}
            onChange={(items) => set({ ...props, items })}
            blank={() => ({ label: '', value: '' })}
            addLabel="Add row"
            renderRow={(item, update) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Label">
                  <Input value={item.label ?? ''} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Value">
                  <Input value={item.value ?? ''} onChange={(e) => update({ value: e.target.value })} />
                </Field>
              </div>
            )}
          />
        </>
      );

    case 'image': {
      const lead = str(props, 'captionStyle') === 'lead';
      return (
        <>
          <ImageField props={props} set={set} />
          <Text label="Alt text" k="alt" props={props} set={set} hint="describe the image for screen readers" />
          <PropSelect
            label="Caption style"
            k="captionStyle"
            fallback="mono"
            options={[['mono', 'Small label'], ['lead', 'Sentence with a bold opening phrase']]}
            props={props}
            set={set}
          />
          {lead && <Text label="Bold opening phrase" k="captionLead" props={props} set={set} />}
          <Text label={lead ? 'Rest of the caption' : 'Caption'} k="caption" props={props} set={set} />
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Shape"
              k="mask"
              fallback="none"
              options={[['none', 'As it is'], ['circle', 'Circle'], ['arch', 'Arch'], ['blob', 'Blob'], ['leaf', 'Leaf'], ['hexagon', 'Hexagon'], ['diamond', 'Diamond']]}
              props={props}
              set={set}
            />
            <PropSelect label="Width" k="size" fallback="full" options={[['full', 'Full width'], ['large', 'Large'], ['medium', 'Medium'], ['small', 'Small']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="left" options={[['left', 'Left'], ['center', 'Centre']]} hint="for a narrower picture" props={props} set={set} />
          </div>
          {!lead && (str(props, 'mask') || 'none') === 'none' && <PropCheck label="Rounded corners" k="rounded" props={props} set={set} />}
        </>
      );
    }

    case 'figure':
      return (
        <>
          <Field label="Diagram">
            <Select value={str(props, 'kind') || 'converge'} onChange={(e) => set({ ...props, kind: e.target.value })}>
              <option value="converge">Converging — two sources meeting</option>
              <option value="layers">Layer stack — last one highlighted</option>
            </Select>
          </Field>
          <StringListRepeater
            label={
              str(props, 'kind') === 'layers'
                ? 'Labels — outermost first; the last is highlighted'
                : 'Labels — first source, second source, destination'
            }
            items={arr<string>(props, 'labels')}
            onChange={(labels) => set({ ...props, labels })}
          />
        </>
      );

    case 'spacer':
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Height" k="height" props={props} set={set} placeholder="48px" hint="a CSS length" />
            <Text
              label="Height on mobile"
              k="heightMobile"
              props={props}
              set={set}
              placeholder="same as above"
              hint="applies below 768px"
            />
          </div>
          <Field label="Rule" hint="a line drawn across the space">
            <Select value={str(props, 'line') || 'none'} onChange={(e) => set({ ...props, line: e.target.value })}>
              <option value="none">None — space only</option>
              <option value="hairline">Hairline</option>
              <option value="rule">Rule</option>
              <option value="accent">Accent</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <PropSelect
              label="Line"
              k="lineStyle"
              fallback="solid"
              options={[['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double'], ['wave', 'Wave'], ['zigzag', 'Zigzag']]}
              props={props}
              set={set}
            />
            <PropSelect label="Length" k="lineWidth" fallback="full" options={[['full', 'Full width'], ['wide', 'Most of the width'], ['short', 'Short']]} props={props} set={set} />
            <PropSelect label="Alignment" k="align" fallback="center" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} props={props} set={set} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Words in the middle" k="label" props={props} set={set} placeholder="Chapter two" />
            <PropSelect label="Ornament in the middle" k="ornament" fallback="none" options={[['none', 'None'], ['dot', 'Dot'], ['diamond', 'Diamond'], ['star', 'Star'], ['asterisk', 'Asterisk']]} props={props} set={set} />
          </div>
        </>
      );
    case 'row':
      return <RowFields props={props} set={set} depth={depth} />;
    case 'table':
      return (
        <>
          <ToneField props={props} set={set} />
          <Text label="Heading" k="title" props={props} set={set} />
          <StringListRepeater
            label="Column headings"
            items={arr<string>(props, 'head')}
            onChange={(head) => set({ ...props, head })}
          />
          <Repeater
            label="Rows"
            items={arr<string[]>(props, 'rows').map((cells) => ({ cells })) as { cells: string[] }[]}
            onChange={(rows) => set({ ...props, rows: rows.map((r) => r.cells) })}
            blank={() => ({ cells: arr<string>(props, 'head').map(() => '') })}
            addLabel="Add row"
            renderRow={(item, update) => (
              <StringListRepeater label="Cells" items={item.cells ?? []} onChange={(cells) => update({ cells })} />
            )}
          />
        </>
      );

    default:
      return <p className="m-0 text-[13px] text-smoke">This block has no editable settings.</p>;
  }
}
