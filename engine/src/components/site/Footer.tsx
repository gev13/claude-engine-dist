import Link from 'next/link';
import { SiteMark } from '@/components/ui/Logo';
import type { FooterVariant } from '@/lib/chrome';
import { type FooterColumn as Column, SOCIAL_LABELS, type SocialLink, linkAttrs } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { SocialIcon } from './icons';
import { FooterColumn, MotionToggle, ShareChip, ThemeToggle } from './SiteExtras';

/* ═══════════════════════════════════════════════════════════════════════════
   Footer
   ───────────────────────────────────────────────────────────────────────────
   FT1 sitemap columns · FT2 brand block · FT3 centred minimal · FT4 inset card.
   The same data feeds all four: the Menus footer columns, the Settings
   identity, and the social links — so switching variant loses nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FooterProps = {
  siteName: string;
  tagline?: string;
  email?: string;
  address?: string;
  columns: Column[];
  note?: string;
  social: SocialLink[];
  variant?: FooterVariant;
  shareChip?: boolean;
  motionToggle?: boolean;
  themeToggle?: boolean;
};

function Socials({ social }: { social: SocialLink[] }) {
  if (social.length === 0) return null;
  return (
    <ul className="he-ftr__social">
      {social.map((s) => (
        <li key={s.network + s.href}>
          <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[s.network]}>
            <SocialIcon network={s.network} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Mark({ siteName }: { siteName: string }) {
  return (
    <div className="he-ftr__brand">
      <span className="he-ftr__mark">
        <SiteMark />
      </span>
      <span className="he-ftr__name">{siteName}</span>
    </div>
  );
}

export function Footer(props: FooterProps) {
  const { siteName, tagline, email, address, columns, note, social } = props;
  const variant = props.variant ?? 'sitemap';
  const year = new Date().getFullYear();

  // `legal` columns belong in the bottom bar beside the copyright.
  const main = columns.filter((c) => c.placement !== 'legal');
  const legal = columns.filter((c) => c.placement === 'legal').flatMap((c) => c.items);
  const copyright = note ?? `© ${year} ${siteName}`;

  const toggles = (props.motionToggle || props.themeToggle) && (
    <div className="he-ftr__toggles">
      {props.themeToggle && <ThemeToggle />}
      {props.motionToggle && <MotionToggle />}
    </div>
  );

  const bottom = (
    <div className="he-ftr__bottom">
      <span>{copyright}</span>
      {legal.length > 0 && (
        <ul className="he-ftr__legal">
          {legal.map((item) => (
            <li key={item.id}>
              <Link href={item.href} {...linkAttrs(item)}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {toggles}
    </div>
  );

  const cols = main.map((column) => <FooterColumn key={column.id} title={column.title} items={column.items} />);

  if (variant === 'centered') {
    const links = main.flatMap((c) => c.items);
    return (
      <footer className="he-ftr he-ftr--centered">
        <div className="shell he-ftr__center">
          <Mark siteName={siteName} />
          {tagline && <p className="he-ftr__tagline">{tagline}</p>}
          {links.length > 0 && (
            <ul className="he-ftr__row">
              {links.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} {...linkAttrs(item)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Socials social={social} />
          {toggles}
          <div className="he-ftr__fine">
            <span>{copyright}</span>
            {legal.length > 0 && (
              <ul className="he-ftr__legal">
                {legal.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} {...linkAttrs(item)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </footer>
    );
  }

  if (variant === 'inset') {
    return (
      <footer className="he-ftr he-ftr--inset">
        <div className="he-ftr__card">
          {props.shareChip && (
            <div className="he-ftr__chip">
              <ShareChip />
            </div>
          )}
          <div className="he-ftr__cardgrid" style={{ '--he-footer-cols': main.length || 1 } as React.CSSProperties}>
            <div className="he-ftr__cardbrand">
              {tagline && <p className="he-ftr__tagline">{tagline}</p>}
              {email && (
                <a href={`mailto:${email}`} className="he-ftr__email">
                  {email}
                </a>
              )}
              <Socials social={social} />
              <Mark siteName={siteName} />
            </div>
            <div className="he-ftr__cols">{cols}</div>
          </div>
          {bottom}
        </div>
      </footer>
    );
  }

  const brandBlock = variant === 'brand';

  return (
    <footer className={cn('he-ftr', `he-ftr--${variant}`)}>
      <div className="shell">
        <div className="he-ftr__grid" style={{ '--he-footer-cols': main.length || 1 } as React.CSSProperties}>
          <div className="he-ftr__lead">
            <Mark siteName={siteName} />
            {tagline && <p className="he-ftr__tagline">{tagline}</p>}
            {brandBlock && address && <address className="he-ftr__address">{address}</address>}
            {email && (
              <a href={`mailto:${email}`} className="he-ftr__email">
                {email}
              </a>
            )}
            {brandBlock && <Socials social={social} />}
          </div>
          {cols}
        </div>
        {!brandBlock && social.length > 0 && (
          <div className="he-ftr__socialrow">
            <Socials social={social} />
          </div>
        )}
        {bottom}
      </div>
    </footer>
  );
}
