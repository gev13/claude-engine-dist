import { z } from 'zod';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { db } from '@/server/db';
import { newsletterSubscribers } from '@/server/db/schema';
import { notifyNewsletter } from '@/server/mail/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shape matches src/components/blocks/library/Newsletter.tsx exactly. */
const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(255),
  consent: z.boolean().optional(),
  /** The page the form sits on — a site path, nothing else. */
  source: z
    .string()
    .max(300)
    .regex(/^\/[^\s]*$/, 'Sign up from a page on this site.')
    .optional(),
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const limit = await rateLimit({ key: `newsletter:${ip}`, limit: 5, windowSec: 3600, blockSec: 3600 });
    if (!limit.allowed) {
      return refuseRateLimited(ip, 'newsletter sign-ups', limit.retryAfter, 'Too many sign-ups from this connection. Try again later.');
    }

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch (error) {
      const message =
        error instanceof z.ZodError ? (error.issues[0]?.message ?? 'Check the email address.') : 'Check the email address.';
      return badRequest(message);
    }

    // Silently accept and discard: telling a bot it was detected only helps it.
    if (body.website && body.website.trim() !== '') {
      return ok({ ok: true });
    }

    const [row] = await db
      .insert(newsletterSubscribers)
      .values({
        email: body.email.toLowerCase(),
        source: body.source ?? '',
        consentAt: body.consent ? new Date() : null,
        ip,
      })
      .onConflictDoNothing({ target: newsletterSubscribers.email })
      .returning({ id: newsletterSubscribers.id });

    if (row) {
      await audit({
        action: 'newsletter.subscribed',
        targetType: 'subscriber',
        targetId: row.id,
        summary: 'New newsletter sign-up',
        metadata: { source: body.source ?? '' },
        ip,
      });
    }

    // Only a genuinely new subscriber is worth a notification.
    if (row) notifyNewsletter({ email: body.email.toLowerCase(), source: body.source ?? '' });

    // The same answer whether or not the address was already on the list, so
    // the form cannot be used to find out who has signed up.
    return ok({ ok: true });
  });
}
