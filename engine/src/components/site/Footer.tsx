import Link from '@/components/ui/SiteLink';
import { SiteMark } from '@/components/ui/Logo';
import { SiteImg } from '@/components/ui/SiteImg';
import type { FooterVariant } from '@/lib/chrome';
import { type FooterColumn as Column, SOCIAL_LABELS, type SocialLabelStyle, type SocialLink, linkAttrs, opensElsewhere, socialText } from '@/lib/navigation';
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

/** 3.1 — what heads the footer. */
export type FooterLogo = { kind: 'mark' } | { kind: 'image'; url: string; height?: number } | { kind: 'none' };

export type FooterProps = {
  siteName: string;
  tagline?: string;
  email?: string;
  address?: string;
  columns: Column[];
  note?: string;
  social: SocialLink[];
  /** 2.18 — icons, names or short labels, as set in Menus. */
  socialStyle?: SocialLabelStyle;
  variant?: FooterVariant;
  shareChip?: boolean;
  motionToggle?: boolean;
  themeToggle?: boolean;
  /** 3.1 — unset is the mark and the site name, as before. */
  logo?: FooterLogo;
  /** 3.1 — drawn as a panel (Appearance → Shape → Panels). */
  panel?: boolean;
};

function Socials({ social, style = 'icon' }: { social: SocialLink[]; style?: SocialLabelStyle }) {
  if (social.length === 0) return null;
  return (
    <ul className={style === 'icon' ? 'he-ftr__social' : 'he-ftr__social is-text'}>
      {social.map((s) => (
        <li key={s.network + s.href}>
          <a href={s.href} {...(opensElsewhere(s) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} aria-label={SOCIAL_LABELS[s.network]}>
            {socialText(s, style) ?? <SocialIcon network={s.network} />}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Mark({ siteName, logo }: { siteName: string; logo?: FooterLogo }) {
  if (logo?.kind === 'none') return null;
  if (logo?.kind === 'image') {
    return (
      <div className="he-ftr__brand">
        <SiteImg
          src={logo.url}
          alt={siteName}
          className="he-ftr__logo"
          sizes="thumb"
          style={logo.height ? ({ '--he-ftr-logo-h': `${logo.height}px` } as React.CSSProperties) : undefined}
        />
      </div>
    );
  }
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
  const { siteName, tagline, email, address, columns, note, social, socialStyle } = props;
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
      <footer className={cn('he-ftr he-ftr--centered', props.panel && 'is-panel')}>
        <div className="shell he-ftr__center">
          <Mark siteName={siteName} logo={props.logo} />
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
          <Socials social={social} style={socialStyle} />
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
      <footer className={cn('he-ftr he-ftr--inset', props.panel && 'is-panel')}>
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
              <Socials social={social} style={socialStyle} />
              <Mark siteName={siteName} logo={props.logo} />
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
    <footer className={cn('he-ftr', `he-ftr--${variant}`, props.panel && 'is-panel')}>
      <div className="shell">
        <div className="he-ftr__grid" style={{ '--he-footer-cols': main.length || 1 } as React.CSSProperties}>
          <div className="he-ftr__lead">
            <Mark siteName={siteName} logo={props.logo} />
            {tagline && <p className="he-ftr__tagline">{tagline}</p>}
            {brandBlock && address && <address className="he-ftr__address">{address}</address>}
            {email && (
              <a href={`mailto:${email}`} className="he-ftr__email">
                {email}
              </a>
            )}
            {brandBlock && <Socials social={social} style={socialStyle} />}
          </div>
          {cols}
        </div>
        {!brandBlock && social.length > 0 && (
          <div className="he-ftr__socialrow">
            <Socials social={social} style={socialStyle} />
          </div>
        )}
        {bottom}
      </div>
    </footer>
  );
}
