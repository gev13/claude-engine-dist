import { z } from 'zod';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { findForm } from '@/server/content/forms';
import { validateAnswers } from '@/lib/forms';
import {
  ATTACHMENT_KINDS,
  ApplicationFileError,
  deleteStoredFile,
  saveVisitorFile,
} from '@/server/applications/storage';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';
import { notifyFormSubmission } from '@/server/mail/notify';
import { sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** However many questions a form asks, it may not carry more files than this. */
const MAX_FILES = 10;

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

    /* Two shapes on one endpoint: JSON as before, and multipart when the form
       has a file field. The content type decides, and a form with no files
       keeps the cheaper path — nothing has to buffer a body to find out. */
    const multipart = (request.headers.get('content-type') ?? '').includes('multipart/form-data');

    let body: z.infer<typeof envelope>;
    let uploads = new Map<string, File>();

    if (multipart) {
      let sent: FormData;
      try {
        sent = await request.formData();
      } catch {
        return badRequest('That form could not be read. Reload the page and try again.');
      }

      try {
        body = envelope.parse({
          formId: sent.get('formId') ?? '',
          source: sent.get('source') ?? '',
          answers: JSON.parse(String(sent.get('answers') ?? '{}')),
          website: sent.get('website') ?? '',
        });
      } catch {
        return badRequest('Some fields need attention.');
      }

      for (const [key, value] of sent.entries()) {
        if (key.startsWith('file:') && value instanceof File && value.size > 0) {
          uploads.set(key.slice(5), value);
        }
      }
      // A cap on count as well as on size: ten questions, ten files, no more.
      if (uploads.size > MAX_FILES) return badRequest('That is more files than this form accepts.');
    } else {
      try {
        body = envelope.parse(await request.json());
      } catch {
        return badRequest('Some fields need attention.');
      }
    }

    // Silently accept and discard: telling a bot it was detected only helps it.
    if (body.website && body.website.trim() !== '') return ok({ ok: true });

    const form = await findForm(body.source, body.formId);
    if (!form) return badRequest('This form is no longer on the page. Reload it and try again.');

    /* The form as saved decides which fields may carry a file, so a script
       cannot attach one to a question that never asked for it — the same rule
       that stops it inventing questions. Files for anything else are dropped
       before a single byte is written. */
    const fileFieldIds = new Set(form.fields.filter((f) => f.type === 'file').map((f) => f.id));
    uploads = new Map([...uploads].filter(([id]) => fileFieldIds.has(id)));

    const answered = { ...body.answers } as Record<string, unknown>;
    for (const id of fileFieldIds) answered[id] = uploads.has(id);

    const checked = validateAnswers(form.fields, answered);
    if (!checked.ok) return badRequest(checked.error);

    /* Stored only once every answer has passed. A form that is going to be
       rejected must not leave files behind on the way. */
    const stored: string[] = [];
    try {
      for (const answer of checked.answers) {
        const file = uploads.get(answer.id);
        if (!file) continue;
        const saved = await saveVisitorFile(file, ATTACHMENT_KINDS);
        stored.push(saved.filename);
        answer.value = saved.originalName;
        answer.file = { name: saved.filename, originalName: saved.originalName, bytes: saved.bytes };
      }
    } catch (caught) {
      // Whatever was written before the bad one goes with it.
      for (const name of stored) await deleteStoredFile(name);
      if (caught instanceof ApplicationFileError) return badRequest(caught.message);
      throw caught;
    }

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

    /* The retention sweep, throttled and never thrown: the engine has no
       scheduler, so the honest trigger is the traffic the site already has —
       and somebody filling in a form must never see a failure because a
       tidy-up went wrong behind them. */
    void sweep('submissions');

    return ok({ ok: true });
  });
}
