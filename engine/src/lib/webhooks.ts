import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Webhooks (T13, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   A submission handed to another system — a CRM, Zapier, Make — as signed
   JSON. Admin only, and deliberately not a form-block option: the server
   fetches whatever address is saved here, so an address is a door into the
   network the server sits in, and only an administrator may open one. The
   sender refuses private and local addresses whoever saved them.

   One `webhooks` settings row. The signing secret is encrypted at rest like
   the SMTP password and never sent back to the browser.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WEBHOOKS_SETTING_KEY = 'webhooks';

export const WEBHOOK_EVENTS = ['form.submitted', 'enquiry.received'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'form.submitted': 'A form block was sent',
  'enquiry.received': 'The contact form was sent',
};

/** An https address with a real host name or a public IP; the sender checks where it resolves to. */
export const WEBHOOK_URL = /^https:\/\/[A-Za-z0-9.-]+(:\d{2,5})?(\/[^\s]*)?$/;

export const webhookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Give it a name').max(80),
  enabled: z.boolean().default(true),
  url: z.string().trim().max(500).regex(WEBHOOK_URL, 'An https:// address'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Choose at least one event').default(['form.submitted']),
  /** Form names; empty means every form. Only read for `form.submitted`. */
  forms: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  /** Encrypted at rest (`enc.v1:…`); the browser only ever sees a mask. */
  secret: z.string().max(400).default(''),
});

export type Webhook = z.output<typeof webhookSchema>;

export const webhooksSettingsSchema = z.object({
  hooks: z.array(webhookSchema).max(10).default([]),
});

export type WebhooksSettings = z.output<typeof webhooksSettingsSchema>;

export function resolveWebhooks(stored: unknown): WebhooksSettings {
  const parsed = webhooksSettingsSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : webhooksSettingsSchema.parse({});
}

/** The hooks that want this event, for this form. */
export function hooksFor(settings: WebhooksSettings, event: WebhookEvent, formName?: string): Webhook[] {
  return settings.hooks.filter(
    (hook) =>
      hook.enabled &&
      hook.events.includes(event) &&
      (event !== 'form.submitted' || hook.forms.length === 0 || (formName !== undefined && hook.forms.includes(formName))),
  );
}

/** The headers a receiver checks. Documented in docs/forms.md. */
export const SIGNATURE_HEADER = 'x-engine-signature';
export const TIMESTAMP_HEADER = 'x-engine-timestamp';
export const EVENT_HEADER = 'x-engine-event';
export const DELIVERY_HEADER = 'x-engine-delivery';

/** Seconds between attempts: at once, then 10 s, then a minute. */
export const RETRY_DELAYS = [0, 10, 60] as const;
