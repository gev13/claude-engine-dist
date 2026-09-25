'use client';

import { DuplicateButton } from '@/components/admin/DuplicateButton';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { CustomCssPanel } from '@/components/admin/CustomCssPanel';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { PageHeader } from '@/components/admin/PageHeader';
import { PreviewButton } from '@/components/admin/PreviewButton';
import { RevisionPanel } from '@/components/admin/RevisionPanel';
import type { RichTextPick } from '@/components/admin/RichTextEditor';
import { SeoPanel } from '@/components/admin/SeoPanel';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api } from '@/lib/admin/client';
import type { AnyBlock } from '@/lib/blocks';
import { toSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';
import type { Media, SeoFields } from '@/server/db/schema';
import { ConfirmDelete, SidebarSection, StatusBadge, ViewLink, type ContentStatus, errorMessage, useUnsavedWarning } from '../_shared';
import { ProjectsNav } from './ProjectsNav';

/* ═══════════════════════════════════════════════════════════════════════════
   Project editor (2.14)
   ───────────────────────────────────────────────────────────────────────────
   A project is a page made of blocks, with a card's worth of extra fields
   around it: the pictures lists use, the details the header shows, where it
   is filed. The layout of the page itself is the site's — Projects → Page
   template — so nothing here decides where the title goes.
   ═══════════════════════════════════════════════════════════════════════════ */

const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center border-2 border-hairline bg-ink font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
      Loading editor…
    </div>
  ),
});

export type TermOption = { id: string; name: string; taxonomy: 'category' | 'tag' };
export type MediaInfo = { id: string; url: string; altText: string; mimeType?: string };

export type ProjectRecord = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  excerpt: string;
  intro: string;
  client: string;
  year: string;
  url: string;
  blocks: AnyBlock[];
  seo: SeoFields;
  customCss: string;
  options: { hideMore?: boolean; background?: string; scheme?: 'inherit' | 'alt' };
  status: ContentStatus;
  publishedAt: string | null;
  sortOrder: number;
  featured: boolean;
  coverMediaId: string | null;
  hoverMediaId: string | null;
  heroMediaId: string | null;
  categoryIds: string[];
  primaryCategoryId: string | null;
  tagIds: string[];
  publicPath: string | null;
};

type FormValue = Omit<ProjectRecord, 'id' | 'publicPath' | 'publishedAt'> & { publishedAt: string };

