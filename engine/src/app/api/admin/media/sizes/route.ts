import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { missingSizesCount, sizesJob, startSizesJob } from '@/server/media/variants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Media → Generate sizes (T18, 2.17): how far it has got. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ job: sizesJob(), missing: await missingSizesCount() });
  });
}

/** Start it in the background — for pictures without copies, or all of them. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ onlyMissing: z.boolean().default(true) }));
    if (!parsed.ok) return parsed.response;
    if (!(await startSizesJob(parsed.data))) return badRequest('Sizes are already being generated.');
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'media.sizes',
      targetType: 'media',
      summary: `Started generating picture sizes (${parsed.data.onlyMissing ? 'pictures without them' : 'every picture'})`,
      ip: clientIp(request.headers),
    });
    return ok({ job: sizesJob(), missing: await missingSizesCount() });
  });
}
