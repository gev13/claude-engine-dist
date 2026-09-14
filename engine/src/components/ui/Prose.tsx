import { cn } from '@/lib/utils';

/**
 * Renders sanitised editor HTML. The sanitisation happens on write
 * (server/content/sanitize.ts) so nothing unsafe is ever stored; this is the
 * render side and assumes clean input.
 */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-edge', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
