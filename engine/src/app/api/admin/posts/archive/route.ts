import { z } from 'zod';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { BLOG_ARCHIVE_SETTING_KEY, blogArchiveSchema } from '@/lib/blog';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { getBlogArchive } from '@/server/content/blogArchive';
import { revalidateEverything } from '@/server/content/revalidate';
import { recordUsage } from '@/server/content/savedBlocks';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Posts → Category pages (T20, 2.18): the blocks above and below every
 * category's list. Design, so `appearance:*`, like the project template; the
 * blocks are checked like a popup's, so one that would vanish is refused by
 * name.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:read');
    if (!guard.ok) return guard.response;
    return ok({ template: await getBlogArchive() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ template: blogArchiveSchema }));
    if (!parsed.ok) return parsed.response;
    const before = parsed.data.template.before as AnyBlock[];
    const after = parsed.data.template.after as AnyBlock[];

    const problems = [...collectInvalidBlocks(before), ...collectInvalidBlocks(after)];
    if (problems.length > 0) return badRequest(`${problems[0]} and was not saved.`, { problems });
    const value = { before: parseBlocks(before), after: parseBlocks(after) };

    await db
      .insert(settings)
      .values({ key: BLOG_ARCHIVE_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'blog.archive.update',
      targetType: 'settings',
      targetId: BLOG_ARCHIVE_SETTING_KEY,
      summary: `Changed the category pages: ${value.before.length} block(s) above the posts, ${value.after.length} below`,
      ip: clientIp(request.headers),
    });
    await recordUsage('blogArchive', BLOG_ARCHIVE_SETTING_KEY, [...value.before, ...value.after] as AnyBlock[]);
    revalidateEverything();
    return ok({ template: value });
  });
}
