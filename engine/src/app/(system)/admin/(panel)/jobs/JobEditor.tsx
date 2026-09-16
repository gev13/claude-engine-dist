'use client';

import nextDynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeoPanel } from '@/components/admin/SeoPanel';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import type { RichTextPick } from '@/components/admin/RichTextEditor';
import { api } from '@/lib/admin/client';
import { toSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';
import { JOB_META, type JobMetaKey } from '@/lib/careers';
import { formatRelative, hasPassed } from '@/lib/relativeDate';
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
   Job editor — shared by /admin/jobs/new and /admin/jobs/[id].
   ───────────────────────────────────────────────────────────────────────────
   Three rich-text sections, and only one TinyMCE instance in the document at
   a time: three would triple the editor's weight for the sake of a screen
   somebody scrolls through one section at a time. The values are controlled
   state, so switching tabs unmounts an editor without losing a word.
   ═══════════════════════════════════════════════════════════════════════════ */

const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center border-2 border-hairline bg-ink font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
      Loading editor…
    </div>
  ),
});

export type CoverInfo = { id: string; url: string; altText: string };

const SECTIONS = [
  ['description', 'About the role'],
  ['responsibilities', 'Responsibilities'],
  ['benefits', 'What we offer'],
] as const;

type SectionKey = (typeof SECTIONS)[number][0];

export type JobEditorRecord = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  location: string;
  contractType: string;
  workingTime: string;
  seniority: string;
  workweek: string;
  department: string;
  description: string;
  responsibilities: string;
  benefits: string;
  coverMediaId: string | null;
  seo: SeoFields;
  postedAt: string | null;
  deadline: string | null;
  isOpen: boolean;
  status: ContentStatus;
  sortOrder: number;
  applicationCount: number;
};

