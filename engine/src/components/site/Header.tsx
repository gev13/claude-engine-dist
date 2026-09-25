'use client';

import Link from '@/components/ui/SiteLink';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SiteMark, Wordmark } from '@/components/ui/Logo';
import type { ResolvedChrome } from '@/lib/chrome';
import { type NavChild, type NavItem, SOCIAL_LABELS, type SocialLabelStyle, type SocialLink, linkAttrs, opensElsewhere, socialText } from '@/lib/navigation';
import type { ServiceRef } from '@/lib/site';
import type { Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Icon, SocialIcon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './SiteExtras';
import { useMessages } from './Messages';
import { SiteImg } from '@/components/ui/SiteImg';

/* ═══════════════════════════════════════════════════════════════════════════
   Header
   ───────────────────────────────────────────────────────────────────────────
   One component, every header the library offers. The variant only decides
   where the same slots sit — logo, links, actions, menu button — so a site
   can change its header without its menus changing, and the other way round.

     HD1 classic · HD2 centred · HD3 slim · HD4 pill           (chrome.header)
     MM1 compact · MM2 sheet · MM3 cards · MM4 full screen      (chrome.megaMenu)
     MN1 drill-down · MN2 accordion · MN3 drawer · MN4 push     (chrome.mobileMenu)

   The tier at which links give way to the menu button is pure CSS, keyed on
   `data-collapse`, so the server render is already right at every width.
   ═══════════════════════════════════════════════════════════════════════════ */

type Cta = { label: string; href: string } | null;
type ServiceLink = Pick<ServiceRef, 'slug' | 'title' | 'path'>;

export type HeaderProps = {
  siteName: string;
  brand?: Theme['brand'];
  chrome: Pick<ResolvedChrome, 'header' | 'megaMenu' | 'mobileMenu' | 'announcement' | 'themeToggle'>;
  nav: NavItem[];
  cta: Cta;
  secondaryCta: Cta;
  /** 2.19 — the Overlay menu (Menus), used by the full-screen menu when chosen. */
  overlayNav?: NavItem[];
  primaryServices: readonly ServiceLink[];
  secondaryServices: readonly ServiceLink[];
  /** The contact column of the MN7 menu. */
  contact?: HeaderContact;
  /** Package 8. Absent or single-entry means no switcher is rendered. */
  locales?: string[];
  locale?: string;
  defaultLocale?: string;
  /** The blog index, where the search icon goes — a setting since 2.13. */
  searchHref?: string;
};

export type HeaderContact = {
  email?: string;
  address?: string;
  social: SocialLink[];
  /** 2.18 — icons, names or short labels, as set in Menus. */
  socialStyle?: SocialLabelStyle;
};

type Group = { title?: string; links: NavChild[] };

/** Links without an image are grouped under their headings; links with one are cards. */
function splitChildren(children: NavChild[] = []): { groups: Group[]; cards: NavChild[] } {
  const groups: Group[] = [];
  const cards: NavChild[] = [];
  for (const child of children) {
    if (child.imageUrl) {
      cards.push(child);
      continue;
    }
    const title = child.group || undefined;
    let group = groups.find((g) => g.title === title);
    if (!group) {
      group = { title, links: [] };
      groups.push(group);
    }
    group.links.push(child);
  }
  return { groups, cards };
}

/** A path as the menus spell it: no default-language prefix, no trailing slash. */
function currentPath(pathname: string, defaultLocale?: string): string {
  let path = pathname.replace(/\/+$/, '') || '/';
  if (defaultLocale && (path === `/${defaultLocale}` || path.startsWith(`/${defaultLocale}/`))) {
    path = path.slice(defaultLocale.length + 1) || '/';
  }
  return path;
}

const hasChildren = (item: NavItem) => (item.children?.length ?? 0) > 0;

function Brand({ siteName, brand, onClick }: { siteName: string; brand?: Theme['brand']; onClick?: () => void }) {
  return (
    <Link href="/" className="he-hdr__logo" aria-label={`${brand?.wordmark ?? siteName} — home`} onClick={onClick}>
      {brand?.logoType === 'image' && brand.logoUrl ? (
        <SiteImg src={brand.logoUrl} alt="" className="he-hdr__img" sizes="thumb" />
      ) : (
        <span className="he-hdr__mark">
          <SiteMark />
        </span>
      )}
      {brand?.showWordmark !== false && brand?.logoType !== 'image' && <Wordmark text={brand?.wordmark ?? siteName} />}
    </Link>
  );
}

export function Header(props: HeaderProps) {
  const { chrome, nav, cta, secondaryCta, siteName, brand } = props;
  const h = chrome.header;
  const pathname = usePathname();
  const t = useMessages();

  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /** 2.19 — hidden while scrolling down, back while scrolling up (`behaviour: hide`). */
  const [tucked, setTucked] = useState(false);
  const [overMedia, setOverMedia] = useState(false);
  const [announcementHidden, setAnnouncementHidden] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  /* Publish the header's real height: the over-hero layout and the mobile
     panel both need it, and the theme can change the logo and type size. */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--he-header-h', `${wrap.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setOpenId(null);
  }, [pathname]);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (h.behaviour === 'hide') {
        // Only past the header's own height, and only after a few pixels of intent.
        const height = wrapRef.current?.offsetHeight ?? 64;
        if (y <= height) setTucked(false);
        else if (Math.abs(y - last) > 6) setTucked(y > last);
      }
      last = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [h.behaviour]);

  /* Transparent only over a hero that runs under the header; anywhere else
     the header stays solid so its text never lands on the wrong background. */
  useEffect(() => {
    if (!h.overlay) return;
    const first = document.querySelector('main')?.firstElementChild;
    setOverMedia(
      !!first && (first.classList.contains('he-bleed-top') || first.querySelector(':scope > .he-bleed-top') !== null),
    );
  }, [h.overlay, pathname]);

  const announcementKey = chrome.announcement ? `he-ann:${chrome.announcement.text}` : '';
  useEffect(() => {
    try {
      if (announcementKey && window.localStorage.getItem(announcementKey) === '1') setAnnouncementHidden(true);
    } catch {
      /* storage blocked: the ribbon simply stays */
    }
  }, [announcementKey]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menuOpen) {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
      setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const fullscreenOpen = openId !== null && chrome.megaMenu === 'fullscreen';

  useEffect(() => {
    const body = document.body;
    body.style.overflow = menuOpen || fullscreenOpen ? 'hidden' : '';
    body.classList.toggle('he-push-open', menuOpen && chrome.mobileMenu.variant === 'push');
    return () => {
      body.style.overflow = '';
      body.classList.remove('he-push-open');
    };
  }, [menuOpen, fullscreenOpen, chrome.mobileMenu.variant]);

  const solid = !h.overlay || !overMedia || scrolled || menuOpen || openId !== null;
  /* The server renders under the rewritten `/en/about`, the browser sees
     `/about` (and `/about/` on a slashed site), so both are brought to the
     one spelling the menus use before comparing — otherwise the server marks
     nothing active and hydration keeps it that way. */
  const current = currentPath(pathname, props.defaultLocale);
  const isActive = (href: string) => {
    const target = href.replace(/\/+$/, '') || '/';
    return current === target || (target !== '/' && current.startsWith(`${target}/`));
  };
  const openItem = nav.find((item) => item.id === openId && hasChildren(item));

  const close = () => setOpenId(null);
  const enter = (id: string) => {
    window.clearTimeout(hoverTimer.current);
    if (chrome.megaMenu !== 'fullscreen') setOpenId(id);
  };
  const leave = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpenId(null), 160);
  };

  const renderNav = (items: NavItem[], className?: string, label = 'Main') => (
    <nav className={cn('he-hdr__nav', className)} aria-label={label}>
      <ul>
        {items.map((item) => {
          if (!hasChildren(item)) {
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  {...linkAttrs(item)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn('he-hdr__link', isActive(item.href) && 'is-active')}
                >
                  {item.label}
                </Link>
              </li>
            );
          }
          const open = openId === item.id;
          return (
            <li
              key={item.id}
              className="he-hdr__item"
              onPointerEnter={(e) => e.pointerType === 'mouse' && enter(item.id)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && leave()}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`he-mega-${item.id}`}
                onClick={() => setOpenId(open ? null : item.id)}
                className={cn('he-hdr__link', (open || isActive(item.href)) && 'is-open')}
              >
                {item.label}
                <Icon.Chevron size={14} className="he-hdr__chev" />
              </button>
              {chrome.megaMenu === 'compact' && open && <MegaPanel variant="compact" item={item} onNavigate={close} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
  const nav_ = renderNav(nav);
  const half = Math.ceil(nav.length / 2);

  const search = h.search && (
    <Link href={props.searchHref ?? '/blog'} className="he-hdr__icon he-keep" aria-label={t('chrome.search')}>
      <Icon.Search size={19} />
    </Link>
  );

  const actions = (
    <div className="he-hdr__actions">
      {h.variant !== 'pill' && search}
      {props.locales && props.locales.length > 1 && (
        <LanguageSwitcher
          locales={props.locales}
          current={props.locale ?? props.locales[0]!}
          defaultLocale={props.defaultLocale ?? props.locales[0]!}
        />
      )}
      {secondaryCta && h.variant !== 'pill' && (
        <Link href={secondaryCta.href} className="he-hdr__secondary">
          {secondaryCta.label}
        </Link>
      )}
      {cta && (
        <Link href={cta.href} className={cn('he-hdr__cta he-btn he-btn-primary', h.ctaOnMobile && 'he-keep')}>
          {cta.label}
        </Link>
      )}
    </div>
  );

  const showLabel = h.variant === 'centered' || h.variant === 'pill' || h.variant === 'rail';
  const toggle = (
    <button
      ref={toggleRef}
      type="button"
      className={cn('he-hdr__toggle', h.variant === 'menuButtonInline' && 'is-round')}
      aria-expanded={menuOpen}
      aria-controls="he-menu"
      aria-label={menuOpen ? 'Close menu' : `Open ${h.menuLabel.toLowerCase()}`}
      onClick={() => setMenuOpen((v) => !v)}
    >
      <Icon.Menu size={20} />
      {showLabel && <span className="he-hdr__toggle-label">{h.menuLabel}</span>}
    </button>
  );

  /* 2.19 (T25) — the glass tint and blur, and the bar's height per tier, as
     custom properties the stylesheet reads. Numbers only, all checked by the
     schema; nothing is set when nothing was chosen. */
  const heights = h.height;
  const hasHeight = Boolean(heights.base || heights.laptop || heights.tablet || heights.mobile);
  const headerStyle =
    h.background === 'glass' || hasHeight
      ? ({
          ...(h.background === 'glass' ? { '--he-glass-blur': `${h.glassBlur}px`, '--he-glass-tint': `${h.glassOpacity}%` } : {}),
          ...(heights.base ? { '--hh-base': `${heights.base}px` } : {}),
          ...(heights.laptop ? { '--hh-laptop': `${heights.laptop}px` } : {}),
          ...(heights.tablet ? { '--hh-tablet': `${heights.tablet}px` } : {}),
          ...(heights.mobile ? { '--hh-mobile': `${heights.mobile}px` } : {}),
        } as React.CSSProperties)
      : undefined;

  const services = [
    { title: 'Core services', links: props.primaryServices },
    { title: 'Specialist', links: props.secondaryServices },
  ].filter((group) => group.links.length > 0);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'he-hdr',
        `he-hdr--${h.variant}`,
        h.sticky && 'is-sticky',
        h.overlay && 'is-overlay',
        solid && 'is-solid',
        h.variant === 'rail' && `is-rail-${h.railButton}`,
        // 2.19 (T25) — each only when chosen, so an untouched header keeps its classes.
        h.background !== 'solid' && `is-bg-${h.background}`,
        h.behaviour === 'hide' && tucked && !menuOpen && openId === null && 'is-tucked',
        h.behaviour === 'shrink' && scrolled && 'is-shrunk',
        h.logoMobile === 'center' && 'is-logo-center',
        h.variant === 'menuButtonInline' && `is-menu-${h.menuSide}`,
        hasHeight && 'has-height',
      )}
      data-collapse={h.collapseAt}
      style={headerStyle}
    >
      {chrome.announcement && !announcementHidden && (
        <div className="he-announce he-shift">
          <p>
            {chrome.announcement.text}
            {chrome.announcement.href && (
              <Link href={chrome.announcement.href} className="he-announce__link">
                {chrome.announcement.linkLabel || 'Learn more'} ›
              </Link>
            )}
          </p>
          {chrome.announcement.dismissible && (
            <button
              type="button"
              className="he-announce__close"
              aria-label="Dismiss announcement"
              onClick={() => {
                try {
                  window.localStorage.setItem(announcementKey, '1');
                } catch {
                  /* dismissed for this page only */
                }
                setAnnouncementHidden(true);
              }}
            >
              <Icon.Close size={16} />
            </button>
          )}
        </div>
      )}

      {h.variant === 'pill' && (chrome.themeToggle || secondaryCta) && (
        <div className="he-hdr__utility he-shift">
          {chrome.themeToggle && <ThemeToggle compact />}
          {secondaryCta && (
            <Link href={secondaryCta.href} className="he-hdr__utility-link">
              {secondaryCta.label}
            </Link>
          )}
        </div>
      )}

      <header className="he-hdr__bar he-shift">
        <div className="he-hdr__inner">
          {h.variant === 'centered' ? (
            <>
              {toggle}
              <Brand siteName={siteName} brand={brand} />
              {actions}
            </>
          ) : h.variant === 'pill' ? (
            <>
              <Brand siteName={siteName} brand={brand} />
              <div className="he-hdr__pill">
                {nav_}
                {h.search && (
                  <Link href={props.searchHref ?? '/blog'} className="he-hdr__pill-search">
                    <Icon.Search size={16} />
                    {t('chrome.search')}
                  </Link>
                )}
              </div>
              {actions}
              {toggle}
            </>
          ) : h.variant === 'splitLogo' ? (
            // HD5 — half the links each side of the logo; the menu button takes the left side when they collapse.
            <>
              <div className="he-hdr__side is-left">
                {toggle}
                {renderNav(nav.slice(0, half), 'is-left')}
              </div>
              <Brand siteName={siteName} brand={brand} />
              <div className="he-hdr__side is-right">
                {nav.length > half && renderNav(nav.slice(half), 'is-right', 'Main, continued')}
                {actions}
              </div>
            </>
          ) : h.variant === 'menuButtonInline' ? (
            // 2.19 (T25) — a round menu button that opens the full-screen menu at every width, then the logo, links and button.
            h.menuSide === 'left' ? (
              <>
                {toggle}
                <Brand siteName={siteName} brand={brand} />
                {nav_}
                {actions}
              </>
            ) : (
              <>
                <Brand siteName={siteName} brand={brand} />
                {nav_}
                {actions}
                {toggle}
              </>
            )
          ) : h.variant === 'rail' ? (
            // HD9 — the menu button is the navigation; the stylesheet lays the rail out down the side.
            <>
              <Brand siteName={siteName} brand={brand} />
              {toggle}
              {actions}
            </>
          ) : (
            // Classic, and the stacked, boxed and sidebar headers, which the stylesheet rearranges.
            <>
              <Brand siteName={siteName} brand={brand} />
              {nav_}
              {actions}
              {toggle}
            </>
          )}
        </div>
      </header>

      {openItem && (chrome.megaMenu === 'sheet' || chrome.megaMenu === 'cards') && (
        <>
          <div className="he-mega-backdrop" onClick={close} aria-hidden="true" />
          <div className="he-mega-wrap" onPointerEnter={() => enter(openItem.id)} onPointerLeave={leave}>
            <MegaPanel variant={chrome.megaMenu} item={openItem} onNavigate={close} />
          </div>
        </>
      )}

      {fullscreenOpen && (
        <FullscreenMenu items={nav} activeId={openId} onSelect={setOpenId} onClose={close} siteName={siteName} brand={brand} />
      )}

      <MobileMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          toggleRef.current?.focus();
        }}
        config={chrome.mobileMenu}
        nav={chrome.mobileMenu.source === 'overlay' && props.overlayNav && props.overlayNav.length > 0 ? props.overlayNav : nav}
        cta={cta}
        secondaryCta={secondaryCta}
        services={services}
        siteName={siteName}
        brand={brand}
        contact={props.contact ?? { social: [] }}
      />
    </div>
  );
}

