'use client';

import { DuplicateButton } from '@/components/admin/DuplicateButton';
import { POST_LAYOUTS, POST_LAYOUT_LABELS, POST_OPENER_BLOCKS, postTakesOpeners, type PostLayout } from '@/lib/blog';
import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeoPanel } from '@/components/admin/SeoPanel';
import { RevisionPanel } from '@/components/admin/RevisionPanel';
import { CustomCssPanel } from '@/components/admin/CustomCssPanel';
import { PageAppearanceFields, type PageAppearanceValue } from '@/components/admin/PageAppearanceFields';
import { PreviewButton } from '@/components/admin/PreviewButton';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { TranslationsPanel } from '@/components/admin/TranslationsPanel';
import { useToast } from '@/components/admin/useToast';
import type { RichTextPick } from '@/components/admin/RichTextEditor';
import { api } from '@/lib/admin/client';
import { toSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';
import type { AnyBlock } from '@/lib/blocks';
import type { Media, SeoFields } from '@/server/db/schema';
import {
  ConfirmDelete,
  SidebarSection,
  StatusBadge,
  ViewLink,
  type ContentStatus,
  errorMessage,
  useUnsavedWarning,
} from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Post editor — shared by /admin/posts/new and /admin/posts/[id].
   ───────────────────────────────────────────────────────────────────────────
   TinyMCE pulls in its own DOM-only bundle, so the rich text editor is loaded
   lazily and never rendered on the server.
   ═══════════════════════════════════════════════════════════════════════════ */

const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center border-2 border-hairline bg-ink font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
      Loading editor…
    </div>
  ),
});

export type CategoryOption = { id: string; name: string };
export type CoverInfo = { id: string; url: string; altText: string };

export type PostEditorRecord = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  blocks: AnyBlock[];
  kind: 'article' | 'research';
  status: ContentStatus;
  seo: SeoFields;
  coverMediaId: string | null;
  primaryCategoryId: string | null;
  categoryIds: string[];
  customCss: string;
  appearance?: PageAppearanceValue;
  /** ISO string, or null when the post has never been published. */
  publishedAt: string | null;
  /** What the public post shows (2.13). */
  layout?: PostLayout;
  /** Where it lives under this site's permalinks; null before the first save. */
  publicPath?: string | null;
};

type FormValue = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  blocks: AnyBlock[];
  layout: PostLayout;
  kind: 'article' | 'research';
  status: ContentStatus;
  seo: SeoFields;
  coverMediaId: string | null;
  primaryCategoryId: string;
  categoryIds: string[];
  customCss: string;
  appearance?: PageAppearanceValue;
  /** Value of the datetime-local input, in the browser's own timezone. */
  publishedAt: string;
};

/** `datetime-local` speaks local wall-clock time; the API speaks ISO/UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function fromLocalInput(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Stable, so the builder's memoised block list is not rebuilt on every keystroke. */
const NO_EXCLUSIONS: readonly string[] = [];

const blankValue: FormValue = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  blocks: [],
  layout: 'body',
  kind: 'article',
  status: 'draft',
  seo: {},
  coverMediaId: null,
  primaryCategoryId: '',
  categoryIds: [],
  customCss: '',
  appearance: {},
  publishedAt: '',
};

function toValue(record?: PostEditorRecord): FormValue {
  if (!record) return blankValue;
  return {
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt,
    body: record.body,
    blocks: record.blocks ?? [],
    layout: record.layout ?? 'body',
    kind: record.kind,
    status: record.status,
    seo: record.seo ?? {},
    coverMediaId: record.coverMediaId,
    primaryCategoryId: record.primaryCategoryId ?? '',
    categoryIds: record.categoryIds ?? [],
    customCss: record.customCss ?? '',
    appearance: record.appearance ?? {},
    publishedAt: toLocalInput(record.publishedAt),
  };
}

type PostApiRow = {
  id: string;
  layout?: PostLayout;
  publicPath?: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  blocks: AnyBlock[];
  kind: 'article' | 'research';
  status: ContentStatus;
  seo: SeoFields;
  coverMediaId: string | null;
  primaryCategoryId: string | null;
  customCss: string;
  appearance?: PageAppearanceValue;
  publishedAt: string | null;
};

