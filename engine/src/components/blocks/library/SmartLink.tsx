import Link from '@/components/ui/SiteLink';

/** Opens off-site links in a new tab, safely; site links stay client-side routed. */
export function SmartLink({ href, className, children, label, style }: { href: string; className?: string; children: React.ReactNode; label?: string; style?: React.CSSProperties }) {
  if (/^https?:/i.test(href)) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} aria-label={label}>
      {children}
    </Link>
  );
}
