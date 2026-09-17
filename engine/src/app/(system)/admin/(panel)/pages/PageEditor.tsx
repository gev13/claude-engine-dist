'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { SeoPanel } from '@/components/admin/SeoPanel';
import { PageTemplatePicker, type PickedTemplate } from '@/components/admin/TemplatePickers';
import { RevisionPanel } from '@/components/admin/RevisionPanel';
import { CustomCssPanel } from '@/components/admin/CustomCssPanel';
import { PreviewButton } from '@/components/admin/PreviewButton';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { TranslationsPanel } from '@/components/admin/TranslationsPanel';
import { useToast } from '@/components/admin/useToast';
import { api } from '@/lib/admin/client';
import { toPath, toSlug } from '@/lib/slug';
import type { AnyBlock } from '@/lib/blocks';
import type { SeoFields } from '@/server/db/schema';
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
   Page editor — shared by /admin/pages/new and /admin/pages/[id].
   ═══════════════════════════════════════════════════════════════════════════ */

/** `library` labels every block with its name and keeps the page out of search. */
const TEMPLATES = ['default', 'service', 'blog', 'contact', 'legal', 'library'] as const;

export type PageEditorRecord = {
  id: string;
  title: string;
  slug: string;
  path: string;
  navLabel: string | null;
  summary: string;
  excerpt: string;
  status: ContentStatus;
  template: string;
  priorityTier: string | null;
  sortOrder: number;
  blocks: AnyBlock[];
  seo: SeoFields;
  customCss: string;
  /** ISO, or null when the page has never been published. */
  publishedAt: string | null;
  isSystem: boolean;
};

type FormValue = {
  title: string;
  slug: string;
  path: string;
  navLabel: string;
  summary: string;
  excerpt: string;
  status: ContentStatus;
  template: string;
  priorityTier: string;
  sortOrder: number;
  blocks: AnyBlock[];
  seo: SeoFields;
  customCss: string;
  publishedAt: string;
};

const blankValue: FormValue = {
  title: '',
  slug: '',
  path: '',
  navLabel: '',
  summary: '',
  excerpt: '',
  status: 'draft',
  template: 'default',
  priorityTier: '',
  sortOrder: 0,
  blocks: [],
  seo: {},
  customCss: '',
  publishedAt: '',
};

