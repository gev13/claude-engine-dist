import type { Metadata, Viewport } from 'next';
import type { Theme } from '@/lib/theme';
import { notFound, redirect } from 'next/navigation';
import { PLATFORM_META } from '@/lib/credits';
import { SITE_URL } from '@/lib/env';
import { localeConfig, localeDir, type Locale } from '@/lib/locales';
import { themeToCss } from '@/lib/theme-css';
import { Footer, type FooterLogo } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { JsonLd } from '@/components/site/JsonLd';
import { BackToTop, RegionBar } from '@/components/site/SiteExtras';
import { resolveChrome } from '@/lib/chrome';
import { PREFS_SCRIPT } from '@/lib/motion';
import { graph, organization, siteNavigation, website } from '@/lib/seo/jsonld';
import { getTheme } from '@/server/content/theme';
import { getNavigation } from '@/server/content/navigation';
import { isInstalled } from '@/server/install/status';
import { getServiceCatalogue } from '@/server/content/services';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getPopups } from '@/server/content/popups';
import { getCookieNotice } from '@/server/content/cookies';
import { getSiteCode } from '@/server/content/code';
import { safeCss } from '@/lib/customCode';
import { PRESETS, activePresets, activeSnippets } from '@/lib/integrations';
import { getIntegrations, getPublicCaptcha } from '@/server/integrations/settings';
import { CaptchaProvider } from '@/components/site/Captcha';
import { CustomCursor } from '@/components/site/CustomCursor';
import { PageTransition, Preloader } from '@/components/site/PageTransition';
import { RevealFooter, SideRails } from '@/components/site/SiteMotion';
import { SiteReveal } from '@/components/blocks/library/RevealObserver';
import { responsiveImages } from '@/lib/responsive';
import { isProfile } from '@/lib/navigation';
import { titleTemplate } from '@/lib/siteSettings';
import { TagsNavigation } from '@/components/site/TagsNavigation';
import { getMessages } from '@/server/content/messages';
import { MessagesProvider } from '@/components/site/Messages';
import { Popups } from '@/components/site/Popups';
import { CookieNotice } from '@/components/site/CookieNotice';
import { getPermalinks } from '@/server/routing/config';
import { blogIndexPath } from '@/lib/permalinks';
import '@/styles/globals.css';

/* ═══════════════════════════════════════════════════════════════════════════
   The public site's root layout (package 8)
   ───────────────────────────────────────────────────────────────────────────
   This owns its own `<html>`, which the admin panel's layout does too. Two
   root layouts rather than one, for a single reason: `lang` has to follow the
   locale, and a nested layout cannot change an attribute on `<html>`.

   The alternatives were worse. Reading the locale from a header in a shared
   root layout means calling `headers()`, which opts every page into dynamic
   rendering and throws away the ISR this engine is built on. Setting `lang`
   from a script after hydration leaves crawlers and screen readers reading the
   first paint in the wrong language — which is most of the point of having it.
   ═══════════════════════════════════════════════════════════════════════════ */

type Params = { locale: string };