export function PostEditor({
  record,
  categories,
  cover: initialCover,
}: {
  record?: PostEditorRecord;
  categories: CategoryOption[];
  cover?: CoverInfo | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [value, setValue] = useState<FormValue>(() => toValue(record));
  const [saved, setSaved] = useState<FormValue>(() => toValue(record));
  const [postId, setPostId] = useState<string | undefined>(record?.id);
  const [publicPath, setPublicPath] = useState<string | null>(record?.publicPath ?? null);
  const [cover, setCover] = useState<CoverInfo | null>(initialCover ?? null);
  const [tab, setTab] = useState<'rich' | 'blocks'>(() =>
    record && record.blocks.length > 0 && !record.body ? 'blocks' : 'rich',
  );
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  const [slugLocked, setSlugLocked] = useState(Boolean(record));

  /** 'cover' picks the hero image; 'rich' answers TinyMCE's file browser. */
  const [pickerFor, setPickerFor] = useState<'cover' | 'rich' | null>(null);
  const richPickCallback = useRef<((pick: RichTextPick) => void) | null>(null);

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedWarning(dirty);

  const set = <K extends keyof FormValue>(key: K, next: FormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function onTitleChange(title: string) {
    setValue((current) => ({ ...current, title, slug: slugLocked ? current.slug : toSlug(title, '') }));
  }

  function toggleCategory(id: string) {
    setValue((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(id)
        ? current.categoryIds.filter((existing) => existing !== id)
        : [...current.categoryIds, id],
    }));
  }

  function applyRow(row: PostApiRow, categoryIds: string[]) {
    const next = toValue({ ...row, categoryIds });
    setValue(next);
    setSaved(next);
    setPostId(row.id);
    setPublicPath(row.publicPath ?? null);
    setSlugLocked(true);
  }

  async function save(statusOverride?: ContentStatus) {
    if (!value.title.trim()) {
      setProblem('A post needs a title before it can be saved.');
      return;
    }
    setProblem('');
    setBusy(true);

    const status = statusOverride ?? value.status;
    const publishedIso = fromLocalInput(value.publishedAt);
    const categoryIds = value.primaryCategoryId
      ? Array.from(new Set([...value.categoryIds, value.primaryCategoryId]))
      : value.categoryIds;

    const payload = {
      title: value.title.trim(),
      slug: value.slug.trim() || undefined,
      excerpt: value.excerpt,
      body: value.body,
      blocks: value.blocks,
      layout: value.layout,
      kind: value.kind,
      status,
      seo: value.seo,
      coverMediaId: value.coverMediaId,
      primaryCategoryId: value.primaryCategoryId || null,
      categoryIds,
      customCss: value.customCss,
      appearance: value.appearance ?? {},
      // Left undefined when there is nothing to say, so publishing stamps
      // "now" server-side rather than being blanked by an empty field.
      publishedAt: publishedIso ?? (saved.publishedAt ? null : undefined),
    };

    try {
      if (postId) {
        const row = await api<PostApiRow>(`/api/admin/posts/${postId}`, { method: 'PATCH', json: payload });
        applyRow(row, categoryIds);
        toast(status === 'published' ? `Published "${row.title}".` : `Saved "${row.title}".`, 'success');
      } else {
        const row = await api<PostApiRow>('/api/admin/posts', { json: payload });
        applyRow(row, categoryIds);
        toast(status === 'published' ? `Published "${row.title}".` : `Created "${row.title}".`, 'success');
        router.replace(`/admin/posts/${row.id}`);
      }
    } catch (caught) {
      const message = errorMessage(caught, 'The post could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!postId) return;
    setDeleting(true);
    try {
      await api(`/api/admin/posts/${postId}`, { method: 'DELETE' });
      toast(`Deleted "${saved.title}".`, 'success');
      setSaved(value); // the unload guard must not fire on the way out
      router.push('/admin/posts');
    } catch (caught) {
      toast(errorMessage(caught, 'The post could not be deleted.'), 'error');
      setDeleting(false);
    }
  }

  function onMediaSelected(picked: Media) {
    if (pickerFor === 'cover') {
      setCover({ id: picked.id, url: picked.url, altText: picked.altText });
      set('coverMediaId', picked.id);
    } else if (pickerFor === 'rich') {
      richPickCallback.current?.({ url: picked.url, alt: picked.altText, title: picked.originalName });
      richPickCallback.current = null;
    }
    setPickerFor(null);
  }

  // The server knows the permalinks and the category; before the first save there is no address yet.
  const viewPath = publicPath ?? '';

  return (
    <>
      <PageHeader
        title={postId ? value.title || 'Untitled post' : 'New post'}
        description={postId ? viewPath : 'Write it, file it under a category, then publish.'}
        actions={
          <>
            <AdminLinkButton href="/admin/posts" variant="ghost">
              Back to posts
            </AdminLinkButton>
            {/* A published post can just be visited; a draft needs a link. */}
            {postId && value.status !== 'published' && (
              <PreviewButton entityType="post" entityId={postId} disabled={busy} />
            )}
            {postId && <DuplicateButton kind="posts" id={postId} dirty={dirty} />}
            <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
            {value.status !== 'published' && (
              <AdminButton type="button" disabled={busy} onClick={() => void save('published')}>
                Save &amp; publish
              </AdminButton>
            )}
          </>
        }
      />

      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Details">
            <div className="flex flex-col gap-5">
              <Field label="Title" htmlFor="post-title">
                <Input
                  id="post-title"
                  value={value.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Your post title"
                  autoFocus={!postId}
                />
              </Field>

              <Field
                label="Slug"
                htmlFor="post-slug"
                hint={viewPath ? `published at ${viewPath}` : 'the last part of the address — see Settings → Permalinks'}
              >
                <Input
                  id="post-slug"
                  value={value.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    set('slug', e.target.value);
                  }}
                  onBlur={(e) => set('slug', toSlug(e.target.value, ''))}
                  placeholder="your-post-title"
                />
              </Field>

              <Field label="Excerpt" htmlFor="post-excerpt" hint="shown in listings and search results">
                <Textarea
                  id="post-excerpt"
                  rows={3}
                  value={value.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="What the post shows">
            <Field
              label="Layout"
              htmlFor="post-layout"
              hint={POST_LAYOUT_LABELS[value.layout].hint}
            >
              <Select
                id="post-layout"
                value={value.layout}
                onChange={(e) => set('layout', e.target.value as PostLayout)}
              >
                {POST_LAYOUTS.map((option) => (
                  <option key={option} value={option}>
                    {POST_LAYOUT_LABELS[option].label}
                  </option>
                ))}
              </Select>
            </Field>
            {value.layout === 'body' && value.blocks.length > 0 && (
              <p className="m-0 mt-3 text-[13px] text-flare-soft">
                This post has blocks that are not shown — pick a layout with blocks to show them.
              </p>
            )}
            {value.layout === 'blocks' && value.body.trim() !== '' && (
              <p className="m-0 mt-3 text-[13px] text-flare-soft">
                The rich text is kept but not shown with this layout.
              </p>
            )}
          </Panel>

          <Panel
            title="Body"
            actions={
              <div className="flex border-2 border-hairline" role="tablist" aria-label="Body editor">
                {(['rich', 'blocks'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={tab === option}
                    onClick={() => setTab(option)}
                    className={cn(
                      'cursor-pointer px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                      tab === option ? 'bg-flare text-bone' : 'bg-transparent text-smoke hover:text-bone',
                    )}
                  >
                    {option === 'rich' ? 'Rich text' : 'Blocks'}
                  </button>
                ))}
              </div>
            }
          >
            {tab === 'rich' ? (
              <>
                <RichTextEditor
                  value={value.body}
                  onChange={(html) => set('body', html)}
                  onImagePick={(accept) => {
                    richPickCallback.current = accept;
                    setPickerFor('rich');
                  }}
                />
                {value.blocks.length > 0 && (
                  <p className="m-0 mt-3 text-[13px] text-ash">
                    This post also has {value.blocks.length} builder block{value.blocks.length === 1 ? '' : 's'}
                    {' '}— switch to Blocks to edit them.
                  </p>
                )}
              </>
            ) : (
              <BlockBuilder
                value={value.blocks}
                onChange={(next) => set('blocks', next)}
                exclude={postTakesOpeners(value.layout) ? NO_EXCLUSIONS : POST_OPENER_BLOCKS}
              />
            )}
          </Panel>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6">
          {/* Renders nothing on a single-language site. */}
          {postId && <TranslationsPanel pageId={postId} kind="post" />}

          <Panel title="Publishing">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Current</span>
                <StatusBadge status={saved.status} />
              </div>

              <Field label="Status" htmlFor="post-status">
                <Select
                  id="post-status"
                  value={value.status}
                  onChange={(e) => set('status', e.target.value as ContentStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>

              <Field label="Kind" htmlFor="post-kind">
                <Select
                  id="post-kind"
                  value={value.kind}
                  onChange={(e) => set('kind', e.target.value as 'article' | 'research')}
                >
                  <option value="article">Article</option>
                  <option value="research">Research</option>
                </Select>
              </Field>

              <Field label="Publish date" htmlFor="post-published" hint="leave blank to stamp on publish">
                <Input
                  id="post-published"
                  type="datetime-local"
                  value={value.publishedAt}
                  onChange={(e) => set('publishedAt', e.target.value)}
                />
              </Field>

              {/* A future date on a published post already keeps it off the
                  site — listPosts gates on `published_at <= now()`. What was
                  missing was any sign of that here, so scheduling looked
                  exactly like publishing. The page editor says the same thing
                  the same way.

                  `publishedAt` is held as the raw datetime-local string in this
                  editor (the page editor keeps ISO), and `new Date` reads such
                  a string as local time — which is what comparing against
                  Date.now() wants. */}
              {value.status === 'published' &&
                value.publishedAt &&
                new Date(value.publishedAt).getTime() > Date.now() && (
                  <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
                    Scheduled. The post stays off the site until{' '}
                    {new Date(value.publishedAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    , then appears within five minutes.
                  </p>
                )}

              <div className="flex flex-col gap-2">
                <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save'}
                </AdminButton>
                {value.status !== 'published' && (
                  <AdminButton type="button" disabled={busy} onClick={() => void save('published')}>
                    Save &amp; publish
                  </AdminButton>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t-2 border-hairline pt-4">
                {postId && saved.status === 'published' ? (
                  <ViewLink href={viewPath} label="View post" />
                ) : (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke/60"
                    title="Publish the post to see it on the site."
                  >
                    Not live yet
                  </span>
                )}
                {dirty && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-400">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Filing">
            <div className="flex flex-col gap-5">
              <Field label="Primary category" htmlFor="post-category">
                <Select
                  id="post-category"
                  value={value.primaryCategoryId}
                  onChange={(e) => set('primaryCategoryId', e.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                  Also filed under
                </span>
                {categories.length === 0 ? (
                  <p className="m-0 text-[13px] text-ash">No categories yet.</p>
                ) : (
                  <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto border-2 border-hairline bg-ink p-3">
                    {categories.map((category) => {
                      const isPrimary = category.id === value.primaryCategoryId;
                      return (
                        <label
                          key={category.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 text-[13px]',
                            isPrimary ? 'text-smoke' : 'text-ash',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-flare"
                            checked={isPrimary || value.categoryIds.includes(category.id)}
                            disabled={isPrimary}
                            onChange={() => toggleCategory(category.id)}
                          />
                          {category.name}
                          {isPrimary && <span className="font-mono text-[9px] uppercase tracking-[0.12em]">primary</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <Field label="Cover image">
                {cover ? (
                  <div className="flex items-center gap-3">
                    {/* A plain <img>: library assets have arbitrary dimensions and are already
                        served from the app's own /media route, so next/image adds nothing here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover.url}
                      alt={cover.altText || ''}
                      className="h-16 w-24 border-2 border-hairline object-cover"
                    />
                    <div className="flex flex-col gap-1">
                      <AdminButton type="button" variant="secondary" onClick={() => setPickerFor('cover')}>
                        Replace
                      </AdminButton>
                      <AdminButton
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setCover(null);
                          set('coverMediaId', null);
                        }}
                      >
                        Remove
                      </AdminButton>
                    </div>
                  </div>
                ) : (
                  <AdminButton type="button" variant="secondary" onClick={() => setPickerFor('cover')}>
                    Choose image
                  </AdminButton>
                )}
              </Field>
            </div>
          </Panel>

          {postId && (
            <SidebarSection title="Danger zone" className="border-2 border-hairline bg-surface px-5 py-4">
              <p className="m-0 mb-3 text-[13px] leading-relaxed text-ash">
                Deleting removes the post and its category links.
              </p>
              <ConfirmDelete onConfirm={remove} busy={deleting} label="Delete post" warning="This cannot be undone." />
            </SidebarSection>
          )}

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
                fallbackTitle={value.title || 'Untitled post'}
                fallbackDescription={value.excerpt}
                path={viewPath}
              />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-ash">
                {value.seo.title || value.seo.description
                  ? 'Custom search metadata is set for this post.'
                  : 'Search engines will use the title and excerpt above.'}
              </p>
            )}
          </Panel>

          <PageAppearanceFields value={value.appearance ?? {}} onChange={(next) => set('appearance', next)} what="post" />
          <CustomCssPanel value={value.customCss} onChange={(next) => set('customCss', next)} what="post" />

          {/* Only an existing post has history; a new one has nothing to show. */}
          {postId && (
            <RevisionPanel
              entityType="post"
              entityId={postId}
              onRestored={() => router.refresh()}
            />
          )}
        </aside>
      </div>

      <MediaPicker
        open={pickerFor !== null}
        onClose={() => {
          richPickCallback.current = null;
          setPickerFor(null);
        }}
        onSelect={onMediaSelected}
        accept="image"
      />
    </>
  );
}
