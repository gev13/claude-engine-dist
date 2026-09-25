import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { SITE_URL } from '@/lib/env';
import { badRequest, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { PREVIEW_TTL_SECONDS, createPreviewToken, previewPath } from '@/server/content/preview';
import { db } from '@/server/db';
import { pages, posts, projects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  entityType: z.enum(['page', 'post', 'project']),
  entityId: z.string().uuid(),
});

/**
 * Mint a shareable preview link for unpublished content.
 *
 * Audited, because it hands out a URL that shows content the public cannot
 * see — who created one and when is worth knowing.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    const { entityType, entityId } = parsed.data;

    const row =
      entityType === 'page'
        ? (await db.select({ authorId: pages.authorId, title: pages.title }).from(pages).where(eq(pages.id, entityId)).limit(1))[0]
        : entityType === 'project'
          ? (await db.select({ authorId: projects.authorId, title: projects.title }).from(projects).where(eq(projects.id, entityId)).limit(1))[0]
          : (await db.select({ authorId: posts.authorId, title: posts.title }).from(posts).where(eq(posts.id, entityId)).limit(1))[0];

    if (!row) return notFound('That content does not exist.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return badRequest('You cannot preview that.');

    const token = createPreviewToken({ entityType, entityId });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'content.preview_link',
      targetType: entityType,
      targetId: entityId,
      summary: `Created a preview link for "${row.title}"`,
      ip: clientIp(request.headers),
    });

    return ok({
      url: `${SITE_URL}${previewPath(token)}`,
      path: previewPath(token),
      expiresInSeconds: PREVIEW_TTL_SECONDS,
    });
  });
}