const blank: FormValue = {
  title: '',
  slug: '',
  summary: '',
  excerpt: '',
  intro: '',
  client: '',
  year: '',
  url: '',
  blocks: [],
  seo: {},
  customCss: '',
  options: {},
  status: 'draft',
  publishedAt: '',
  sortOrder: 0,
  featured: false,
  coverMediaId: null,
  hoverMediaId: null,
  heroMediaId: null,
  categoryIds: [],
  primaryCategoryId: null,
  tagIds: [],
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const toValue = (record?: ProjectRecord): FormValue =>
  record ? { ...blank, ...record, publishedAt: toLocalInput(record.publishedAt) } : blank;

type Slot = 'cover' | 'hover' | 'hero';
const SLOT_FIELD: Record<Slot, 'coverMediaId' | 'hoverMediaId' | 'heroMediaId'> = {
  cover: 'coverMediaId',
  hover: 'hoverMediaId',
  hero: 'heroMediaId',
};

export function ProjectEditor({
  record,
  terms,
  media: initialMedia,
  canPublish,
}: {
  record?: ProjectRecord;
  terms: TermOption[];
  media: Partial<Record<Slot, MediaInfo>>;
  canPublish: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<FormValue>(() => toValue(record));
  const [saved, setSaved] = useState<FormValue>(() => toValue(record));
  const [projectId, setProjectId] = useState(record?.id);
  const [publicPath, setPublicPath] = useState(record?.publicPath ?? null);
  const [media, setMedia] = useState(initialMedia);
  const [picker, setPicker] = useState<Slot | 'rich' | null>(null);
  const richPick = useRef<((pick: RichTextPick) => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  const [slugLocked, setSlugLocked] = useState(Boolean(record));

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedWarning(dirty);

  const set = <K extends keyof FormValue>(key: K, next: FormValue[K]) => setValue((current) => ({ ...current, [key]: next }));
  const categories = terms.filter((term) => term.taxonomy === 'category');
  const tags = terms.filter((term) => term.taxonomy === 'tag');

  const toggle = (key: 'categoryIds' | 'tagIds', id: string) =>
    setValue((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((existing) => existing !== id) : [...current[key], id],
    }));

  async function save(statusOverride?: ContentStatus) {
    if (!value.title.trim()) {
      setProblem('A project needs a title before it can be saved.');
      return;
    }
    setProblem('');
    setBusy(true);
    const status = statusOverride ?? value.status;
    const publishedAt = value.publishedAt.trim() ? new Date(value.publishedAt).toISOString() : saved.publishedAt ? null : undefined;
    const categoryIds = value.primaryCategoryId
      ? [value.primaryCategoryId, ...value.categoryIds.filter((id) => id !== value.primaryCategoryId)]
      : value.categoryIds;
    const payload = {
      ...value,
      title: value.title.trim(),
      slug: value.slug.trim() || undefined,
      status,
      publishedAt,
      categoryIds,
      primaryCategoryId: value.primaryCategoryId ?? categoryIds[0] ?? null,
      options: {
        ...(value.options.hideMore ? { hideMore: true } : {}),
        ...(value.options.background ? { background: value.options.background } : {}),
        ...(value.options.scheme === 'alt' ? { scheme: 'alt' as const } : {}),
      },
    };
    try {
      const row = await api<ProjectRecord>(projectId ? `/api/admin/projects/${projectId}` : '/api/admin/projects', {
        method: projectId ? 'PATCH' : 'POST',
        json: payload,
      });
      const next = toValue(row);
      setValue(next);
      setSaved(next);
      setPublicPath(row.publicPath ?? null);
      setSlugLocked(true);
      toast(status === 'published' ? `Published "${row.title}".` : `Saved "${row.title}".`, 'success');
      if (!projectId) {
        setProjectId(row.id);
        router.replace(`/admin/projects/${row.id}`);
      }
    } catch (caught) {
      const message = errorMessage(caught, 'The project could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!projectId) return;
    setDeleting(true);
    try {
      await api(`/api/admin/projects/${projectId}`, { method: 'DELETE' });
      toast(`Moved "${saved.title}" to the trash.`, 'success');
      setSaved(value);
      router.push('/admin/projects');
    } catch (caught) {
      toast(errorMessage(caught, 'The project could not be deleted.'), 'error');
      setDeleting(false);
    }
  }

  function picked(item: Media) {
    if (picker === 'rich') {
      richPick.current?.({ url: item.url, alt: item.altText, title: item.originalName });
      richPick.current = null;
    } else if (picker) {
      setMedia((current) => ({ ...current, [picker]: { id: item.id, url: item.url, altText: item.altText, mimeType: item.mimeType } }));
      set(SLOT_FIELD[picker], item.id);
    }
    setPicker(null);
  }

  const mediaField = (slot: Slot, label: string, hint: string) => {
    const current = media[slot];
    return (
      <Field label={label} hint={hint}>
        {current ? (
          <div className="flex items-center gap-3">
            {current.mimeType?.startsWith('video/') ? (
              <video src={current.url} muted className="h-16 w-24 border-2 border-hairline object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={current.altText || ''} className="h-16 w-24 border-2 border-hairline object-cover" />
            )}
            <div className="flex flex-col gap-1">
              <AdminButton type="button" variant="secondary" onClick={() => setPicker(slot)}>
                Replace
              </AdminButton>
              <AdminButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setMedia((m) => ({ ...m, [slot]: undefined }));
                  set(SLOT_FIELD[slot], null);
                }}
              >
                Remove
              </AdminButton>
            </div>
          </div>
        ) : (
          <AdminButton type="button" variant="secondary" onClick={() => setPicker(slot)}>
            Choose {slot === 'hero' ? 'a picture or video' : 'a picture'}
          </AdminButton>
        )}
      </Field>
    );
  };

  const checkList = (items: TermOption[], key: 'categoryIds' | 'tagIds', empty: string) =>
    items.length === 0 ? (
      <p className="m-0 text-[13px] text-ash">{empty}</p>
    ) : (
      <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto border-2 border-hairline bg-ink p-3">
        {items.map((term) => {
          const isPrimary = key === 'categoryIds' && term.id === value.primaryCategoryId;
          return (
            <label key={term.id} className={cn('flex cursor-pointer items-center gap-2 text-[13px]', isPrimary ? 'text-smoke' : 'text-ash')}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-flare"
                checked={isPrimary || value[key].includes(term.id)}
                disabled={isPrimary}
                onChange={() => toggle(key, term.id)}
              />
              {term.name}
              {isPrimary && <span className="font-mono text-[9px] uppercase tracking-[0.12em]">primary</span>}
            </label>
          );
        })}
      </div>
    );

  const scheduled = value.status === 'published' && value.publishedAt && new Date(value.publishedAt).getTime() > Date.now();

  return (
    <>
      <PageHeader
        title={projectId ? value.title || 'Untitled project' : 'New project'}
        description={publicPath ?? 'Build it from blocks, file it, then publish.'}
        actions={
          <>
            <AdminLinkButton href="/admin/projects" variant="ghost">
              Back to projects
            </AdminLinkButton>
            {projectId && value.status !== 'published' && <PreviewButton entityType="project" entityId={projectId} disabled={busy} />}
            {projectId && <DuplicateButton kind="projects" id={projectId} dirty={dirty} />}
            <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
            {canPublish && value.status !== 'published' && (
              <AdminButton type="button" disabled={busy} onClick={() => void save('published')}>
                Save &amp; publish
              </AdminButton>
            )}
          </>
        }
      />
      <ProjectsNav />

      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Details">
            <div className="flex flex-col gap-5">
              <Field label="Title" htmlFor="project-title">
                <Input
                  id="project-title"
                  value={value.title}
                  autoFocus={!projectId}
                  onChange={(e) =>
                    setValue((current) => ({ ...current, title: e.target.value, slug: slugLocked ? current.slug : toSlug(e.target.value, '') }))
                  }
                />
              </Field>
              <Field label="Slug" htmlFor="project-slug" hint={publicPath ? `lives at ${publicPath}` : 'the last part of the address'}>
                <Input
                  id="project-slug"
                  value={value.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    set('slug', e.target.value);
                  }}
                  onBlur={(e) => set('slug', toSlug(e.target.value, ''))}
                />
              </Field>
              <Field label="Card line" htmlFor="project-summary" hint="one line, shown on project cards">
                <Input id="project-summary" value={value.summary} maxLength={300} onChange={(e) => set('summary', e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="project-excerpt" hint="for search results and link previews">
                <Textarea id="project-excerpt" rows={3} value={value.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Intro">
            <p className="m-0 mb-3 text-[13px] text-ash">Shown in the project&rsquo;s header, under the title.</p>
            <RichTextEditor
              value={value.intro}
              onChange={(html) => set('intro', html)}
              onImagePick={(accept) => {
                richPick.current = accept;
                setPicker('rich');
              }}
            />
          </Panel>

          <Panel title="The project">
            <p className="m-0 mb-4 text-[13px] text-ash">
              Full-width pictures, sliders, videos, text — whatever tells the story. The header above these and
              &ldquo;More projects&rdquo; below them come from Projects → Page template.
            </p>
            <BlockBuilder value={value.blocks} onChange={(next) => set('blocks', next)} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Publishing">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Current</span>
                <StatusBadge status={saved.status} />
              </div>
              <Field label="Status" htmlFor="project-status" hint={canPublish ? undefined : 'an editor publishes projects'}>
                <Select id="project-status" value={value.status} onChange={(e) => set('status', e.target.value as ContentStatus)}>
                  <option value="draft">Draft</option>
                  {(canPublish || saved.status === 'published') && <option value="published">Published</option>}
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field label="Publish date" htmlFor="project-published" hint="leave blank to stamp on publish">
                <Input id="project-published" type="datetime-local" value={value.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} />
              </Field>
              {scheduled && (
                <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
                  Scheduled — it stays off the site until then, and appears within five minutes of it.
                </p>
              )}
              <label className="flex items-center gap-2 text-[13px] text-ash">
                <input type="checkbox" className="h-4 w-4 accent-flare" checked={value.featured} onChange={(e) => set('featured', e.target.checked)} />
                Featured — shown where a list asks for featured work
              </label>
              <Field label="Order" htmlFor="project-order" hint="lower comes first, where a list uses this order">
                <Input
                  id="project-order"
                  type="number"
                  value={value.sortOrder}
                  onChange={(e) => set('sortOrder', Math.round(Number(e.target.value) || 0))}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 border-t-2 border-hairline pt-4">
                {projectId && saved.status === 'published' && publicPath ? (
                  <ViewLink href={publicPath} label="View project" />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke/60">Not live yet</span>
                )}
                {dirty && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-400">Unsaved changes</span>}
              </div>
            </div>
          </Panel>

          <Panel title="Filing">
            <div className="flex flex-col gap-5">
              <Field label="Primary category" htmlFor="project-primary" hint="“More projects” follows this one">
                <Select id="project-primary" value={value.primaryCategoryId ?? ''} onChange={(e) => set('primaryCategoryId', e.target.value || null)}>
                  <option value="">None</option>
                  {categories.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Categories</span>
                {checkList(categories, 'categoryIds', 'No categories yet — add them under Categories & tags.')}
              </div>
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Tags</span>
                {checkList(tags, 'tagIds', 'No tags yet.')}
              </div>
            </div>
          </Panel>

          <Panel title="Pictures">
            <div className="flex flex-col gap-5">
              {mediaField('cover', 'Cover', 'the picture on cards')}
              {mediaField('hover', 'Hover picture', 'a card swaps to this under the pointer')}
              {mediaField('hero', 'Header', 'full width at the top of the page; the cover when empty')}
            </div>
          </Panel>

          <Panel title="Credits">
            <div className="flex flex-col gap-5">
              <Field label="Client" htmlFor="project-client">
                <Input id="project-client" value={value.client} onChange={(e) => set('client', e.target.value)} />
              </Field>
              <Field label="Year" htmlFor="project-year">
                <Input id="project-year" value={value.year} maxLength={20} onChange={(e) => set('year', e.target.value)} />
              </Field>
              <Field label="Live link" htmlFor="project-url" hint="a full https:// address, optional">
                <Input id="project-url" value={value.url} placeholder="https://" onChange={(e) => set('url', e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="This project only">
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 text-[13px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={value.options.hideMore === true}
                  onChange={(e) => set('options', { ...value.options, hideMore: e.target.checked || undefined })}
                />
                Leave &ldquo;More projects&rdquo; off this page
              </label>
              <Field label="Page background" htmlFor="project-bg" hint="a colour such as #000000; empty keeps the site’s">
                <Input
                  id="project-bg"
                  value={value.options.background ?? ''}
                  placeholder="#000000"
                  onChange={(e) => set('options', { ...value.options, background: e.target.value || undefined })}
                />
              </Field>
              <Field label="Palette" htmlFor="project-scheme" hint="the alternate palette is set in Appearance → Colours">
                <Select
                  id="project-scheme"
                  value={value.options.scheme ?? 'inherit'}
                  onChange={(e) => set('options', { ...value.options, scheme: e.target.value === 'alt' ? 'alt' : undefined })}
                >
                  <option value="inherit">The site’s colours</option>
                  <option value="alt">The alternate palette</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel
            title="SEO"
            actions={
              <button
                type="button"
                onClick={() => setSeoOpen((open) => !open)}
                aria-expanded={seoOpen}
                className="cursor-pointer bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
              >
                {seoOpen ? 'Hide' : 'Edit'}
              </button>
            }
          >
            {seoOpen ? (
              <SeoPanel
                value={value.seo}
                onChange={(next) => set('seo', next)}
                fallbackTitle={value.title || 'Untitled project'}
                fallbackDescription={value.excerpt || value.summary}
                path={publicPath ?? ''}
              />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-ash">
                {value.seo.title || value.seo.description ? 'Custom search metadata is set.' : 'Search engines use the title and description.'}
              </p>
            )}
          </Panel>

          <CustomCssPanel value={value.customCss} onChange={(next) => set('customCss', next)} what="project" />

          {projectId && <RevisionPanel entityType="project" entityId={projectId} onRestored={() => router.refresh()} />}

          {projectId && (
            <SidebarSection title="Danger zone" className="border-2 border-hairline bg-surface px-5 py-4">
              <p className="m-0 mb-3 text-[13px] leading-relaxed text-ash">A deleted project goes to the trash first.</p>
              <ConfirmDelete onConfirm={remove} busy={deleting} label="Delete project" warning="It can be restored from the trash." />
            </SidebarSection>
          )}
        </aside>
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => {
          richPick.current = null;
          setPicker(null);
        }}
        onSelect={picked}
        accept={picker === 'hero' ? 'any' : 'image'}
      />
    </>
  );
}
