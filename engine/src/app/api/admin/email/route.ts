import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { MAIL_SETTING_KEY, mailSettingsSchema, whyNotSending } from '@/lib/mail';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { getMailSettings, mailBrand, sendMail } from '@/server/mail/send';
import { testEmail } from '@/server/mail/templates';
import { isEncrypted, nextSecret } from '@/server/security/secrets';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Email settings (package 5).
 *
 * The password is the reason this is its own route rather than another key in
 * Settings: it is encrypted on the way in, never returned, and replaced only
 * when the editor types a new one. Everything else is ordinary.
 */

/** The stored row, or defaults when there is none. */
async function stored() {
  const [row] = await db.select().from(settings).where(eq(settings.key, MAIL_SETTING_KEY)).limit(1);
  const parsed = mailSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : mailSettingsSchema.parse({});
}

/** Everything the editor may see: the settings without the password, plus whether one is held. */
async function forEditor() {
  const { password, ...rest } = await stored();
  return { ...rest, passwordSet: isEncrypted(password) };
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'email:read');
    if (!guard.ok) return guard.response;
    const mail = await forEditor();
    return ok({ mail, problem: whyNotSending(await getMailSettings()) });
  });
}

/** `password` absent or left as the mask keeps what is stored; an empty string clears it. */
const saveSchema = z.object({
  mail: mailSettingsSchema.omit({ password: true }).extend({ password: z.string().max(400).optional() }),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'email:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, saveSchema);
    if (!parsed.ok) return parsed.response;
    const incoming = parsed.data.mail;

    const existing = await stored();
    const value = { ...incoming, password: nextSecret(incoming.password, existing.password) };

    await db
      .insert(settings)
      .values({ key: MAIL_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'email.settings.update',
      targetType: 'settings',
      targetId: MAIL_SETTING_KEY,
      summary: value.enabled ? `Email sending on via ${value.host || 'no server'}` : 'Email sending off',
      ip: clientIp(request.headers),
    });

    return ok({ mail: await forEditor(), problem: whyNotSending(await getMailSettings()) });
  });
}

const testSchema = z.object({ to: z.string().trim().email().max(255).optional() });

/** Send a test with whatever is saved, so a wrong password shows up here rather than in a missed enquiry. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'email:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, testSchema);
    if (!parsed.ok) return parsed.response;

    const mail = await getMailSettings();
    if (!mail.host || !mail.fromEmail) return badRequest('Set the server and the “from” address first, then save.');

    const to = parsed.data.to || guard.user.email;
    const brand = await mailBrand();
    const message = testEmail({ ...brand, by: guard.user.email, when: new Date().toUTCString() });

    // A test is deliberately sent even while sending is switched off — that is
    // how an administrator checks the settings before turning it on.
    const result = await sendMail({ ...message, to }, { ...mail, enabled: true });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'email.test',
      targetType: 'mail',
      targetId: to,
      summary: result.ok ? `Sent a test message to ${to}` : `Test message failed: ${result.error}`,
      ip: clientIp(request.headers),
    });

    if (!result.ok) return badRequest(result.error);
    return ok({ sent: true, to });
  });
}
