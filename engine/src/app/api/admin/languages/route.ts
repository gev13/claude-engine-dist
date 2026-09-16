import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { LANGUAGES, localeConfig, parseLocales } from '@/lib/locales';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { pages, posts } from '@/server/db/schema';
import { writeEnvFile } from '@/server/install/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Which languages this site publishes in (package 8).
 *
 * The list is written to `.env`, not to the database, because the routing
 * layer has to know it on the Edge runtime where there is no database. So
 * saving here needs a restart to take effect, and the screen says so — the
 * same promise the installer's database step makes.
 */

/** How much content exists in each language, so nothing is removed blindly. */
async function contentByLocale(): Promise<Record<string, { pages: number; posts: number }>> {
  const out: Record<string, { pages: number; posts: number }> = {};
  try {
    const pageRows = await db
      .select({ locale: pages.locale, n: sql<number>`count(*)::int` })
      .from(pages)
      .groupBy(pages.locale);
    for (const row of pageRows) out[row.locale] = { pages: row.n, posts: 0 };

    const postRows = await db
      .select({ locale: posts.locale, n: sql<number>`count(*)::int` })
      .from(posts)
      .groupBy(posts.locale);
    for (const row of postRows) {
      out[row.locale] = { pages: out[row.locale]?.pages ?? 0, posts: row.n };
    }
  } catch {
    /* an unreachable database is not a reason to refuse to show the list */
  }
  return out;
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const config = localeConfig();
    return ok({
      locales: config.locales,
      defaultLocale: config.defaultLocale,
      multilingual: config.multilingual,
      content: await contentByLocale(),
      /** Everything the engine can label, for the "add a language" picker. */
      available: Object.entries(LANGUAGES)
        .map(([code, info]) => ({ code, name: info.name, english: info.english, rtl: info.rtl === true }))
        .sort((a, b) => a.english.localeCompare(b.english)),
    });
  });
}

const schema = z.object({
  /** In order. The first becomes the main language, served without a prefix. */
  locales: z.array(z.string().trim().min(2).max(8)).min(1).max(20),
  /** Removing a language leaves its content unreachable, so it is deliberate. */
  force: z.boolean().default(false),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    const wanted = parseLocales(parsed.data.locales.join(','));
    if (wanted.locales.length !== parsed.data.locales.length) {
      return badRequest('Some of those are not language codes, or one is repeated.');
    }

    const before = localeConfig();
    const removed = before.locales.filter((locale) => !wanted.locales.includes(locale));

    /* Dropping a language does not delete its pages — it makes them
       unreachable, which is the kind of thing somebody discovers weeks later.
       So it has to be asked for twice. */
    if (removed.length > 0 && !parsed.data.force) {
      const content = await contentByLocale();
      const withContent = removed
        .map((locale) => ({ locale, ...(content[locale] ?? { pages: 0, posts: 0 }) }))
        .filter((entry) => entry.pages > 0 || entry.posts > 0);

      if (withContent.length > 0) {
        const detail = withContent
          .map((entry) => `${entry.locale} (${entry.pages} pages, ${entry.posts} posts)`)
          .join(', ');
        return badRequest(
          `Removing ${detail} would leave that content unreachable. It is not deleted — confirm to continue.`,
        );
      }
    }

    await writeEnvFile({ ENGINE_LOCALES: wanted.locales.join(',') });

    /* Every page was rendered with the old list baked into it — the switcher it
       shows, the hreflang tags it carries. Routing picks the new list up on the
       next restart, but prerendered HTML would keep the old one until it
       happened to expire. Dropping the cache here means the restart regenerates
       everything against the new list. */
    revalidateEverything();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'languages.update',
      targetType: 'site',
      summary: `Languages set to ${wanted.locales.join(', ')} (was ${before.locales.join(', ')})`,
      ip: clientIp(request.headers),
    });

    return ok({
      locales: wanted.locales,
      defaultLocale: wanted.defaultLocale,
      // The routing layer read the old list at boot and cannot re-read it.
      restartRequired: true,
    });
  });
}
