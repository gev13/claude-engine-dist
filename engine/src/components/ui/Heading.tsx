import { cn } from '@/lib/utils';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Display type.
 *
 * The sizes are no longer written here: `.he-site h1…h6` in globals.css reads
 * them from the theme's custom properties, whose defaults are the mockup
 * values. A component that needs to break the scale still can, by passing a
 * Tailwind size class — a utility beats the base-layer rule.
 */
export function Heading({
  level = 2,
  children,
  className,
  id,
}: {
  level?: Level;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const Tag = (`h${level}` as const);
  return (
    <Tag id={id} className={cn('m-0', className)}>
      {children}
    </Tag>
  );
}

/** The oversized non-heading paragraph used for lede and pull-quote copy. */
export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('type-lede m-0', className)}>{children}</p>;
}