/** `datetime-local` speaks local wall-clock time; the API speaks ISO. */
function toLocalInput(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function toValue(record?: PageEditorRecord): FormValue {
  if (!record) return blankValue;
  return {
    title: record.title,
    slug: record.slug,
    path: record.path,
    navLabel: record.navLabel ?? '',
    summary: record.summary ?? '',
    excerpt: record.excerpt,
    status: record.status,
    template: record.template,
    priorityTier: record.priorityTier ?? '',
    sortOrder: record.sortOrder,
    blocks: record.blocks ?? [],
    seo: record.seo ?? {},
    customCss: record.customCss ?? '',
    publishedAt: record.publishedAt ?? '',
  };
}

/** What the API sends back after a write. Dates arrive as strings over JSON. */
type PageApiRow = Omit<PageEditorRecord, 'blocks' | 'seo'> & { blocks: AnyBlock[]; seo: SeoFields };

export function PageEditor({ record }: { record?: PageEditorRecord }) {
  const router = useRouter();
  const { toast } = useToast();

  const [value, setValue] = useState<FormValue>(() => toValue(record));
  const [saved, setSaved] = useState<FormValue>(() => toValue(record));
  const [pageId, setPageId] = useState<string | undefined>(record?.id);
  const [isSystem, setIsSystem] = useState(record?.isSystem ?? false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  /** Once the author types a slug themselves, the title stops driving it. */
  const [slugLocked, setSlugLocked] = useState(Boolean(record));
  const [pathLocked, setPathLocked] = useState(Boolean(record));

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedWarning(dirty);

  const set = <K extends keyof FormValue>(key: K, next: FormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  /** Title drives slug and path until either is edited by hand. */
  function onTitleChange(title: string) {
    setValue((current) => {
      const slug = slugLocked ? current.slug : toSlug(title, '');
      return {
        ...current,
        title,
        slug,
        path: pathLocked ? current.path : slug ? toPath(slug) : '',
      };
    });
  }

  /** A page template fills the blocks, and the title and excerpt where they are still empty. */
  function applyTemplate(picked: PickedTemplate) {
    setValue((current) => {
      const title = current.title.trim() ? current.title : (picked.page?.title ?? '');
      const slug = slugLocked || current.slug ? current.slug : toSlug(title, '');
      return {
        ...current,
        title,
        slug,
        path: pathLocked || current.path ? current.path : slug ? toPath(slug) : '',
        excerpt: current.excerpt || (picked.page?.excerpt ?? ''),
        blocks: picked.blocks,
      };
    });
    toast('Template added. Replace the sample text and pictures with your own, then save.', 'success');
  }

  function applyRow(row: PageApiRow) {
    // The server normalises slug and path, so the form adopts what it stored
    // rather than what was typed — otherwise the editor drifts from reality.
    const next = toValue(row);
    setValue(next);
    setSaved(next);
    setPageId(row.id);
    setIsSystem(row.isSystem);
    setSlugLocked(true);
    setPathLocked(true);
  }

  async function save(statusOverride?: ContentStatus) {
    if (!value.title.trim()) {
      setProblem('A page needs a title before it can be saved.');
      return;
    }
    setProblem('');
    setBusy(true);

    const status = statusOverride ?? value.status;
    const payload = {
      title: value.title.trim(),
      slug: value.slug.trim() || undefined,
      path: value.path.trim() || undefined,
      navLabel: value.navLabel.trim() || null,
      summary: value.summary,
      excerpt: value.excerpt,
      status,
      template: value.template,
      priorityTier: value.priorityTier === '' ? null : value.priorityTier,
      sortOrder: Number.isFinite(value.sortOrder) ? value.sortOrder : 0,
      blocks: value.blocks,
      seo: value.seo,
      customCss: value.customCss,
      // Null clears the date; a future one keeps the page off the site until then.
      publishedAt: value.publishedAt || null,
    };

    try {
      if (pageId) {
        const row = await api<PageApiRow>(`/api/admin/pages/${pageId}`, { method: 'PATCH', json: payload });
        applyRow(row);
        toast(status === 'published' ? `Published "${row.title}".` : `Saved "${row.title}".`, 'success');
      } else {
        const row = await api<PageApiRow>('/api/admin/pages', { json: payload });
        applyRow(row);
        toast(status === 'published' ? `Published "${row.title}".` : `Created "${row.title}".`, 'success');
        // Swap the URL for the real edit route so a refresh lands in the right place.
        router.replace(`/admin/pages/${row.id}`);
      }
    } catch (caught) {
      const message = errorMessage(caught, 'The page could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pageId) return;
    setDeleting(true);
    try {
      await api(`/api/admin/pages/${pageId}`, { method: 'DELETE' });
      toast(`Deleted "${saved.title}".`, 'success');
      setSaved(value); // stop the unload guard firing on the way out
      router.push('/admin/pages');
    } catch (caught) {
      toast(errorMessage(caught, 'The page could not be deleted.'), 'error');
      setDeleting(false);
    }
  }

  const previewPath = value.path.trim() || '/';

  return (
    <>
      <PageHeader
        title={pageId ? value.title || 'Untitled page' : 'New page'}
        description={pageId ? previewPath : 'Give it a title, then build the page out of blocks.'}
        actions={
          <>
            <AdminLinkButton href="/admin/pages" variant="ghost">
              Back to pages
            </AdminLinkButton>
            {/* A published page can just be visited; a draft needs a link. */}
            {pageId && value.status !== 'published' && (
              <PreviewButton entityType="page" entityId={pageId} disabled={busy} />
            )}
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
              <Field label="Title" htmlFor="page-title">
                <Input
                  id="page-title"
                  value={value.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="API Security Testing"
                  autoFocus={!pageId}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Slug" htmlFor="page-slug" hint="URL segment">
                  <Input
                    id="page-slug"
                    value={value.slug}
                    onChange={(e) => {
                      setSlugLocked(true);
                      set('slug', e.target.value);
                    }}
                    onBlur={(e) => set('slug', toSlug(e.target.value, ''))}
                    placeholder="api-security-testing"
                  />
                </Field>
                <Field label="Path" htmlFor="page-path" hint="full public URL">
                  <Input
                    id="page-path"
                    value={value.path}
                    onChange={(e) => {
                      setPathLocked(true);
                      set('path', e.target.value);
                    }}
                    placeholder="/services/api-security-testing"
                  />
                </Field>
              </div>

              <Field label="Nav label" htmlFor="page-nav" hint="shorter title for menus and breadcrumbs">
                <Input
                  id="page-nav"
                  value={value.navLabel}
                  onChange={(e) => set('navLabel', e.target.value)}
                  placeholder={value.title}
                />
              </Field>

              <Field
                label="Summary"
                htmlFor="page-summary"
                hint="one line, for service cards and menus"
              >
                <Input
                  id="page-summary"
                  value={value.summary}
                  maxLength={300}
                  onChange={(e) => set('summary', e.target.value)}
                />
              </Field>

              <Field label="Excerpt" htmlFor="page-excerpt" hint="the longer meta description used in search results">
                <Textarea
                  id="page-excerpt"
                  rows={3}
                  value={value.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          {!pageId && value.blocks.length === 0 && (
            <Panel title="Start from a template">
              <PageTemplatePicker onPick={applyTemplate} />
            </Panel>
          )}

          <Panel title="Content blocks">
            <BlockBuilder value={value.blocks} onChange={(next) => set('blocks', next)} />
          </Panel>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          {/* Renders nothing on a single-language site. */}
          {pageId && <TranslationsPanel pageId={pageId} />}

          <Panel title="Publishing">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Current</span>
                <StatusBadge status={saved.status} />
              </div>

              <Field label="Status" htmlFor="page-status">
                <Select
                  id="page-status"
                  value={value.status}
                  onChange={(e) => set('status', e.target.value as ContentStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>

              <Field
                label="Publish at"
                htmlFor="page-published"
                hint="leave empty to go live the moment it is published"
              >
                <Input
                  id="page-published"
                  type="datetime-local"
                  value={toLocalInput(value.publishedAt)}
                  onChange={(e) => set('publishedAt', fromLocalInput(e.target.value))}
                />
              </Field>

              {value.status === 'published' && value.publishedAt && new Date(value.publishedAt).getTime() > Date.now() && (
                <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
                  Scheduled. The page stays off the site until{' '}
                  {new Date(value.publishedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })},
                  then appears within five minutes.
                </p>
              )}

              <Field label="Template" htmlFor="page-template">
                <Select id="page-template" value={value.template} onChange={(e) => set('template', e.target.value)}>
                  {TEMPLATES.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Priority tier" htmlFor="page-tier" hint="drives sitemap weight">
                <Select
                  id="page-tier"
                  value={value.priorityTier}
                  onChange={(e) => set('priorityTier', e.target.value)}
                >
                  <option value="">None</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </Select>
              </Field>

              <Field label="Sort order" htmlFor="page-sort" hint="lower sorts first">
                <Input
                  id="page-sort"
                  type="number"
                  value={value.sortOrder}
                  onChange={(e) => set('sortOrder', Number.parseInt(e.target.value, 10) || 0)}
                />
              </Field>

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
                {pageId && saved.status === 'published' ? (
                  <ViewLink href={saved.path} />
                ) : (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke/60"
                    title="Publish the page to see it on the site."
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

          {pageId && (
            <SidebarSection title="Danger zone" className="border-2 border-hairline bg-surface px-5 py-4">
              {isSystem ? (
                <p className="m-0 text-[13px] leading-relaxed text-ash">
                  This page is part of the site structure, so it cannot be deleted. Archive it instead if it should
                  drop out of the navigation.
                </p>
              ) : (
                <>
                  <p className="m-0 mb-3 text-[13px] leading-relaxed text-ash">
                    Deleting removes the page and its blocks. Child pages are detached, not deleted.
                  </p>
                  <ConfirmDelete
                    onConfirm={remove}
                    busy={deleting}
                    label="Delete page"
                    warning="This cannot be undone."
                  />
                </>
              )}
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
                fallbackTitle={value.title || 'Untitled page'}
                fallbackDescription={value.excerpt}
                path={previewPath}
              />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-ash">
                {value.seo.title || value.seo.description
                  ? 'Custom search metadata is set for this page.'
                  : 'Search engines will use the title and excerpt above.'}
              </p>
            )}
          </Panel>

          <CustomCssPanel value={value.customCss} onChange={(next) => set('customCss', next)} what="page" />

          {/* Only an existing page has history; a new one has nothing to show. */}
          {pageId && (
            <RevisionPanel
              entityType="page"
              entityId={pageId}
              onRestored={() => router.refresh()}
            />
          )}
        </aside>
      </div>
    </>
  );
}
