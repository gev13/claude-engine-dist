import { cn } from '@/lib/utils';

/** The red rule + uppercase mono label that opens most sections. */
export function Eyebrow({
  children,
  className,
  tone = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'onFlare';
}) {
  return (
    <div className={cn('mb-6 flex items-center gap-3.5 md:mb-7', className)}>
      <span
        className={cn(
          'h-0.5 w-10 shrink-0 origin-left animate-rule',
          tone === 'onFlare' ? 'bg-ink' : 'bg-flare',
        )}
      />
      <span
        className={cn(
          'type-eyebrow',
          tone === 'onFlare' && 'text-ink/70',
        )}
      >
        {children}
      </span>
    </div>
  );
}
