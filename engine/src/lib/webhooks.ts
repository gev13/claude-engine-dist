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

/* ── Custom request headers (3.31) ────────────────────────────────────────
   A receiver's own auth header — `X-API-Key`, `Authorization` — sent with
   every delivery. The value is a credential, so it is encrypted at rest and
   masked like the signing secret; the name is not secret and is shown. */

export const MAX_WEBHOOK_HEADERS = 5;
/** `SECRET_MASK` (server/security/secrets.ts), which this shared file cannot import: "keep what is stored". */
export const VALUE_MASK = '••••••••';
export const HEADER_VALUE_MAX = 1000;

/** RFC 9110 `token`: what a header name may be made of. */
export const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;
/** Visible ASCII, spaces and tabs: no CR or LF (header injection), nothing Node would refuse to send. */
export const HEADER_VALUE = /^[\t\x20-\x7e]*$/;

/**
 * Names the sender sets itself. A custom value would either be ignored,
 * contradict the body (`content-length`, `transfer-encoding`), or pose as
 * the engine (`x-engine-*`, which a receiver may trust for the signature).
 */
const RESERVED_HEADERS = new Set(['host', 'content-type', 'content-length', 'transfer-encoding', 'connection']);

export function reservedHeader(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.startsWith('x-engine-') || RESERVED_HEADERS.has(lower);
}

export const webhookHeaderSchema = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .trim()
    .regex(HEADER_NAME, 'A header name: letters, digits and - only, no spaces')
    .refine((name) => !reservedHeader(name), 'The engine sets that header itself'),
  /**
   * Encrypted at rest (`enc.v1:…`), the mask in the browser, or — only on its
   * way in — the plain value somebody typed. The ciphertext is longer than
   * the plain cap, so the cap is checked on plain values only.
   */
  value: z
    .string()
    .max(2000)
    .refine((value) => value === VALUE_MASK || HEADER_VALUE.test(value), 'No line breaks or special characters in a header value')
    .refine((value) => value.startsWith('enc.v1:') || value.length <= HEADER_VALUE_MAX, `At most ${HEADER_VALUE_MAX} characters`),
});

export type WebhookHeader = z.output<typeof webhookHeaderSchema>;

/* ── The body (3.31) ──────────────────────────────────────────────────────
   `envelope` is what every hook sent before: `{ id, event, createdAt, site,
   data }`. `custom` is a flat object of the receiver's own field names, each
   filled from a template — literal text with `{{field}}` placeholders — so
   several of the event's fields can be combined into one. */

export const WEBHOOK_BODY_MODES = ['envelope', 'custom'] as const;
export type WebhookBodyMode = (typeof WEBHOOK_BODY_MODES)[number];
export const MAX_BODY_FIELDS = 20;
export const TEMPLATE_MAX = 2000;

export const webhookBodyFieldSchema = z.object({
  /** The receiver's field name. Any printable text — it is a JSON key, escaped as one. */
  name: z
    .string()
    .trim()
    .min(1, 'Name the field')
    .max(64)
    .regex(/^[^\x00-\x1f\x7f]+$/, 'No line breaks in a field name'),
  template: z.string().max(TEMPLATE_MAX).default(''),
});

export type WebhookBodyField = z.output<typeof webhookBodyFieldSchema>;

export const webhookBodySchema = z
  .object({
    mode: z.enum(WEBHOOK_BODY_MODES).default('envelope'),
    fields: z.array(webhookBodyFieldSchema).max(MAX_BODY_FIELDS).default([]),
  })
  .superRefine((body, ctx) => {
    if (body.mode !== 'custom') return;
    if (body.fields.length === 0) ctx.addIssue({ code: 'custom', path: ['fields'], message: 'A custom body needs at least one field' });
    const seen = new Set<string>();
    body.fields.forEach((field, index) => {
      if (seen.has(field.name)) ctx.addIssue({ code: 'custom', path: ['fields', index, 'name'], message: `“${field.name}” is used twice` });
      seen.add(field.name);
    });
  });

export type WebhookBody = z.output<typeof webhookBodySchema>;

