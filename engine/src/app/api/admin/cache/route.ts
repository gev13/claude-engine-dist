import { handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Throw away every rendered page.
 *
 * Saving already revalidates what it touched, so this is the answer to "it
 * still looks wrong" rather than the normal path — a shared thing changed
 * that no single save knows about, or a revalidation was lost to a restart.
 *
 * It clears the *server's* copies. A browser holding its own is a separate
 * problem, answered by the cache headers in `middleware.ts` rather than by a
 * button, because no server can reach into somebody's browser.
 *
 * `pages:publish`: whoever may put a page on the site may clear what the site
 * is serving. There is nothing to read and nothing to destroy, so there is no
 * GET and no confirmation.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:publish');
    if (!guard.ok) return guard.response;

    revalidateEverything();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'cache.purge',
      targetType: 'settings',
      targetId: 'cache',
      summary: 'Cleared every rendered page',
      ip: clientIp(request.headers),
    });

    return ok({ purged: true });
  });
}
