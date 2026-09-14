'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/* ── Buttons ──────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonBase =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-flare text-bone hover:bg-flare-hot hover:text-ink',
  secondary: 'border-2 border-hairline text-bone hover:border-rule hover:bg-surface',
  ghost: 'text-ash hover:text-bone',
  danger: 'border-2 border-flare text-flare-soft hover:bg-flare hover:text-bone',
};

export const AdminButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function AdminButton({ variant = 'primary', className, ...props }, ref) {
  return <button ref={ref} className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
});

export function AdminLinkButton({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

/* ── Form fields ──────────────────────────────────────────────────────────── */

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
      {children}
      {hint && <span className="ml-2 normal-case tracking-normal text-smoke/70">{hint}</span>}
    </label>
  );
}

const fieldBase =
  'w-full border-2 border-hairline bg-ink px-3 py-2.5 text-[14px] text-bone transition-colors placeholder:text-smoke/60 focus:border-flare focus:outline-none disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'resize-y leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error && <p className="mt-1.5 m-0 text-[12px] text-flare-soft">{error}</p>}
    </div>
  );
}

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-2 border-hairline bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b-2 border-hairline px-5 py-3.5">
          {title && <h2 className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'live' | 'draft' | 'archived' | 'alert';
}) {
  const tones = {
    neutral: 'border-hairline text-ash',
    live: 'border-emerald-500/50 text-emerald-400',
    draft: 'border-amber-500/50 text-amber-400',
    archived: 'border-hairline text-smoke',
    alert: 'border-flare text-flare-soft',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-hairline px-6 py-14 text-center">
      <p className="m-0 font-display text-[19px] font-extrabold tracking-[-0.02em] text-bone">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-[46ch] text-[14px] text-ash">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const tones = {
    error: 'border-flare text-flare-soft',
    success: 'border-emerald-500/60 text-emerald-400',
    info: 'border-hairline text-ash',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('border-l-2 py-2 pl-4 text-[14px]', tones[tone])}>
      {children}
    </div>
  );
}

/* ── Table ────────────────────────────────────────────────────────────────── */

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b-2 border-hairline px-3 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-smoke',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('border-b border-hairline px-3 py-3 align-middle text-ash', className)}>{children}</td>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
      <span className="h-3 w-3 animate-spin border-2 border-hairline border-t-flare" />
      {label}
    </span>
  );
}
