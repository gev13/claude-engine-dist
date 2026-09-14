import type { Metadata } from 'next';
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
import { redirect } from 'next/navigation';
import { getNavigation } from '@/server/content/navigation';
import { isInstalled } from '@/server/install/status';
import { getServiceCatalogue } from '@/server/content/services';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getPopups } from '@/server/content/popups';
import { Popups } from '@/components/site/Popups';

/** The favicon is themeable, so the icon metadata has to be resolved per request. */
export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  const favicon = theme.brand?.faviconUrl;
  if (!favicon) return {};
  return { icons: { icon: [{ url: favicon }] } };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  /* A site with no administrator has nothing to protect and nothing to show;
     send people to the installer rather than to a login they cannot pass or a
     page that does not exist yet. */
  if (!(await isInstalled())) redirect('/install');

  const [theme, navigation, catalogue, settings, popups] = await Promise.all([
    getTheme(),
    getNavigation(),
    getServiceCatalogue(),
    getSiteSettings(),
    getPopups(),
  ]);
  const css = themeToCss(theme);
  const chrome = resolveChrome(theme.chrome);

  const navLinks = [
    ...navigation.header
      .flatMap((item) => [item, ...(item.children ?? [])])
      .map((item) => ({ name: item.label, path: item.href })),
    ...catalogue.all.map((s) => ({ name: s.title, path: servicePath(s.slug) })),
  ];

  return (
    <div className="he-site" data-header={chrome.header.variant} data-header-overlay={chrome.header.overlay ? '' : undefined}>
      {/* Saved visitor choices (reduced motion, alternate colours), applied
          before anything paints. */}
      <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      {/*
        Unlayered, so it beats the `@layer base` defaults in globals.css
        whatever order the stylesheets end up in. Empty until somebody saves a
        theme, at which point it carries only the properties they changed.
        Every value in it has been validated twice — by the schema on write and
        by themeToCss on render — because this is a style element built from
        stored input.
      */}
      {css && <style id="he-theme" dangerouslySetInnerHTML={{ __html: css }} />}

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-flare focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:uppercase focus:tracking-[0.12em] focus:text-bone"
      >
        Skip to content
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
        primaryServices={catalogue.primary}
        secondaryServices={catalogue.secondary}
        contact={{ email: settings.contactEmail || undefined, address: navigation.footerAddress || undefined, social: navigation.social ?? [] }}
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
      <Popups popups={popups} />
      <JsonLd data={graph([organization(settings), website(settings), siteNavigation(navLinks)])} />
    </div>
  );
}
