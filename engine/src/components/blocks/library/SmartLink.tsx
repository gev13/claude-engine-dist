import Link from '@/components/ui/SiteLink';

/** Opens off-site links in a new tab, safely; site links stay client-side routed. */
export function SmartLink({
  href,
  className,
  children,
  label,
  style,
  tabIndex,
  hidden,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
  style?: React.CSSProperties;
  /** 3.24 — a second, drawn link to an address the card already links: out of the tab order and hidden from screen readers. */
  tabIndex?: number;
  hidden?: boolean;
}) {
  const extra = { ...(tabIndex !== undefined ? { tabIndex } : {}), ...(hidden ? { 'aria-hidden': true as const } : {}) };
  if (/^https?:/i.test(href)) {
    return (
      <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" aria-label={label} {...extra}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style} aria-label={label} {...extra}>
      {children}
    </Link>
  );
}
