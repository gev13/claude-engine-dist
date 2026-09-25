import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { recentDeliveries, resendDelivery } from '@/server/webhooks/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The delivery log, newest first. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ deliveries: await recentDeliveries() });
  });
}

/** Resend one delivery, rebuilt from the submission it was about. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ id: z.string().uuid() }));
    if (!parsed.ok) return parsed.response;
    const result = await resendDelivery(parsed.data.id);
    if (!result.ok) return badRequest(result.error);
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'webhooks.resend',
      targetType: 'webhook_delivery',
      targetId: parsed.data.id,
      summary: 'Resent a webhook delivery',
      ip: clientIp(request.headers),
    });
    return ok({ ok: true });
  });
}
