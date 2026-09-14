'use client';

import { useCallback, useRef, useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Alert, Input, Spinner } from '@/components/admin/ui';
import { api, fetcher } from '@/lib/admin/client';
import { cn } from '@/lib/utils';
import type { Media } from '@/server/db/schema';

type ListResponse = { items: Media[]; total: number };

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  accept = 'image',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  /** Restrict the browse list. 'any' shows everything. */
  accept?: 'image' | 'video' | 'document' | 'animation' | 'any';
}) {
  const [query, setQuery] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams({ perPage: '60' });
  if (query) params.set('q', query);
  if (accept !== 'any') params.set('type', accept);

  const { data, isLoading, mutate } = useSWR<ListResponse>(
    open ? `/api/admin/media?${params.toString()}` : null,
    fetcher,
  );

  const upload = useCallback(
    async (files: FileList) => {
      setUploading(true);
      setUploadError('');
      const form = new FormData();
      for (const file of Array.from(files)) form.append('files', file);

      try {
        await api('/api/admin/media', { json: form });
        await mutate();
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [mutate],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
    >
      <div className="flex max-h-[86dvh] w-full max-w-[900px] flex-col border-2 border-hairline bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-hairline px-5 py-3.5">
          <h2 className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">Media library</h2>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-[180px] py-1.5"
              aria-label="Search media"
            />
            <AdminButton variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </AdminButton>
            <AdminButton variant="ghost" onClick={onClose}>
              Close
            </AdminButton>
          </div>
        </header>

        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="flex-1 overflow-y-auto p-5">
          {uploadError && (
            <div className="mb-4">
              <Alert>{uploadError}</Alert>
            </div>
          )}

          {isLoading && <Spinner label="Loading media" />}

          {!isLoading && (data?.items.length ?? 0) === 0 && (
            <p className="m-0 py-10 text-center text-[14px] text-smoke">
              Nothing here yet. Upload a file to get started.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data?.items.map((item) => {
              const isImage = item.mimeType.startsWith('image/');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className={cn(
                    'group flex flex-col border-2 border-hairline bg-ink text-left transition-colors hover:border-flare',
                  )}
                >
                  <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.altText || item.originalName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-smoke">
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
        </div>
      </div>
    </div>
  );
}
