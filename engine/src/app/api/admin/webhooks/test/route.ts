import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { getWebhooks, testWebhook } from '@/server/webhooks/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Send a saved webhook a test delivery and say what it answered. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ id: z.string().uuid() }));
    if (!parsed.ok) return parsed.response;

    // An outbound request per click: bounded, so the button is not a way to hammer somebody.
    const limit = await rateLimit({ key: `webhook-test:${guard.user.id}`, limit: 20, windowSec: 3600, blockSec: 600 });
    if (!limit.allowed) return badRequest('That is a lot of tests. Try again in a few minutes.');

    const hook = (await getWebhooks()).hooks.find((candidate) => candidate.id === parsed.data.id);
    if (!hook) return badRequest('Save the webhook first, then test it.');

    const result = await testWebhook(hook);
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'webhooks.test',
      targetType: 'settings',
      targetId: hook.id,
      summary: `Sent a test to webhook “${hook.name}”: ${result.ok ? 'delivered' : result.error}`,
      ip: clientIp(request.headers),
    });
    return ok(result);
  });
}
