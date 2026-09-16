import { z } from 'zod';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { db } from '@/server/db';
import { enquiries } from '@/server/db/schema';
import { notifyEnquiry } from '@/server/mail/notify';
import { sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shape matches src/components/blocks/ContactFormBlock.tsx exactly. */
const schema = z.object({
  name: z.string().min(1, 'Tell us your name.').max(200),
  email: z.string().email('Enter a valid work email address.').max(255),
  company: z.string().max(200).default(''),
  role: z.string().max(200).default(''),
  businessType: z.string().max(80).default(''),
  services: z.array(z.string().max(80)).max(20).default([]),
  timing: z.string().max(300).default(''),
  message: z.string().min(1, 'Tell us a little about what you need.').max(8000),
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const limit = await rateLimit({ key: `enquiry:${ip}`, limit: 5, windowSec: 3600, blockSec: 3600 });
    if (!limit.allowed) {
      return refuseRateLimited(ip, 'enquiries', limit.retryAfter, 'Too many enquiries from this connection. Try again later.');
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (error) {
      const message =
        error instanceof z.ZodError ? (error.issues[0]?.message ?? 'Some fields need attention.') : 'Some fields need attention.';
      return badRequest(message);
    }

    // Silently accept and discard: telling a bot it was detected only helps it.
    if (body.website && body.website.trim() !== '') {
      return ok({ ok: true });
    }

    const [row] = await db
      .insert(enquiries)
      .values({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        company: body.company.trim(),
        role: body.role.trim(),
        businessType: body.businessType.trim(),
        services: body.services,
        timing: body.timing.trim(),
        message: body.message.trim(),
        ip,
        userAgent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
      })
      .returning({ id: enquiries.id });

    await audit({
      action: 'enquiry.received',
      targetType: 'enquiry',
      targetId: row?.id,
      summary: `New enquiry from ${body.company || body.name}`,
      metadata: { services: body.services, businessType: body.businessType },
      ip,
    });

    // Started, not awaited: the enquiry is stored either way.
    notifyEnquiry({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      company: body.company.trim(),
      message: body.message.trim(),
      ip,
    });

    /* The retention sweep, throttled and never thrown: the engine has no
       scheduler, so the honest trigger is the traffic the site already has —
       and somebody sending an enquiry must never see a failure because a
       tidy-up went wrong behind them. */
    void sweep('enquiries');

    // Deliberately no id, no echo of the submission: nothing for an attacker
    // to enumerate.
    return ok({ ok: true });
  });
}
