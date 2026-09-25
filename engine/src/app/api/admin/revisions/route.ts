import { z } from 'zod';
import { badRequest, handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { listRevisions } from '@/server/content/revisions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({
  entityType: z.enum(['page', 'post', 'project', 'saved_block']),
  entityId: z.string().uuid(),
});

/** The history of one page or post, newest first, without the snapshot bodies. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'revisions:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const parsed = query.safeParse({
      entityType: url.searchParams.get('entityType'),
      entityId: url.searchParams.get('entityId'),
    });
    if (!parsed.success) return badRequest('Provide entityType (page, post, project or saved_block) and a valid entityId.');

    return ok({ items: await listRevisions(parsed.data.entityType, parsed.data.entityId) });
  });
}
