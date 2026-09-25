import type { Metadata, Viewport } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SITE_URL } from '@/lib/env';
import { localeConfig, localeDir, type Locale } from '@/lib/locales';
import { themeToCss } from '@/lib/theme-css';
import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { JsonLd } from '@/components/site/JsonLd';
import { BackToTop, RegionBar } from '@/components/site/SiteExtras';
import { resolveChrome } from '@/lib/chrome';
import { PREFS_SCRIPT } from '@/lib/motion';
import { graph, organization, siteNavigation, website } from '@/lib/seo/jsonld';
import { servicePath } from '@/lib/site';
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
    title: { default: `${settings.tagline} — ${settings.name}`, template: `%s — ${settings.name}` },
    description: settings.description,
    applicationName: settings.name,
    authors: [{ name: settings.name, url: SITE_URL }],
    creator: settings.name,
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
  const tagsOn = activePresets(integrations).length > 0 || activeSnippets(integrations).length > 0;
  const gtmNoscript = integrations.gtm.enabled && integrations.gtm.noscript && PRESETS.gtm.id.test(integrations.gtm.id);
  const css = themeToCss(theme);
  const chrome = resolveChrome(theme.chrome);

  const navLinks = [
    ...navigation.header
      .flatMap((item) => [item, ...(item.children ?? [])])
      .map((item) => ({ name: item.label, path: item.href })),
    ...catalogue.all.map((s) => ({ name: s.title, path: servicePath(s.slug) })),
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
            primaryServices={catalogue.primary}
            secondaryServices={catalogue.secondary}
            contact={{
              email: settings.contactEmail || undefined,
              address: navigation.footerAddress || undefined,
              social: navigation.social ?? [],
            }}
            locales={config.locales}
            locale={locale}
            defaultLocale={config.defaultLocale}
          />
          <div className="he-shift">
            <main id="main">{children}</main>
            <Footer
              siteName={settings.name}
              tagline={settings.tagline}
              email={settings.contactEmail}
              address={navigation.footerAddress}
              columns={navigation.footer}
              note={navigation.footerNote}
              social={navigation.social}
              variant={chrome.footer.variant}
              shareChip={chrome.footer.shareChip}
              motionToggle={chrome.motionToggle}
              themeToggle={chrome.themeToggle}
            />
          </div>
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
          <JsonLd data={graph([organization(settings), website({ ...settings, searchPath: blogIndexPath(permalinks) }), siteNavigation(navLinks)])} />
        </div>
        </CaptchaProvider>
        </MessagesProvider>
      </body>
    </html>
  );
}