/* ── Desktop dropdowns (MM1–MM3) ─────────────────────────────────────────── */

function LinkGroups({ groups, onNavigate, leadFirst = false }: { groups: Group[]; onNavigate: () => void; leadFirst?: boolean }) {
  return (
    <>
      {groups.map((group, i) => (
        <div key={group.title ?? i} className={cn('he-mega__group', leadFirst && i === 0 && 'is-lead')}>
          {group.title && <div className="he-mega__heading">{group.title}</div>}
          <ul>
            {group.links.map((link) => (
              <li key={link.id}>
                <Link href={link.href} {...linkAttrs(link)} onClick={onNavigate}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function MegaCard({ card, onNavigate }: { card: NavChild; onNavigate: () => void }) {
  return (
    <Link href={card.href} {...linkAttrs(card)} onClick={onNavigate} className="he-mega__card">
      <SiteImg src={card.imageUrl} alt="" loading="lazy" sizes="thumb" />
      <span className="he-mega__cardtitle">{card.label}</span>
      {card.description && <span className="he-mega__carddesc">{card.description}</span>}
    </Link>
  );
}

function MegaPanel({
  variant,
  item,
  onNavigate,
}: {
  variant: 'compact' | 'sheet' | 'cards';
  item: NavItem;
  onNavigate: () => void;
}) {
  const { groups, cards } = splitChildren(item.children);
  const id = `he-mega-${item.id}`;

  if (variant === 'compact') {
    return (
      <div id={id} className="he-mega he-mega--compact">
        {groups.length > 0 && (
          <div className="he-mega__links">
            <LinkGroups groups={groups} onNavigate={onNavigate} />
          </div>
        )}
        {cards.length > 0 && (
          <div className="he-mega__cards">
            {cards.slice(0, 2).map((card) => (
              <MegaCard key={card.id} card={card} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'sheet') {
    return (
      <div id={id} className="he-mega he-mega--sheet">
        <div className="he-mega__inner he-mega__sheet">
          <LinkGroups groups={groups} onNavigate={onNavigate} leadFirst />
          {cards.length > 0 && (
            <div className="he-mega__cards">
              {cards.slice(0, 2).map((card) => (
                <MegaCard key={card.id} card={card} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="he-mega he-mega--cards">
      <div className="he-mega__inner he-mega__split">
        <div className="he-mega__links">
          <LinkGroups groups={groups} onNavigate={onNavigate} />
        </div>
        <div className="he-mega__cards">
          {cards.slice(0, 4).map((card) => (
            <MegaCard key={card.id} card={card} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
      {item.href !== '#' && (
        <div className="he-mega__all">
          <Link href={item.href} className="he-btn he-btn-outline" onClick={onNavigate}>
            View all {item.label}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ── MM4: full screen, three levels ──────────────────────────────────────── */

function FullscreenMenu({
  items,
  activeId,
  onSelect,
  onClose,
  siteName,
  brand,
}: {
  items: NavItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  siteName: string;
  brand?: Theme['brand'];
}) {
  const active = items.find((i) => i.id === activeId) ?? items.find(hasChildren);
  const { groups, cards } = splitChildren(active?.children);
  const featured = cards[0];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className="he-fsmenu" role="dialog" aria-modal="true" aria-label={`${active?.label ?? 'Site'} menu`}>
      <div className="he-fsmenu__top">
        <button ref={closeRef} type="button" className="he-fsmenu__close" onClick={onClose} aria-label="Close menu">
          <Icon.Close size={20} />
        </button>
        <Brand siteName={siteName} brand={brand} onClick={onClose} />
      </div>
      <div className="he-fsmenu__grid">
        <ul className="he-fsmenu__l1">
          {items.map((item) => (
            <li key={item.id}>
              {hasChildren(item) ? (
                <button
                  type="button"
                  aria-current={item.id === active?.id ? 'true' : undefined}
                  className={cn(item.id === active?.id && 'is-active')}
                  onClick={() => onSelect(item.id)}
                >
                  {item.label}
                  <Icon.Chevron dir="right" size={16} />
                </button>
              ) : (
                <Link href={item.href} {...linkAttrs(item)} onClick={onClose}>
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="he-fsmenu__l2">
          {active && (
            <Link href={active.href} className="he-fsmenu__parent" onClick={onClose}>
              {active.label}
            </Link>
          )}
          {groups.map((group, i) =>
            group.title ? (
              <details key={group.title} open={i === 0} className="he-fsmenu__group">
                <summary>
                  {group.title}
                  <Icon.Chevron size={14} />
                </summary>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.id}>
                      <Link href={link.href} {...linkAttrs(link)} onClick={onClose}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <ul key={i} className="he-fsmenu__plain">
                {group.links.map((link) => (
                  <li key={link.id}>
                    <Link href={link.href} {...linkAttrs(link)} onClick={onClose}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ),
          )}
          {cards.slice(1).map((card) => (
            <Link key={card.id} href={card.href} className="he-fsmenu__extra" onClick={onClose}>
              {card.label}
            </Link>
          ))}
        </div>

        <div className="he-fsmenu__feature">
          {featured ? (
            <>
              <SiteImg src={featured.imageUrl} alt="" />
              <div className="he-fsmenu__ftitle">{featured.label}</div>
              {featured.description && <p>{featured.description}</p>}
              <Link href={featured.href} className="he-btn he-btn-outline" onClick={onClose}>
                Discover more
              </Link>
            </>
          ) : (
            active && (
              /* No image card in this section: the pane still says where you
                 are and offers the section itself, rather than sitting empty. */
              <>
                <div className="he-fsmenu__ftitle">{active.label}</div>
                {active.href !== '#' && (
                  <Link href={active.href} className="he-btn he-btn-outline" onClick={onClose}>
                    View all {active.label}
                  </Link>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ── MN1–MN4: the menu behind the menu button ────────────────────────────── */

function MobileMenu({
  open,
  onClose,
  config,
  nav,
  cta,
  secondaryCta,
  services,
  siteName,
  brand,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  config: ResolvedChrome['mobileMenu'];
  nav: NavItem[];
  cta: Cta;
  secondaryCta: Cta;
  services: { title: string; links: readonly ServiceLink[] }[];
  siteName: string;
  brand?: Theme['brand'];
  contact: HeaderContact;
}) {
  const [drill, setDrill] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** 2.19 — the item under the pointer, for the picture beside the menu. */
  const [pointed, setPointed] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else {
      setDrill(null);
      setExpanded(new Set());
      setPointed(null);
    }
  }, [open]);

  /* 2.19 (T26) — focus stays inside while the menu is open: Tab from the last
     control returns to the first, Shift+Tab from the first to the last. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const drawer = config.variant === 'drawer' || config.variant === 'push';
  // MN5–MN7 open sub-items in place, like the accordions, in much larger type.
  const fullscreen = config.variant.startsWith('fullscreen');
  const showContact = config.variant === 'fullscreenCreative' && Boolean(contact.email || contact.address || contact.social.length || config.phone);
  const picture = config.hoverImages && fullscreen ? nav.find((item) => item.id === pointed)?.imageUrl : undefined;
  const drilled = config.variant === 'drilldown' ? nav.find((i) => i.id === drill) : undefined;

  const ctas = (cta || secondaryCta) && (
    <div className={cn('he-menu__cta', config.ctaPosition === 'bottom' && 'is-bottom')}>
      {cta && (
        <Link href={cta.href} className="he-btn he-btn-primary" onClick={onClose}>
          {cta.label}
        </Link>
      )}
      {secondaryCta && (
        <Link href={secondaryCta.href} className="he-btn he-btn-outline" onClick={onClose}>
          {secondaryCta.label}
        </Link>
      )}
    </div>
  );

  const childList = (item: NavItem) => {
    const { groups, cards } = splitChildren(item.children);
    return (
      <div className="he-menu__sub">
        {groups.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title && <div className="he-menu__heading">{group.title}</div>}
            <ul>
              {group.links.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} {...linkAttrs(link)} onClick={onClose}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {cards.length > 0 && (
          <ul>
            {cards.map((card) => (
              <li key={card.id}>
                <Link href={card.href} {...linkAttrs(card)} onClick={onClose}>
                  {card.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      {drawer && open && <div className="he-menu-backdrop" onClick={onClose} aria-hidden="true" />}
      <div
        id="he-menu"
        ref={panelRef}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          'he-menu',
          `he-menu--${config.variant}`,
          `is-${config.variant === 'push' ? 'left' : config.side}`,
          config.align === 'center' && 'is-center',
          config.largeType && 'is-large',
          fullscreen && 'is-fullscreen',
          showContact && 'has-contact',
          // 2.19 (T26) — each only when chosen.
          fullscreen && config.size === 'huge' && 'is-huge',
          config.entrance !== 'none' && `is-enter-${config.entrance}`,
          config.hoverImages && fullscreen && 'has-pictures',
        )}
        style={config.opacity < 100 ? ({ '--he-menu-alpha': `${config.opacity}%` } as React.CSSProperties) : undefined}
      >
        <div className="he-menu__top">
          <Brand siteName={siteName} brand={brand} onClick={onClose} />
          <button ref={closeRef} type="button" className="he-menu__close" onClick={onClose} aria-label="Close menu">
            <Icon.Close size={22} />
          </button>
        </div>

        {config.ctaPosition === 'top' && ctas}

        <div className="he-menu__body">
          {drilled ? (
            <>
              <button type="button" className="he-menu__back" onClick={() => setDrill(null)}>
                <Icon.Chevron dir="left" size={16} />
                Back
              </button>
              <Link href={drilled.href} className="he-menu__row is-parent" onClick={onClose}>
                {drilled.label}
              </Link>
              {childList(drilled)}
            </>
          ) : (
            <ul className="he-menu__list">
              {nav.map((item) => {
                if (!hasChildren(item)) {
                  return (
                    <li key={item.id} onPointerEnter={config.hoverImages ? () => setPointed(item.id) : undefined}>
                      <Link href={item.href} {...linkAttrs(item)} className="he-menu__row" onClick={onClose}>
                        {item.label}
                      </Link>
                    </li>
                  );
                }
                if (config.variant === 'drilldown') {
                  return (
                    <li key={item.id}>
                      <button type="button" className="he-menu__row" onClick={() => setDrill(item.id)}>
                        {item.label}
                        <Icon.Chevron dir="right" size={18} />
                      </button>
                    </li>
                  );
                }
                const isOpen = expanded.has(item.id);
                return (
                  <li key={item.id} onPointerEnter={config.hoverImages ? () => setPointed(item.id) : undefined}>
                    <button
                      type="button"
                      className="he-menu__row"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        })
                      }
                    >
                      {item.label}
                      {fullscreen ? (
                        <span className={cn('he-menu__plus', isOpen && 'is-open')} aria-hidden="true">
                          <Icon.Plus size={22} />
                        </span>
                      ) : (
                        <Icon.Chevron dir={isOpen ? 'up' : 'down'} size={18} />
                      )}
                    </button>
                    {isOpen && childList(item)}
                  </li>
                );
              })}
            </ul>
          )}

          {!drilled &&
            services.map((group) => (
              <div key={group.title} className="he-menu__services">
                <div className="he-menu__heading">{group.title}</div>
                <ul>
                  {group.links.map((s) => (
                    <li key={s.slug}>
                      <Link href={s.path} onClick={onClose}>
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        {picture && (
          // The pointed item's own picture, beside the list (2.19).
          <div className="he-menu__picture" aria-hidden="true">
            <SiteImg key={picture} src={picture} alt="" className="he-fill" sizes="half" />
          </div>
        )}

        {showContact && (
          <aside className="he-menu__aside" aria-label="Contact">
            <div className="he-menu__heading">{config.contactTitle || 'Get in touch'}</div>
            {config.phone && (
              <a href={`tel:${config.phone.replace(/[^+0-9]/g, '')}`} className="he-menu__email">
                {config.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="he-menu__email">
                {contact.email}
              </a>
            )}
            {contact.address && <p className="he-menu__address">{contact.address}</p>}
            {contact.social.length > 0 && (
              <ul className="he-menu__social">
                {contact.social.map((s) => (
                  <li key={s.network + s.href}>
                    <a href={s.href} {...(opensElsewhere(s) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} aria-label={SOCIAL_LABELS[s.network]}>
                      {socialText(s, contact.socialStyle ?? 'icon') ?? <SocialIcon network={s.network} />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {config.ctaPosition === 'bottom' && ctas}
      </div>
    </>
  );
}
