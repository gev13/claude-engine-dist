import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Email settings (package 5)
   ───────────────────────────────────────────────────────────────────────────
   One settings row holds everything needed to send: where the server is, who
   the mail comes from, who is told about what. The password is stored
   encrypted (see server/security/secrets.ts) and never returned to the
   browser, so this shape carries it only on the way in.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MAIL_SETTING_KEY = 'mail';

const trimmed = (max: number) => z.string().trim().max(max);

/** Which automatic messages are sent. Security alerts are on by default. */
export const mailEventsSchema = z.object({
  enquiry: z.boolean().default(true),
  formSubmission: z.boolean().default(true),
  newsletter: z.boolean().default(false),
  security: z.boolean().default(true),
  /** A newer engine is available (package 6). One message per version. */
  engineUpdate: z.boolean().default(true),
});

export const mailSettingsSchema = z.object({
  /** Nothing is sent while this is off, whatever else is filled in. */
  enabled: z.boolean().default(false),
  host: trimmed(200).default(''),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  /** True for implicit TLS (port 465); false starts plain and upgrades with STARTTLS. */
  secure: z.boolean().default(false),
  user: trimmed(200).default(''),
  /** Write-only: the API accepts a new password and returns a mask. */
  password: z.string().max(400).default(''),
  fromName: trimmed(120).default(''),
  fromEmail: trimmed(255).default(''),
  replyTo: trimmed(255).default(''),
  /** Who receives admin notifications; empty falls back to the site contact address. */
  notifyEmails: z.array(z.string().trim().email().max(255)).max(5).default([]),
  events: mailEventsSchema.default({ enquiry: true, formSubmission: true, newsletter: false, security: true, engineUpdate: true }),
});

export type MailSettings = z.output<typeof mailSettingsSchema>;
export type MailEvents = z.output<typeof mailEventsSchema>;

/** What the editor is given: everything but the password. */
export type MailSettingsForEditor = Omit<MailSettings, 'password'> & { passwordSet: boolean };

export const MAIL_DEFAULTS: MailSettings = mailSettingsSchema.parse({});

/**
 * Whether the settings are complete enough to send. A server and a from
 * address are the minimum; authentication is optional, since a local relay
 * often needs none.
 */
export function canSend(settings: MailSettings): boolean {
  return settings.enabled && settings.host.length > 0 && settings.fromEmail.length > 0;
}

/** A one-line reason the email screen can show when sending is not possible. */
export function whyNotSending(settings: MailSettings): string | null {
  if (!settings.enabled) return 'Sending is switched off.';
  if (!settings.host) return 'No SMTP server is set.';
  if (!settings.fromEmail) return 'No “from” address is set.';
  return null;
}

/** The messages the engine sends by itself. */
export const MAIL_TEMPLATES = ['welcome', 'passwordReset', 'securityAlert', 'notification', 'test'] as const;
export type MailTemplate = (typeof MAIL_TEMPLATES)[number];

export const MAIL_TEMPLATE_LABELS: Record<MailTemplate, string> = {
  welcome: 'Welcome — a new account was created',
  passwordReset: 'Password reset link',
  securityAlert: 'Security alert',
  notification: 'Notification of a new enquiry or form submission',
  test: 'Test message',
};