type FormValue = Omit<JobEditorRecord, 'id' | 'locale' | 'applicationCount' | 'postedAt' | 'deadline'> & {
  /** Values of the `datetime-local` inputs, in the browser's own timezone. */
  postedAt: string;
  deadline: string;
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

const blankValue: FormValue = {
  slug: '',
  title: '',
  excerpt: '',
  location: '',
  contractType: '',
  workingTime: '',
  seniority: '',
  workweek: '',
  department: '',
  description: '',
  responsibilities: '',
  benefits: '',
  coverMediaId: null,
  seo: {},
  postedAt: '',
  deadline: '',
  isOpen: true,
  status: 'draft',
  sortOrder: 0,
};

function toValue(record?: JobEditorRecord): FormValue {
  if (!record) return blankValue;
  const { id: _id, locale: _locale, applicationCount: _count, postedAt, deadline, ...rest } = record;
  return { ...rest, seo: record.seo ?? {}, postedAt: toLocalInput(postedAt), deadline: toLocalInput(deadline) };
}

export function JobEditor({ record, cover: initialCover }: { record?: JobEditorRecord; cover?: CoverInfo | null }) {
  const router = useRouter();
  const { toast } = useToast();

  const [value, setValue] = useState<FormValue>(() => toValue(record));
  const [saved, setSaved] = useState<FormValue>(() => toValue(record));
  const [jobId, setJobId] = useState<string | undefined>(record?.id);
  const [cover, setCover] = useState<CoverInfo | null>(initialCover ?? null);
  const [section, setSection] = useState<SectionKey>('description');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  const [slugLocked, setSlugLocked] = useState(Boolean(record));

  const [pickerFor, setPickerFor] = useState<'cover' | 'rich' | null>(null);
  const richPickCallback = useRef<((pick: RichTextPick) => void) | null>(null);

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedWarning(dirty);

  const set = <K extends keyof FormValue>(key: K, next: FormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function onTitleChange(title: string) {
    setValue((current) => ({ ...current, title, slug: slugLocked ? current.slug : toSlug(title, '') }));
  }

  function applyRow(row: JobEditorRecord) {
    const next = toValue(row);
    setValue(next);
    setSaved(next);
    setJobId(row.id);
    setSlugLocked(true);
  }

  async function save(statusOverride?: ContentStatus) {
    if (!value.title.trim()) {
      setProblem('A role needs a title before it can be saved.');
      return;
    }
    setProblem('');
    setBusy(true);

    const status = statusOverride ?? value.status;
    const payload = {
      title: value.title.trim(),
      slug: value.slug.trim() || undefined,
      excerpt: value.excerpt,
      location: value.location,
      contractType: value.contractType,
      workingTime: value.workingTime,
      seniority: value.seniority,
      workweek: value.workweek,
      department: value.department,
      description: value.description,
      responsibilities: value.responsibilities,
      benefits: value.benefits,
      coverMediaId: value.coverMediaId,
      seo: value.seo,
      /* Left undefined when there is nothing to say, so publishing stamps
         "now" server-side rather than being blanked by an empty field. */
      postedAt: fromLocalInput(value.postedAt) ?? (saved.postedAt ? null : undefined),
      deadline: fromLocalInput(value.deadline) ?? (saved.deadline ? null : undefined),
      isOpen: value.isOpen,
      sortOrder: value.sortOrder,
      status,
    };

    try {
      if (jobId) {
        const row = await api<JobEditorRecord>(`/api/admin/jobs/${jobId}`, { method: 'PUT', json: payload });
        applyRow({ ...row, applicationCount: record?.applicationCount ?? 0 });
        toast(status === 'published' ? `Published "${row.title}".` : `Saved "${row.title}".`, 'success');
      } else {
        const row = await api<JobEditorRecord>('/api/admin/jobs', { json: payload });
        applyRow({ ...row, applicationCount: 0 });
        toast(status === 'published' ? `Published "${row.title}".` : `Created "${row.title}".`, 'success');
        router.replace(`/admin/jobs/${row.id}`);
      }
    } catch (caught) {
      const message = errorMessage(caught, 'The role could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!jobId) return;
    setDeleting(true);
    try {
      await api(`/api/admin/jobs/${jobId}`, { method: 'DELETE' });
      toast(`Deleted "${saved.title}".`, 'success');
      setSaved(value); // the unload guard must not fire on the way out
      router.push('/admin/jobs');
    } catch (caught) {
      toast(errorMessage(caught, 'The role could not be deleted.'), 'error');
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

  const publicPath = `/careers/${saved.slug || value.slug || ''}`;
  const deadlinePassed = value.deadline !== '' && hasPassed(new Date(value.deadline));
  const applications = record?.applicationCount ?? 0;

  return (
    <>
      <PageHeader
        title={jobId ? value.title || 'Untitled role' : 'New role'}
        description={jobId ? publicPath : 'Describe the role, set the meta grid, then publish it to the careers page.'}
        actions={
          <>
            <AdminLinkButton href="/admin/jobs" variant="ghost">
              Back to roles
            </AdminLinkButton>
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
              <Field label="Title" htmlFor="job-title">
                <Input
                  id="job-title"
                  value={value.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Senior Frontend Engineer"
                  autoFocus={!jobId}
                />
              </Field>

              <Field label="Slug" htmlFor="job-slug" hint="published at /careers/…">
                <Input
                  id="job-slug"
                  value={value.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    set('slug', e.target.value);
                  }}
                  onBlur={(e) => set('slug', toSlug(e.target.value, ''))}
                  placeholder="senior-frontend-engineer"
                />
              </Field>

              <Field label="Summary" htmlFor="job-excerpt" hint="the line on the careers card, and the meta description">
                <Textarea
                  id="job-excerpt"
                  rows={3}
                  value={value.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          {/* The six labels are fixed so every advert's grid reads the same;
              the answers are free text, because "Hybrid, 3 days on site" is a
              real answer and no enum would hold it. */}
          <Panel title="The meta grid" >
            <p className="m-0 mb-4 text-[13px] leading-relaxed text-ash">
              These sit at the top of the advert, in this order. Leave one blank and it is left out rather than
              printed empty.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {JOB_META.map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`job-${key}`}>
                  <Input
                    id={`job-${key}`}
                    value={value[key as JobMetaKey]}
                    onChange={(e) => set(key as JobMetaKey, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </Panel>

          <Panel
            title="The advert"
            actions={
              <div className="flex border-2 border-hairline" role="tablist" aria-label="Advert section">
                {SECTIONS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={section === key}
                    onClick={() => setSection(key)}
                    className={cn(
                      'cursor-pointer px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                      section === key ? 'bg-flare text-bone' : 'bg-transparent text-smoke hover:text-bone',
                      // A section with words in it is worth telling apart from
                      // an empty one at a glance.
                      section !== key && value[key] ? 'text-ash' : '',
                    )}
                  >
                    {label}
                    {value[key] ? ' •' : ''}
                  </button>
                ))}
              </div>
            }
          >
            <RichTextEditor
              // Remounting per section is deliberate: one editor in the
              // document, and the key makes it load the section's own words
              // rather than keeping the previous one's.
              key={section}
              value={value[section]}
              onChange={(html) => set(section, html)}
              onImagePick={(accept) => {
                richPickCallback.current = accept;
                setPickerFor('rich');
              }}
            />
          </Panel>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6">
          <Panel title="Publishing">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Current</span>
                <StatusBadge status={saved.status} />
              </div>

              <Field label="Status" htmlFor="job-status">
                <Select
                  id="job-status"
                  value={value.status}
                  onChange={(e) => set('status', e.target.value as ContentStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>

              {/* Open is not the same as published, and this is where people
                  expect to get it wrong, so the screen says which is which. */}
              <Field label="Applications" hint="separate from the status above">
                <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ash">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-flare"
                    checked={value.isOpen}
                    onChange={(e) => set('isOpen', e.target.checked)}
                  />
                  Taking applications
                </label>
                <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
                  {value.isOpen
                    ? 'The form is shown and the role sits above the closed ones.'
                    : 'The page stays up and says the role is closed — anybody holding the link still gets an answer.'}
                </p>
              </Field>

              <Field label="Posted" htmlFor="job-posted" hint="leave blank to stamp on publish">
                <Input
                  id="job-posted"
                  type="datetime-local"
                  value={value.postedAt}
                  onChange={(e) => set('postedAt', e.target.value)}
                />
              </Field>

              <Field label="Deadline" htmlFor="job-deadline" hint="shown as “12 days left”">
                <Input
                  id="job-deadline"
                  type="datetime-local"
                  value={value.deadline}
                  onChange={(e) => set('deadline', e.target.value)}
                />
              </Field>

              {/* A passed deadline does not close the role — that is the
                  client's decision, not the engine's — so it is said here
                  rather than acted on. */}
              {deadlinePassed && value.isOpen && (
                <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
                  The deadline passed {formatRelative(new Date(value.deadline), 'en')} and the role is still taking
                  applications. Untick the box above to close it.
                </p>
              )}

              <Field label="Order" htmlFor="job-order" hint="lower comes first on the careers page">
                <Input
                  id="job-order"
                  type="number"
                  value={String(value.sortOrder)}
                  onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
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
                {jobId && saved.status === 'published' ? (
                  <ViewLink href={publicPath} label="View role" />
                ) : (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke/60"
                    title="Publish the role to see it on the site."
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

          {jobId && (
            <Panel title="Applications">
              {applications === 0 ? (
                <p className="m-0 text-[13px] leading-relaxed text-ash">Nobody has applied yet.</p>
              ) : (
                <p className="m-0 text-[13px] leading-relaxed text-ash">
                  <Link href={`/admin/applications?job=${jobId}`} className="text-bone hover:text-flare-soft">
                    {applications} application{applications === 1 ? '' : 's'}
                  </Link>{' '}
                  — CVs and covering letters, kept out of the media library.
                </p>
              )}
            </Panel>
          )}

          <Panel title="Illustration">
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
          </Panel>

          {jobId && (
            <SidebarSection title="Danger zone" className="border-2 border-hairline bg-surface px-5 py-4">
              <p className="m-0 mb-3 text-[13px] leading-relaxed text-ash">
                {applications > 0
                  ? `Deleting moves the role to the trash. Erasing it from there also erases ${applications} application${applications === 1 ? '' : 's'}, and only an administrator can do that.`
                  : 'Deleting moves the role to the trash, where it can be restored.'}
              </p>
              <ConfirmDelete
                onConfirm={remove}
                busy={deleting}
                label="Delete role"
                warning="The advert goes to the trash."
              />
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
                fallbackTitle={value.title || 'Untitled role'}
                fallbackDescription={value.excerpt}
                path={publicPath}
              />
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-ash">
                {value.seo.title || value.seo.description
                  ? 'Custom search metadata is set for this role.'
                  : 'Search engines will use the title and summary above.'}
              </p>
            )}
          </Panel>
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
