import Link from 'next/link';

/** Opens off-site links in a new tab, safely; site links stay client-side routed. */
export function SmartLink({ href, className, children, label }: { href: string; className?: string; children: React.ReactNode; label?: string }) {
  if (/^https?:/i.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
