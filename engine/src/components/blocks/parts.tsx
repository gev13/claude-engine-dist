import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import type { TextTag } from '@/lib/blockStyle';
import { cn } from '@/lib/utils';

/**
 * A section's title, rendered as whatever tag the editor chose.
 *
 * h1–h6 take the theme's heading scale. `p`, `span` and `div` deliberately take
 * none of it — "plain text" means the block's body styling, which is the whole
 * point of the choice. A section that wants large non-heading text sets a
 * typography override on the section instead.
 */
export function BlockTitle({
  as = 'h2',
  children,
  className,
}: {
  as?: TextTag;
  children: React.ReactNode;
  className?: string;
}) {
  if (as === 'p' || as === 'span' || as === 'div') {
    const Tag = as;
    return <Tag className={cn('m-0', className)}>{children}</Tag>;
  }
  const level = Number(as.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
  return (
    <Heading level={level} className={className}>
      {children}
    </Heading>
  );
}

/** Shared eyebrow + title + intro opener used by most block types. */
export function BlockHead({
  eyebrow,
  title,
  titleAs,
  intro,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title?: string;
  titleAs?: TextTag;
  intro?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  if (!eyebrow && !title && !intro) return null;
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-[62ch] text-center', className)}>
      {eyebrow && <Eyebrow className={align === 'center' ? 'justify-center' : undefined}>{eyebrow}</Eyebrow>}
      {title && (
        <BlockTitle as={titleAs} className="max-w-[24ch]">
          {title}
        </BlockTitle>
      )}
      {intro && <p className="mt-4 max-w-[62ch] text-[length:var(--he-block-lead,17px)] text-ash">{intro}</p>}
    </div>
  );
}

/** The 01 / 02 / 03 mono index used by numbered lists. */
export function Ordinal({ n }: { n: number }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-flare">
      {String(n).padStart(2, '0')}
    </span>
  );
}

/** The red tick used in coverage lists. */
export function Tick({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ec3013"
      strokeWidth="3"
      aria-hidden="true"
      className={cn('he-tick mt-[6px] shrink-0', className)}
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}
