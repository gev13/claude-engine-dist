import { cn } from '@/lib/utils';

type Tone = 'base' | 'raised' | 'flare';
type Size = 'sm' | 'md' | 'lg';

const tones: Record<Tone, string> = {
  base: 'bg-ink',
  raised: 'bg-surface',
  flare: 'bg-flare text-ink',
};

const sizes: Record<Size, string> = {
  sm: 'py-10 md:py-14',
  md: 'py-12 md:py-16 lg:py-[56px]',
  lg: 'py-16 md:py-20 lg:py-[84px]',
};

/**
 * A full-bleed band with the hairline bottom rule the mockups use to separate
 * every section, plus the inner 1200px column.
 */
export function Section({
  children,
  tone = 'base',
  size = 'md',
  rule = true,
  className,
  innerClassName,
  id,
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: Size;
  rule?: boolean;
  className?: string;
  innerClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(tones[tone], rule && 'border-b-2 border-hairline', className)}
    >
      <div className={cn('shell', sizes[size], innerClassName)}>{children}</div>
    </section>
  );
}
