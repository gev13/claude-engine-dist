'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminButton, Badge } from '@/components/admin/ui';
import { ApiError } from '@/lib/admin/client';

/* ═══════════════════════════════════════════════════════════════════════════
   Pieces every content screen repeats. Kept here rather than in the shared UI
   kit because they encode admin-list behaviour (inline confirms, unsaved-work
   guards) rather than presentation.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ContentStatus = 'draft' | 'published' | 'archived';

export function StatusBadge({ status }: { status: ContentStatus }) {
  const tone = status === 'published' ? 'live' : status === 'draft' ? 'draft' : 'archived';
  return <Badge tone={tone}>{status}</Badge>;
}

/** Human message from anything thrown by the api() client. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Typing in a search box should not fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Browser-level guard for half-finished edits. Client-side navigation inside
 * the panel is not covered — beforeunload only fires on a real unload — but it
 * catches the reload / close / back-out-of-the-app cases that lose the most.
 */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need returnValue set to show their own dialog.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/**
 * Two-click delete. Browser dialogs block the whole page and cannot be styled,
 * so the button arms itself instead and disarms after a few seconds of no
 * second click.
 */
export function ConfirmDelete({
  onConfirm,
  label = 'Delete',
  confirmLabel = 'Confirm delete',
  warning,
  busy = false,
  locked = false,
  lockedReason,
  className,
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmLabel?: string;
  /** Shown next to the armed button when the consequence is not obvious. */
  warning?: string;
  busy?: boolean;
  locked?: boolean;
  lockedReason?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  if (locked) {
    return (
      <span
        title={lockedReason}
        className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.12em] text-smoke"
      >
        Locked
      </span>
    );
  }

  return (
    <span className={className}>
      <AdminButton
        type="button"
        variant={armed ? 'danger' : 'ghost'}
        disabled={busy}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          void onConfirm();
        }}
      >
        {busy ? 'Deleting…' : armed ? confirmLabel : label}
      </AdminButton>
      {armed && warning && (
        <span className="ml-2 align-middle text-[12px] text-flare-soft">{warning}</span>
      )}
    </span>
  );
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (next: number) => void;
}) {
  if (total === 0) return null;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
        {from}–{to} of {total}
      </p>
      {lastPage > 1 && (
        <div className="flex items-center gap-3">
          <AdminButton type="button" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </AdminButton>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
            {page} / {lastPage}
          </span>
          <AdminButton type="button" variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
            Next
          </AdminButton>
        </div>
      )}
    </div>
  );
}

/** A sidebar block in the two-column editors. */
export function SidebarSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{title}</h2>
      {children}
    </section>
  );
}

/** Opens the public URL in a new tab; the panel stays where it was. */
export function ViewLink({ href, label = 'View page' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke transition-colors hover:text-flare-soft"
    >
      {label} ↗
    </a>
  );
}
