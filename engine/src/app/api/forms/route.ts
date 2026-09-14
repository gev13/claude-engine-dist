import { z } from 'zod';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { findForm } from '@/server/content/forms';
import { validateAnswers } from '@/lib/forms';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';
import { notifyFormSubmission } from '@/server/mail/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shape matches src/components/blocks/library/FormBlock.tsx. */
const envelope = z.object({
  formId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  /** The page the form sits on — a site path, nothing else. */
  source: z.string().max(300).regex(/^\/[^\s]*$/),
  answers: z.record(z.string(), z.unknown()),
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  website: z.string().max(200).optional(),
});

/**
 * A form block's answers (P3-E). Rate limited, with the same trap for bots
 * as the contact form, and checked against the form as it is saved on the
 * page it claims to come from — a script cannot invent questions, skip a
 * required one, or answer a choice with something that is not an option.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const limit = await rateLimit({ key: `form:${ip}`, limit: 10, windowSec: 3600, blockSec: 3600 });
    if (!limit.allowed) {
      return refuseRateLimited(ip, 'form submissions', limit.retryAfter, 'Too many forms sent from this connection. Try again later.');
    }

    let body: z.infer<typeof envelope>;
    try {
      body = envelope.parse(await request.json());
    } catch {
      return badRequest('Some fields need attention.');
    }

    // Silently accept and discard: telling a bot it was detected only helps it.
    if (body.website && body.website.trim() !== '') return ok({ ok: true });

    const form = await findForm(body.source, body.formId);
    if (!form) return badRequest('This form is no longer on the page. Reload it and try again.');

    const checked = validateAnswers(form.fields, body.answers);
    if (!checked.ok) return badRequest(checked.error);

    const [row] = await db
      .insert(formSubmissions)
      .values({ formId: body.formId, formName: form.formName, source: body.source, answers: checked.answers, ip })
      .returning({ id: formSubmissions.id });

    // What was asked is recorded, never what was answered: answers are personal data.
    await audit({
      action: 'form.submitted',
      targetType: 'submission',
      targetId: row?.id,
      summary: `New submission to “${form.formName}”`,
      metadata: { source: body.source },
      ip,
    });

    // The email says what arrived and where to read it; the answers stay here.
    notifyFormSubmission({ formName: form.formName, source: body.source, fields: checked.answers.length });

    return ok({ ok: true });
  });
}
