import { messageReader } from '@/lib/messages';
import { localeConfig } from '@/lib/locales';
import { sitemapStylesheet, XSL_HEADERS } from '@/lib/seo/sitemapXsl';
import { getMessages } from '@/server/content/messages';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getTheme } from '@/server/content/theme';

export const revalidate = 3600;

/**
 * 3.19 — the stylesheet the sitemaps point at while Settings → "Readable
 * sitemap in browsers" is on. It answers either way, so a browser holding a
 * cached sitemap never gets a 404 for it; switched off, nothing links here.
 * The words are the site's `sitemap.*` translations in its default language.
 */
export async function GET() {
  const locale = localeConfig().defaultLocale;
  const [settings, theme, messages] = await Promise.all([getSiteSettings(), getTheme(), getMessages(locale)]);
  return new Response(
    sitemapStylesheet({
      siteName: settings.name ?? '',
      lang: locale,
      accent: theme.colors?.primary ?? '',
      t: messageReader(messages),
    }),
    { headers: XSL_HEADERS },
  );
}
