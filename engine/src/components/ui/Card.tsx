import Link from '@/components/ui/SiteLink';
import { type CardHover, cardHoverProps } from '@/lib/cardHover';
import { cn } from '@/lib/utils';
import { ArrowRight } from './Button';

/**
 * The grid tile used for services, principles, stats and post cards. The
 * mockups build these grids with a 2px gap over the ink background, so the
 * gap itself reads as the rule between cells.
 */
export function CardGrid({
  children,
  cols = 3,
  gap = 'rule',
  gapSize,
  className,
  id,
}: {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  gap?: 'rule' | 'wide';
  /** An editor's own spacing, which replaces the named one when it is set. */
  gapSize?: string;
  className?: string;
  id?: string;
}) {
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols];

  return (
    /* Inline, because the named gaps are Tailwind utilities and a rule would
       have to out-specify them. Anything set here has already been through the
       schema's length grammar. */
    <div
      id={id}
      className={cn('grid grid-cols-1', colClass, gap === 'rule' ? 'gap-0.5' : 'gap-6', className)}
      style={gapSize ? { gap: gapSize } : undefined}
    >
      {children}
    </div>
  );
}

export function Card({
  href,
  eyebrow,
  title,
  children,
  meta,
  badge,
  className,
  interactive = true,
  hover,
}: {
  href?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  meta?: React.ReactNode;
  /** A short flag in the corner: "New", "Coming soon", "Sold out". */
  badge?: string;
  className?: string;
  interactive?: boolean;
  /** How the whole card answers the pointer (2.19); unset changes nothing. */
  hover?: CardHover;
}) {
  const moves = cardHoverProps(hover);
  const body = (
    <div
      className={cn(
        'group flex h-full flex-col bg-surface px-6 py-7 transition-colors duration-150',
        interactive && href && 'hover:bg-surface-2',
        badge && 'relative',
        !href && moves.className,
        className,
      )}
      style={href ? undefined : moves.style}
    >
      {/* Before the eyebrow in the DOM as well as on the screen: "Coming soon"
          changes how the rest of the card should be read, so it has to be
          heard first too. */}
      {badge && <span className="he-badge">{badge}</span>}
      {eyebrow && (
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{eyebrow}</div>
      )}
      {title && (
        <h3 className="m-0 font-display text-[19px] font-extrabold leading-[1.18] tracking-[-0.02em] text-bone">
          {title}
        </h3>
      )}
      {children && <div className="mt-3 text-[15px] text-ash">{children}</div>}
      {meta && <div className="mt-auto pt-5">{meta}</div>}
      {href && (
        <span className="mt-auto flex items-center gap-2 pt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft transition-colors group-hover:text-flare-hot">
          Read more
          <ArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className={cn('block h-full', moves.className)} style={moves.style}>
      {body}
    </Link>
  ) : (
    body
  );
}

/** Big numeral + caption, as in the Home "300+ / Zero / $120B+ / 90%" band. */
export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface px-6 py-7">
      <div className="display text-[clamp(34px,5vw,46px)] text-flare-hot">{value}</div>
      <div className="mt-2.5 text-[14px] text-ash">{label}</div>
    </div>
  );
}
