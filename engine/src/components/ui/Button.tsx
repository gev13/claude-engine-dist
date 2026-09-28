import Link from '@/components/ui/SiteLink';
import { type ButtonPad, buttonPadProps } from '@/lib/buttonPad';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'onFlare';

/** Geometry, type and colour all come from the theme's custom properties. */
const base = 'he-btn';

const variants: Record<Variant, string> = {
  primary: 'he-btn-primary',
  outline: 'he-btn-outline',
  ghost: 'he-btn-ghost',
  // Contextual, not themed: this is the button that sits on a flare band, so
  // its colours are dictated by that background rather than by the palette.
  onFlare: 'bg-ink text-bone hover:bg-surface',
};

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Button({
  href,
  children,
  variant = 'primary',
  className,
  withArrow = false,
  type = 'button',
  pad,
  style,
  ...rest
}: {
  href?: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  withArrow?: boolean;
  type?: 'button' | 'submit';
  /** 3.14 — this button's own padding, over the theme's. */
  pad?: ButtonPad;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const padded = buttonPadProps(pad);
  const own = { className: padded.className, style: padded.style || style ? { ...(padded.style ?? {}), ...(style ?? {}) } : undefined };
  const classes = cn(base, variants[variant], className, own.className);
  const content = (
    <>
      {children}
      {withArrow && <ArrowRight />}
    </>
  );

  if (href) {
    const external = /^https?:\/\//i.test(href);
    if (external) {
      return (
        <a href={href} rel="noopener noreferrer" target="_blank" className={classes} style={own.style as React.CSSProperties | undefined}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} style={own.style as React.CSSProperties | undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} style={own.style as React.CSSProperties | undefined} {...rest}>
      {content}
    </button>
  );
}
