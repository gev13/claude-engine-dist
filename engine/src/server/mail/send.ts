import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { eq } from 'drizzle-orm';
import { MAIL_DEFAULTS, MAIL_SETTING_KEY, type MailSettings, canSend, mailSettingsSchema } from '@/lib/mail';
import { SITE_URL } from '@/lib/env';
import { getSiteSettings } from '@/server/content/siteSettings';
import { audit } from '@/server/auth/audit';
import { decryptSecret } from '@/server/security/secrets';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';
import type { Brand, Message } from './templates';

/* ═══════════════════════════════════════════════════════════════════════════
   Sending (package 5)
   ───────────────────────────────────────────────────────────────────────────
   One place that knows how to reach the mail server. Two rules hold
   everywhere:

     · Nothing that matters waits on mail. `sendMail` never throws; it reports
       whether the message left, and callers carry on either way — an enquiry
       is stored whether or not its notification is delivered.
     · The password never leaves the server. It is decrypted here, used, and
       not returned.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

/** The stored settings, with the password decrypted for use. */
export async function getMailSettings(): Promise<MailSettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, MAIL_SETTING_KEY)).limit(1);
    if (!row) return MAIL_DEFAULTS;
    const parsed = mailSettingsSchema.safeParse(row.value);
    if (!parsed.success) return MAIL_DEFAULTS;
    return { ...parsed.data, password: decryptSecret(parsed.data.password) ?? '' };
  } catch {
    return MAIL_DEFAULTS;
  }
}

/** The name and address the site sends from, and where replies should go. */
function envelopeFrom(mail: MailSettings): string {
  return mail.fromName ? `"${mail.fromName.replace(/"/g, '')}" <${mail.fromEmail}>` : mail.fromEmail;
}

function transportFor(mail: MailSettings): Transporter {
  return nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    ...(mail.user ? { auth: { user: mail.user, pass: mail.password } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Brand values for the templates, from the site's own settings. */
export async function mailBrand(): Promise<Brand> {
  const site = await getSiteSettings().catch(() => null);
  return { siteName: site?.name || 'This site', siteUrl: SITE_URL };
}

/**
 * Send one message. Returns a result rather than throwing: a caller in the
 * middle of storing an enquiry must not fail because a relay is down.
 */
export async function sendMail(
  message: Message & { to: string | string[]; replyTo?: string },
  preloaded?: MailSettings,
): Promise<SendResult> {
  const mail = preloaded ?? (await getMailSettings());
  if (!canSend(mail)) return { ok: false, error: 'Email is not configured.' };

  const to = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
  if (to.length === 0) return { ok: false, error: 'No recipient.' };

  try {
    const info = await transportFor(mail).sendMail({
      from: envelopeFrom(mail),
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo || mail.replyTo ? { replyTo: message.replyTo || mail.replyTo } : {}),
    });
    return { ok: true, messageId: String(info.messageId ?? '') };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The mail server refused the message.';
    console.error('[mail] send failed', reason);
    return { ok: false, error: reason };
  }
}

/**
 * Who receives admin notifications: the addresses on the email settings, or
 * the site's contact address when none are listed.
 */
export async function notifyRecipients(mail: MailSettings): Promise<string[]> {
  if (mail.notifyEmails.length > 0) return mail.notifyEmails;
  const site = await getSiteSettings().catch(() => null);
  const contact = site?.contactEmail?.trim();
  return contact ? [contact] : [];
}

/**
 * Fire a notification without making the caller wait or care. Used by the
 * public endpoints, where the visitor's request must not slow down or fail
 * because of mail.
 */
export function sendInBackground(build: () => Promise<{ message: Message & { to: string | string[]; replyTo?: string }; event: string } | null>): void {
  void (async () => {
    try {
      const prepared = await build();
      if (!prepared) return;
      const result = await sendMail(prepared.message);
      if (!result.ok) {
        await audit({
          action: 'mail.failed',
          targetType: 'mail',
          targetId: prepared.event,
          summary: `Could not send the ${prepared.event} email: ${result.error}`,
        });
      }
    } catch (error) {
      console.error('[mail] background send failed', error);
    }
  })();
}
