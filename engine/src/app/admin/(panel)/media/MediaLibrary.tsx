'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
  Alert,
  Badge,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  Textarea,
} from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { ApiError, api, fetcher } from '@/lib/admin/client';
import { cn } from '@/lib/utils';
import { ConfirmDelete, Pagination, errorMessage, useDebounced } from '../_shared';

/* Dates arrive over the wire as ISO strings, not Date objects — so this is the
   shape the screen actually receives, not the Drizzle row type. */
type MediaItem = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  url: string;
  altText: string;
  caption: string;
  createdAt: string;
};

type ListResponse = { items: MediaItem[]; total: number; page: number; perPage: number };
type UploadResponse = { items: MediaItem[]; failed: { name: string; error: string }[]; total: number };
type UploadReport = { uploaded: string[]; failed: { name: string; error: string }[] };

const PER_PAGE = 48;
const MAX_FILES = 100;

/** Mirrors the server's allow-list in `src/server/media/storage.ts`. */
const ACCEPTED_EXTENSIONS = ['jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'pdf', 'json'] as const;
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.json';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function kindOf(mimeType: string): 'image' | 'video' | 'document' | 'animation' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/json') return 'animation';
  return 'document';
}

export function MediaLibrary() {
  return (
    <ToastProvider>
      <MediaLibraryInner />
    </ToastProvider>
  );
}

