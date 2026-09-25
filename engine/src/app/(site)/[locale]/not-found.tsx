import { BlockRenderer } from '@/components/blocks/Renderer';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { messageReader } from '@/lib/messages';
import { isSafeHref } from '@/lib/navigation';
import { getMessages } from '@/server/content/messages';
import { getPageByPath, getPublicPageById } from '@/server/content/pages';
import { getSiteSettings } from '@/server/content/siteSettings';

/**
 * The page for an address that does not exist. The status stays 404
 * whatever is shown (T22, 2.18):
 *
 * - a page chosen in Settings → Pages, built from blocks like any other —
 *   never indexed and never in the sitemap;
 * - otherwise the built-in one, in the site's own words (Site translations),
 *   whose second button is a setting — or, left unset, a link to the
 *   services index only where one exists, rather than to a page that may not.
 */
export default async function NotFound() {
  const [settings, messages] = await Promise.all([getSiteSettings(), getMessages()]);

  if (settings.notFoundPageId) {
    const page = await getPublicPageById(settings.notFoundPageId);
    if (page) return <BlockRenderer blocks={page.blocks} locale={page.locale} />;
  }

  const t = messageReader(messages);
  const custom =
    settings.notFoundLinkLabel && settings.notFoundLinkHref && isSafeHref(settings.notFoundLinkHref)
      ? { label: settings.notFoundLinkLabel, href: settings.notFoundLinkHref }
      : null;
  const second = custom ?? ((await getPageByPath('/services')) ? { label: t('notFound.services'), href: '/services' } : null);

  return (
    <Section size="lg" rule={false}>
      <div className="min-h-[46vh]">
        <Eyebrow>{t('notFound.eyebrow')}</Eyebrow>
        <Heading level={1} className="max-w-[18ch]">
          {t('notFound.title')}
        </Heading>
        <p className="mt-5 max-w-[52ch] text-[17px] text-ash">{t('notFound.body')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/" withArrow>
            {t('notFound.home')}
          </Button>
          {second && (
            <Button href={second.href} variant="outline">
              {second.label}
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