export const webhookSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, 'Give it a name').max(80),
    enabled: z.boolean().default(true),
    url: z.string().trim().max(500).regex(WEBHOOK_URL, 'An https:// address'),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Choose at least one event').default(['form.submitted']),
    /** Form names; empty means every form. Only read for `form.submitted`. */
    forms: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
    /** Encrypted at rest (`enc.v1:…`); the browser only ever sees a mask. Empty sends no signature. */
    secret: z.string().max(400).default(''),
    headers: z.array(webhookHeaderSchema).max(MAX_WEBHOOK_HEADERS, `At most ${MAX_WEBHOOK_HEADERS} headers`).default([]),
    body: webhookBodySchema.default({ mode: 'envelope', fields: [] }),
  })
  .superRefine((hook, ctx) => {
    const seen = new Set<string>();
    hook.headers.forEach((header, index) => {
      const lower = header.name.toLowerCase();
      if (seen.has(lower)) ctx.addIssue({ code: 'custom', path: ['headers', index, 'name'], message: `${header.name} is set twice` });
      seen.add(lower);
    });
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

/** How much of a refusing receiver's answer the delivery log keeps. */
export const RESPONSE_SNIPPET_MAX = 500;

/* ── Templates (3.31) ─────────────────────────────────────────────────────
   Pure, so the server renders a delivery and the screen previews one with
   the same code. */

export type WebhookFieldInfo = { key: string; hint: string };

/**
 * What a template can name, per event: the keys `enquiryPayload()` and
 * `submissionPayload()` return. Kept beside them by `tests/webhookBody.test.ts`.
 */
export const WEBHOOK_FIELDS: Record<WebhookEvent, WebhookFieldInfo[]> = {
  'enquiry.received': [
    { key: 'name', hint: 'their name' },
    { key: 'email', hint: 'their email address' },
    { key: 'company', hint: 'company' },
    { key: 'role', hint: 'their role' },
    { key: 'businessType', hint: 'type of business' },
    { key: 'services', hint: 'services chosen, joined with commas' },
    { key: 'timing', hint: 'timing' },
    { key: 'message', hint: 'the message' },
    { key: 'receivedAt', hint: 'when, as an ISO date' },
    { key: 'enquiryId', hint: 'the enquiry’s id' },
  ],
  'form.submitted': [
    { key: 'answers.<field id>', hint: 'one answer, by the field’s id in the form block' },
    { key: 'answers', hint: 'every answer, one “Label: value” per line' },
    { key: 'hidden.<name>', hint: 'one hidden value, e.g. hidden.utm_source' },
    { key: 'hidden', hint: 'every hidden value, one per line' },
    { key: 'formName', hint: 'the form’s name' },
    { key: 'page', hint: 'the page it was sent from' },
    { key: 'receivedAt', hint: 'when, as an ISO date' },
    { key: 'formId', hint: 'the form block’s id' },
    { key: 'submissionId', hint: 'the submission’s id' },
  ],
};

/** `{{ field }}` or `{{ answers.email }}`; anything else between braces is left as typed. */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z0-9_-]+))?\s*\}\}/g;

const KNOWN_PREFIXES: Partial<Record<WebhookEvent, string[]>> = { 'form.submitted': ['answers', 'hidden'] };

/** Whether a placeholder means something for at least one of these events. */
function knownPlaceholder(events: readonly WebhookEvent[], key: string, sub: string | undefined): boolean {
  return events.some((event) =>
    sub === undefined ? WEBHOOK_FIELDS[event].some((field) => field.key === key) : (KNOWN_PREFIXES[event] ?? []).includes(key),
  );
}

/**
 * What is wrong with a custom body, field by field — placeholders that the
 * hook's events do not carry. Checked when saving rather than in the schema,
 * so a stored hook still loads if a later version renames a field.
 */
export function templateProblems(hook: Pick<Webhook, 'events' | 'body'>): string[] {
  if (hook.body.mode !== 'custom') return [];
  const problems: string[] = [];
  for (const field of hook.body.fields) {
    for (const match of field.template.matchAll(PLACEHOLDER)) {
      if (!knownPlaceholder(hook.events, match[1]!, match[2])) {
        problems.push(`“${field.name}”: {{${match[2] ? `${match[1]}.${match[2]}` : match[1]}}} is not a field of the chosen event`);
      }
    }
  }
  return problems;
}

type AnswerLike = { id?: unknown; label?: unknown; value?: unknown; file?: { name?: unknown } };

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function answerText(answer: AnswerLike): string {
  return answer.file ? text(answer.file.name) : text(answer.value);
}

function resolve(data: Record<string, unknown>, key: string, sub: string | undefined): string {
  const value = data[key];
  if (key === 'answers' && Array.isArray(value)) {
    const answers = value as AnswerLike[];
    if (sub !== undefined) return answerText(answers.find((answer) => answer.id === sub) ?? {});
    return answers.map((answer) => `${text(answer.label)}: ${answerText(answer)}`).join('\n');
  }
  if (sub !== undefined) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, sub) ? text((value as Record<string, unknown>)[sub]) : '';
  }
  if (key === 'hidden' && value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).map(([name, v]) => `${name}: ${text(v)}`).join('\n');
  }
  return Object.hasOwn(data, key) ? text(value) : '';
}

/** One template filled in. A field the event does not carry becomes empty text. */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_, key: string, sub: string | undefined) => resolve(data, key, sub));
}

/**
 * The flat body a custom hook sends. Every value is text. Built with
 * `Object.fromEntries`, so a field called `__proto__` is a field and not a
 * prototype.
 */
export function renderCustomBody(fields: readonly WebhookBodyField[], data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.name, renderTemplate(field.template, data)]));
}

/**
 * Stand-in values for the screen's preview and for Send a test, so a
 * receiver that checks its fields gets something shaped like the real thing.
 * Obviously not a person.
 */
export const SAMPLE_DATA: Record<WebhookEvent, Record<string, unknown>> = {
  'enquiry.received': {
    enquiryId: '00000000-0000-4000-8000-000000000000',
    name: 'Test Sender',
    email: 'test@example.com',
    company: 'Example Ltd',
    role: 'Manager',
    businessType: 'Agency',
    services: ['Design', 'Development'],
    timing: 'Within a month',
    message: 'A test from the Webhooks screen — not a real enquiry.',
    receivedAt: '2026-01-01T09:00:00.000Z',
  },
  'form.submitted': {
    submissionId: '00000000-0000-4000-8000-000000000000',
    formId: 'form',
    formName: 'Example form',
    page: '/contact',
    receivedAt: '2026-01-01T09:00:00.000Z',
    answers: [
      { id: 'name', label: 'Name', value: 'Test Sender' },
      { id: 'email', label: 'Email', value: 'test@example.com' },
      { id: 'message', label: 'Message', value: 'A test from the Webhooks screen — not a real submission.' },
    ],
    hidden: { utm_source: 'test' },
  },
};