/** Whatever this site is configured to speak — one language, or several. */
export function generateStaticParams(): Params[] {
  return localeConfig().locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  const [settings, theme] = await Promise.all([getSiteSettings(), getTheme()]);
  const favicon = theme.brand?.faviconUrl;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${settings.tagline} ${settings.titleSeparator ?? '—'} ${settings.name}`, template: titleTemplate(settings) },
    description: settings.description,
    applicationName: settings.name,
    authors: [{ name: settings.name, url: SITE_URL }],
    ...PLATFORM_META,
    publisher: settings.name,
    formatDetection: { telephone: false, address: false, email: false },
    icons: favicon
      ? { icon: [{ url: favicon }] }
      : { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: [{ url: '/apple-icon.png' }] },
    ...(settings.discourageSearchEngines ? { robots: { index: false, follow: false } } : {}),
    other: { 'content-language': locale },
  };
}

export const viewport: Viewport = {
  themeColor: '#201e1d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  const { locale: raw } = await params;
  // The middleware only ever rewrites a configured locale into this segment, so
  // this is a guard against a direct hit rather than an expected path.
  const config = localeConfig();
  if (!config.locales.includes(raw)) notFound();
  const locale: Locale = raw;

  /* A site with no administrator has nothing to protect and nothing to show;
     send people to the installer rather than to a login they cannot pass or a
     page that does not exist yet. */
  if (!(await isInstalled())) redirect('/install');

  /* Menus, the site's own details and popups all follow the language, each
     falling back to the shared value when nobody has translated it. */
  const [theme, navigation, catalogue, settings, popups, messages, cookies, code, permalinks, integrations, captcha] = await Promise.all([
    getTheme(),
    getNavigation(locale),
    getServiceCatalogue(),
    getSiteSettings(locale),
    getPopups(locale),
    getMessages(locale),
    getCookieNotice(locale),
    getSiteCode(),
    getPermalinks(),
    getIntegrations(),
    getPublicCaptcha(),
  ]);
  /* Any tag switched on loads through /integrations.js, which also holds each
     one back until its consent category is granted (2.16). */
  /* 2.19 (T29) — the footer is wrapped only for the reveal or its own colour,
     so an untouched site's footer is where it always was in the DOM. */
  const footerWrap = (footer: React.ReactNode) =>
    chrome.footer.reveal || chrome.footer.background ? (
      <div className="he-ftr-wrap" style={chrome.footer.background ? ({ '--he-footer-bg': chrome.footer.background } as React.CSSProperties) : undefined}>
        {footer}
      </div>
    ) : (
      footer
    );
  const tagsOn = activePresets(integrations).length > 0 || activeSnippets(integrations).length > 0;
  const gtmNoscript = integrations.gtm.enabled && integrations.gtm.noscript && PRESETS.gtm.id.test(integrations.gtm.id);
  const css = themeToCss(theme);
  const chrome = resolveChrome(theme.chrome);

  const navLinks = [
    ...navigation.header
      .flatMap((item) => [item, ...(item.children ?? [])])
      .map((item) => ({ name: item.label, path: item.href })),
    ...catalogue.all.map((s) => ({ name: s.title, path: s.path })),
  ];

  return (
    // The visitor-preference script below adds classes and data-scheme to
    // <html> before React hydrates, on purpose, so the page never flashes the
    // wrong motion or colour setting.
    // `dir` matters the moment somebody configures Arabic, Hebrew, Persian or
    // Urdu — and is far harder to retrofit than to set from the start.
    /* `data-slash` tells client components the site's trailing-slash form, so
       a link rendered in the browser matches the one the server wrote. */
    <html
      lang={locale}
      dir={localeDir(locale)}
      data-slash={permalinks.trailingSlash === 'always' ? 'always' : undefined}
      data-img={responsiveImages() ? 'responsive' : undefined}
      /* 2.20 — motion off for everyone: the class every animation already
         answers to, written by the server rather than the visitor's switch. */
      className={chrome.reduceMotion ? 'he-reduce-motion' : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* The two faces above the fold. Preloading them removes the swap
            flash on first paint without delaying anything else. */}
        <link rel="preload" href="/fonts/bricolage-grotesque-var-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        {gtmNoscript && (
          /* Tag Manager for visitors without script — it cannot ask consent, so it is off unless chosen. */
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(integrations.gtm.id)}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        {/* Client components — carousels, forms, the share button — read the
            engine's own words from here; server components call getMessages. */}
        <MessagesProvider value={messages}>
        <CaptchaProvider value={captcha}>
        <div
          className="he-site"
          data-header={chrome.header.variant}
          data-header-overlay={chrome.header.overlay ? '' : undefined}
          data-transition={chrome.transition.style !== 'off' ? chrome.transition.style : undefined}
          /* 2.22 — the space the first section leaves for the notch follows the header's own height setting. */
          style={chrome.header.variant === 'notch' ? notchSpace(chrome.header.height) : undefined}
        >
          <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
          {/*
            Unlayered, so it beats the `@layer base` defaults in globals.css
            whatever order the stylesheets end up in. Empty until somebody saves
            a theme, at which point it carries only the properties they changed.
            Every value in it has been validated twice — by the schema on write
            and by themeToCss on render — because this is a style element built
            from stored input.
          */}
          {css && <style id="he-theme" dangerouslySetInnerHTML={{ __html: css }} />}
          {/* After the theme, so a site's own rules win without !important —
              and sanitised on the way in and again here, because this is the
              one field an editor writes that reaches a style element. */}
          {code.css && <style id="he-custom" dangerouslySetInnerHTML={{ __html: safeCss(code.css) }} />}

          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-flare focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:uppercase focus:tracking-[0.12em] focus:text-bone"
          >
            {messages['chrome.skipToContent']}
          </a>
          {chrome.regionBar && (
            <RegionBar
              message={chrome.regionBar.message}
              buttonLabel={chrome.regionBar.buttonLabel}
              options={chrome.regionBar.options}
            />
          )}
          <Header
            siteName={settings.name}
            brand={theme.brand}
            chrome={chrome}
            nav={navigation.header}
            cta={navigation.headerCta}
            secondaryCta={navigation.headerSecondaryCta}
            searchHref={blogIndexPath(permalinks)}
            overlayNav={navigation.overlay}
            primaryServices={catalogue.primary}
            secondaryServices={catalogue.secondary}
            contact={{
              email: settings.contactEmail || undefined,
              address: navigation.footerAddress || undefined,
              social: navigation.social ?? [],
              socialStyle: navigation.socialStyle,
            }}
            locales={config.locales}
            locale={locale}
            defaultLocale={config.defaultLocale}
          />
          <div className="he-shift">
            <main id="main">{children}</main>
            {footerWrap(
              <Footer
              siteName={settings.name}
              tagline={settings.tagline}
              email={chrome.footer.email ? settings.contactEmail : undefined}
              address={navigation.footerAddress}
              columns={navigation.footer}
              note={navigation.footerNote}
              social={navigation.social}
              socialStyle={navigation.socialStyle}
              variant={chrome.footer.variant}
              shareChip={chrome.footer.shareChip}
              logo={footerLogo(chrome.footer, theme.brand)}
              panel={chrome.footer.panel}
              copyrightAsWritten={chrome.footer.copyrightCase === 'asWritten'}
              motionToggle={chrome.motionToggle}
              themeToggle={chrome.themeToggle}
            />,
            )}
          </div>
          {/* 2.19 — motion and chrome extras, each only when switched on. */}
          {chrome.footer.reveal && <RevealFooter onMobile={chrome.footer.revealOnMobile} />}
          {/* 3.5 — every section's entrance, when the site sets one. */}
          {theme.reveal && !chrome.reduceMotion && <SiteReveal effect={theme.reveal} />}
          {chrome.rails && <SideRails rails={chrome.rails} social={navigation.social ?? []} socialStyle={navigation.socialStyle ?? 'short'} />}
          {chrome.cursor.style !== 'off' && !chrome.reduceMotion && <CustomCursor style={chrome.cursor.style} mediaLabel={chrome.cursor.mediaLabel} />}
          {chrome.transition.style !== 'off' && !chrome.reduceMotion && <PageTransition style={chrome.transition.style} />}
          {chrome.transition.preloader && !chrome.reduceMotion && (
            <Preloader>
              {theme.brand?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={theme.brand.logoUrl} alt="" />
              ) : (
                <span>{settings.name}</span>
              )}
            </Preloader>
          )}
          {chrome.backToTop && <BackToTop />}
          <Popups popups={popups} locale={locale} />
          {/* Last, and above the popups: it is the one thing a visitor is being
              asked to answer before carrying on. */}
          <CookieNotice notice={cookies} />
          {/* The ids live in the route, not here: what runs is code this
              repository wrote, and what an administrator chose is ids and
              switches (Settings → Integrations). */}
          {tagsOn && (
            <>
              <script async src="/integrations.js" />
              <TagsNavigation />
            </>
          )}
          <JsonLd
            data={graph([
              organization({
                ...settings,
                sameAs: (navigation.social ?? []).filter(isProfile).map((link) => link.href),
                logoUrl: theme.brand?.logoUrl && /^\/[A-Za-z0-9._~\-/%]*$/.test(theme.brand.logoUrl) ? theme.brand.logoUrl : undefined,
              }),
              website({ ...settings, searchPath: blogIndexPath(permalinks) }),
              siteNavigation(navLinks),
            ])}
          />
        </div>
        </CaptchaProvider>
        </MessagesProvider>
      </body>
    </html>
  );
}

/** The notch's height per tier, as the space the first section leaves under it — only the tiers that were set. */
function notchSpace(height: { base?: number; laptop?: number; tablet?: number; mobile?: number }): React.CSSProperties | undefined {
  const out: Record<string, string> = {};
  for (const tier of ['base', 'laptop', 'tablet', 'mobile'] as const) {
    const px = height[tier];
    if (typeof px === 'number' && px >= 40 && px <= 160) out[`--he-ns-${tier}`] = `${px}px`;
  }
  return Object.keys(out).length ? (out as React.CSSProperties) : undefined;
}

/** 3.1 — the footer's head: the uploaded logo when chosen and there is one, nothing, or (unset) the mark as before. */
function footerLogo(footer: { logo: 'mark' | 'image' | 'none'; logoHeight?: number }, brand: Theme['brand']): FooterLogo {
  if (footer.logo === 'none') return { kind: 'none' };
  if (footer.logo === 'image' && brand?.logoType === 'image' && brand.logoUrl) {
    return { kind: 'image', url: brand.logoUrl, height: footer.logoHeight };
  }
  return { kind: 'mark' };
}
