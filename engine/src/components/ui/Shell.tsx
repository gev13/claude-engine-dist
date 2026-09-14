import { cn } from '@/lib/utils';

/** The 1200px content column used by every section in the mockups. */
export function Shell({
  children,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'header' | 'footer' | 'nav' | 'main';
}) {
  return <Tag className={cn('shell', className)}>{children}</Tag>;
}