function MediaLibraryInner() {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  // Drag events fire per element, so a depth counter is the only reliable way
  // to know when the pointer has actually left the drop zone.
  const dragDepth = useRef(0);

  // Debounce the search box so typing does not fire a request per keystroke.
  const query = useDebounced(search.trim());

  // A new query always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (type) params.set('type', type);

  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/media?${params.toString()}`, fetcher);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > MAX_FILES) {
        toast(`Upload at most ${MAX_FILES} files at a time — ${files.length} were dropped.`, 'error');
        return;
      }

      setUploading(true);
      setReport(null);

      const form = new FormData();
      for (const file of files) form.append('files', file);

      try {
        const result = await api<UploadResponse>('/api/admin/media', { json: form });
        setReport({ uploaded: result.items.map((item) => item.originalName), failed: result.failed });
        await mutate();

        if (result.failed.length === 0) {
          toast(`Uploaded ${result.items.length} file${result.items.length === 1 ? '' : 's'}.`, 'success');
        } else {
          toast(`Uploaded ${result.items.length}, rejected ${result.failed.length}. See the report below.`, 'error');
        }
      } catch (error) {
        // When every file is rejected the server answers 400 and carries the
        // per-file reasons in `details` — keep them rather than a bare message.
        const details = error instanceof ApiError ? error.details : null;
        const failed = Array.isArray(details)
          ? (details as { name: string; error: string }[])
          : files.map((file) => ({ name: file.name, error: 'Upload failed.' }));
        setReport({ uploaded: [], failed });
        toast(errorMessage(error, 'Upload failed.'), 'error');
      } finally {
        setUploading(false);
      }
    },
    [mutate, toast],
  );

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) void upload(files);
  }

  async function copyUrl(item: MediaItem) {
    const absolute = `${window.location.origin}${item.url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      toast('URL copied to the clipboard.', 'success');
    } catch {
      toast(`Copy failed. The URL is ${absolute}`, 'error');
    }
  }

  return (
    <div
      onDragEnter={(event) => {
        if (!Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (dragging) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative"
    >
      <PageHeader
        title="Media"
        description={`Drag files anywhere onto this page, or use the upload button. Accepted: ${ACCEPTED_EXTENSIONS.join(', ').toUpperCase()} (JSON for Lottie animations, up to 2 MB) — up to 100 MB per file and ${MAX_FILES} files at a time.`}
        actions={
          <AdminButton onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload files'}
          </AdminButton>
        }
      />

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept={ACCEPT_ATTR}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void upload(files);
          event.target.value = '';
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-ink/85">
          <p className="m-0 border-2 border-dashed border-flare px-10 py-8 font-mono text-[12px] uppercase tracking-[0.14em] text-flare-soft">
            Drop to upload
          </p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="media-search" className="w-[240px]">
          <Input
            id="media-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filename or alt text…"
          />
        </Field>
        <Field label="Type" htmlFor="media-type" className="w-[180px]">
          <Select
            id="media-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Video</option>
            <option value="document">Documents</option>
            <option value="animation">Lottie animations</option>
          </Select>
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} file{total === 1 ? '' : 's'}
        </p>
      </div>

      {report && (
        <div className="mb-5">
          <Panel
            title="Upload report"
            actions={
              <AdminButton variant="ghost" onClick={() => setReport(null)}>
                Dismiss
              </AdminButton>
            }
          >
            {report.uploaded.length > 0 && (
              <div className="mb-3">
                <Alert tone="success">
                  Uploaded {report.uploaded.length}: {report.uploaded.join(', ')}
                </Alert>
              </div>
            )}
            {report.failed.length > 0 && (
              <ul className="m-0 list-none space-y-2 p-0">
                {report.failed.map((failure, index) => (
                  <li key={`${failure.name}-${index}`}>
                    <Alert>
                      <span className="text-bone">{failure.name}</span> — {failure.error}
                    </Alert>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {isLoading && <Spinner label="Loading media" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title="Nothing in the library yet"
          body="Drag files onto this page or use the upload button. Images, video and PDFs are accepted."
          action={<AdminButton onClick={() => fileInput.current?.click()}>Upload files</AdminButton>}
        />
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => {
            const isImage = item.mimeType.startsWith('image/');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selectedId === item.id}
                className={cn(
                  'flex flex-col border-2 bg-ink text-left transition-colors hover:border-flare',
                  selectedId === item.id ? 'border-flare' : 'border-hairline',
                )}
              >
                <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.altText || item.originalName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-[13px] uppercase tracking-[0.16em] text-smoke">
                      {item.extension}
                    </span>
                  )}
                </span>
                <span className="truncate px-2.5 pt-2 text-[12px] text-bone">{item.originalName}</span>
                <span className="px-2.5 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke">
                  {humanSize(item.byteSize)}
                  {item.width ? ` · ${item.width}×${item.height}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />

      {selected && (
        <MediaDetail
          key={selected.id}
          item={selected}
          onClose={() => setSelectedId(null)}
          onCopyUrl={() => void copyUrl(selected)}
          onChanged={() => void mutate()}
          onDeleted={() => {
            setSelectedId(null);
            void mutate();
          }}
        />
      )}
    </div>
  );
}

function MediaDetail({
  item,
  onClose,
  onCopyUrl,
  onChanged,
  onDeleted,
}: {
  item: MediaItem;
  onClose: () => void;
  onCopyUrl: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [altText, setAltText] = useState(item.altText);
  const [caption, setCaption] = useState(item.caption);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/admin/media/${item.id}`, { method: 'PATCH', json: { altText, caption } });
      toast('File details saved.', 'success');
      onChanged();
    } catch (error) {
      toast(errorMessage(error, 'Could not save the file details.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api(`/api/admin/media/${item.id}`, { method: 'DELETE' });
      toast(`Deleted "${item.originalName}".`, 'success');
      onDeleted();
    } catch (error) {
      toast(errorMessage(error, 'Could not delete the file.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const isImage = item.mimeType.startsWith('image/');
  const isVideo = item.mimeType.startsWith('video/');

  return (
    <aside
      aria-label={`Details for ${item.originalName}`}
      className="fixed inset-y-0 right-0 z-[110] w-[min(420px,100vw)] overflow-y-auto border-l-2 border-hairline bg-surface"
    >
      <header className="flex items-center justify-between gap-4 border-b-2 border-hairline px-5 py-3.5">
        <h2 className="m-0 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
          {item.originalName}
        </h2>
        <AdminButton variant="ghost" onClick={onClose}>
          Close
        </AdminButton>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex items-center justify-center border-2 border-hairline bg-ink p-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.altText || item.originalName} className="max-h-[240px] w-auto" />
          ) : isVideo ? (
            <video src={item.url} controls className="max-h-[240px] w-full" />
          ) : (
            <span className="py-10 font-mono text-[15px] uppercase tracking-[0.16em] text-smoke">{item.extension}</span>
          )}
        </div>

        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
          <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Type</dt>
          <dd className="m-0 text-ash">
            <Badge>{kindOf(item.mimeType)}</Badge> <span className="ml-1">{item.mimeType}</span>
          </dd>
          <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Size</dt>
          <dd className="m-0 text-ash">{humanSize(item.byteSize)}</dd>
          <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Dimensions</dt>
          <dd className="m-0 text-ash">{item.width && item.height ? `${item.width} × ${item.height}` : '—'}</dd>
          <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Uploaded</dt>
          <dd className="m-0 text-ash">{humanDate(item.createdAt)}</dd>
          <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">URL</dt>
          <dd className="m-0 break-all text-ash">{item.url}</dd>
        </dl>

        <AdminButton variant="secondary" className="w-full" onClick={onCopyUrl}>
          Copy URL
        </AdminButton>

        <Field
          label="Alt text"
          hint="described for screen readers"
          htmlFor={`alt-${item.id}`}
        >
          <Input id={`alt-${item.id}`} value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={300} />
        </Field>

        <Field label="Caption" htmlFor={`caption-${item.id}`}>
          <Textarea
            id={`caption-${item.id}`}
            rows={3}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={2000}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <AdminButton onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </AdminButton>
          <ConfirmDelete onConfirm={remove} busy={saving} warning="The file is removed from disk too." />
        </div>
      </div>
    </aside>
  );
}
