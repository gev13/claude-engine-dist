import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Form builder (package 3, phase E)
   ───────────────────────────────────────────────────────────────────────────
   The fields a form block can have, and the one function that checks a set
   of answers against them. It runs in the browser (step by step, before
   anything is sent) and again on the server against the form as it is saved
   on the page — so a visitor, or a script, can only send answers to the
   questions the form actually asks.
   ═══════════════════════════════════════════════════════════════════════════ */

export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'number', 'textarea', 'select', 'radio', 'checkboxes', 'date', 'file', 'consent', 'step'] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_LABELS: Record<FormFieldType, string> = {
  text: 'Short text',
  email: 'Email address',
  phone: 'Phone number',
  number: 'Number',
  textarea: 'Long text',
  select: 'Drop-down',
  radio: 'One choice',
  checkboxes: 'Several choices',
  date: 'Date',
  file: 'File upload',
  consent: 'Tick box (consent)',
  step: 'New step',
};

const CHOICE_TYPES: FormFieldType[] = ['select', 'radio', 'checkboxes'];

export const formFieldSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    type: z.enum(FORM_FIELD_TYPES),
    /** The question — or, for a step, the step's title. */
    label: z.string().trim().min(1).max(160),
    required: z.boolean().default(false),
    placeholder: z.string().max(120).optional(),
    help: z.string().max(200).optional(),
    options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    width: z.enum(['full', 'half']).default('full'),
    /**
     * 2.16 — show this question only when another one has a given answer:
     * "Company size" only when "I am asking for" is "A business". A hidden
     * question is neither asked nor checked, on either side.
     */
    showIf: z
      .object({ field: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), equals: z.string().trim().max(80) })
      .optional(),
  })
  .refine((f) => !CHOICE_TYPES.includes(f.type) || f.options.length > 0, 'Give this question at least one option');

/* ── After a form is sent (T13, 2.16) ─────────────────────────────────────── */

const email = z.string().trim().toLowerCase().email().max(254);
const fieldRef = z.string().regex(/^(|[A-Za-z0-9_-]{1,40})$/).default('');

/**
 * Who hears about a submission. With no recipients it goes to the site's own
 * notification list, as before 2.16. `includeAnswers` puts every answer in the
 * email as a table — useful, and it means the answers sit in an inbox as well
 * as here, so it is off unless chosen.
 */
export const formNotifySchema = z.object({
  recipients: z.array(email).max(10).default([]),
  includeAnswers: z.boolean().default(false),
  /** `{formName}` and `{field:id}` are filled in. Empty is the subject every form had before 2.16. */
  subject: z.string().trim().max(200).default(''),
  /** The email question whose answer becomes Reply-To, so answering the email answers the visitor. */
  replyToField: fieldRef,
  /** The page, the date, the campaign and the hidden fields, under the answers. */
  includeMeta: z.boolean().default(true),
  /** The visitor's address, abbreviated. Off: it is personal data, and rarely needed. */
  includeIp: z.boolean().default(false),
});

/** A reply to the person who sent the form, to the address they gave. */
export const formAutoresponderSchema = z.object({
  enabled: z.boolean().default(false),
  emailField: fieldRef,
  subject: z.string().trim().max(200).default(''),
  /** Plain text; `{field:id}` and `{formName}` are filled in. Blank lines are paragraphs. */
  body: z.string().max(6000).default(''),
});

/** Letters, digits, `_` and `-`: what an event name or a goal id may be. */
const tag = z.string().trim().regex(/^(|[A-Za-z0-9_-]{1,60})$/, 'Letters, digits, _ and - only').default('');

export const formAfterSchema = z.object({
  /** A page to go to — a thank-you page, for an advertising conversion. Empty stays on the form. */
  redirect: z
    .string()
    .trim()
    .max(300)
    // Not `//host`: that is protocol-relative, another site, and an open redirect.
    .regex(/^(|\/(?!\/)[A-Za-z0-9._~\-/%?=&#]*)$/, 'A site path such as /thank-you')
    .default(''),
  /** Send the conversion to every tag that is switched on (Integrations). */
  track: z.boolean().default(true),
  event: tag.default('generate_lead'),
  /** The name of a Google Ads conversion from Integrations. */
  adsConversion: z.string().trim().max(60).default(''),
  yandexGoal: tag,
  linkedinConversion: z.string().trim().regex(/^(|[0-9]{3,12})$/, 'A conversion id — digits').default(''),
});

export const HIDDEN_SOURCES = [
  'static',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'referrer',
  'landingPage',
  'pageUrl',
  'gclid',
  'fbclid',
] as const;
export type HiddenSource = (typeof HIDDEN_SOURCES)[number];

export const HIDDEN_SOURCE_LABELS: Record<HiddenSource, string> = {
  static: 'A fixed value',
  utm_source: 'Campaign source (utm_source)',
  utm_medium: 'Campaign medium (utm_medium)',
  utm_campaign: 'Campaign name (utm_campaign)',
  utm_term: 'Campaign term (utm_term)',
  utm_content: 'Campaign content (utm_content)',
  referrer: 'Where they came from (referrer)',
  landingPage: 'The first page they landed on',
  pageUrl: 'This page',
  gclid: 'Google Ads click id (gclid)',
  fbclid: 'Meta click id (fbclid)',
};

export const formHiddenSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Letters, digits, _ and - only'),
  source: z.enum(HIDDEN_SOURCES).default('static'),
  /** For `static`. */
  value: z.string().trim().max(200).default(''),
});

export type FormHidden = z.output<typeof formHiddenSchema>;

/**
 * The hidden values a submission may carry: only the names the form defines,
 * each capped, a static one always its saved value — so a script cannot add
 * fields, and cannot change a fixed one.
 */
export function readHiddenValues(defined: FormHidden[], sent: unknown): Record<string, string> {
  const raw = sent && typeof sent === 'object' && !Array.isArray(sent) ? (sent as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const field of defined) {
    if (field.source === 'static') {
      if (field.value) out[field.name] = field.value;
      continue;
    }
    const value = raw[field.name];
    if (typeof value === 'string' && value.trim()) out[field.name] = value.trim().slice(0, 500);
  }
  return out;
}

/** Fill `{formName}` and `{field:id}` in a subject or a reply — answers as plain text. */
export function fillTemplate(template: string, formName: string, answers: Answer[]): string {
  return template
    .replace(/\{formName\}/g, formName)
    .replace(/\{field:([A-Za-z0-9_-]{1,40})\}/g, (_, id: string) => {
      const answer = answers.find((a) => a.id === id);
      return answer ? answerText(answer.value) : '';
    });
}

/**
 * The questions currently asked: a question whose `showIf` does not hold is
 * left out — of the page, of the checks, of the answers. Evaluated in order,
 * so a question depending on a hidden one is hidden too.
 */
export function visibleFields(fields: FormField[], values: Record<string, unknown>): FormField[] {
  const shown = new Set<string>();
  const out: FormField[] = [];
  for (const field of fields) {
    if (field.showIf) {
      const value = values[field.showIf.field];
      const matches = Array.isArray(value) ? value.includes(field.showIf.equals) : typeof value === 'boolean' ? String(value) === field.showIf.equals : value === field.showIf.equals;
      if (!shown.has(field.showIf.field) || !matches) continue;
    }
    shown.add(field.id);
    out.push(field);
  }
  return out;
}

export type FormField = z.output<typeof formFieldSchema>;
/**
 * A file that came with a submission.
 *
 * `name` is the generated name on disk and the only thing that ever reaches
 * the filesystem; `originalName` is what the visitor called it and is display
 * only. The same split as a CV, for the same reason.
 */
export type AnswerFile = { name: string; originalName: string; bytes: number };

export type Answer = {
  id: string;
  label: string;
  value: string | string[] | boolean;
  /** Present only on a `file` answer. */
  file?: AnswerFile;
};

/** The fields between step markers; a form with no markers is one step. */
export function formSteps(fields: FormField[]): { title?: string; fields: FormField[] }[] {
  const steps: { title?: string; fields: FormField[] }[] = [];
  for (const field of fields) {
    if (field.type === 'step') steps.push({ title: field.label, fields: [] });
    else {
      if (steps.length === 0) steps.push({ fields: [] });
      steps[steps.length - 1]!.fields.push(field);
    }
  }
  return steps.filter((step) => step.fields.length > 0);
}

const LIMIT: Partial<Record<FormFieldType, number>> = { email: 255, phone: 40, number: 40, date: 10, textarea: 8000, text: 500, select: 80, radio: 80 };

const CHECK: Partial<Record<FormFieldType, (value: string, field: FormField) => string | null>> = {
  email: (v, f) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : `${f.label}: enter a valid email address.`),
  phone: (v, f) => (/^\+?[0-9 ()./-]{5,40}$/.test(v) && /\d{5,}/.test(v.replace(/\D/g, '')) ? null : `${f.label}: enter a phone number.`),
  number: (v, f) => (/^-?\d+(?:[.,]\d+)?$/.test(v) ? null : `${f.label}: enter a number.`),
  date: (v, f) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : `${f.label}: pick a date.`),
  select: (v, f) => (f.options.includes(v) ? null : `${f.label}: pick one of the options.`),
  radio: (v, f) => (f.options.includes(v) ? null : `${f.label}: pick one of the options.`),
};

/**
 * Check answers against the fields. Answers to questions the form does not
 * ask are dropped; the result keeps each question's label beside its answer,
 * in the order the form asks them.
 */
export function validateAnswers(
  fields: FormField[],
  input: unknown,
  /** The whole form, when `fields` is one step of it: a condition can point at an earlier step. */
  form: FormField[] = fields,
): { ok: true; answers: Answer[] } | { ok: false; error: string } {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const answers: Answer[] = [];

  // A question hidden by its condition is not asked, so it is neither required nor answered (2.16).
  const shown = new Set(visibleFields(form, raw).map((field) => field.id));
  for (const field of fields) {
    if (!shown.has(field.id)) continue;
    if (field.type === 'step') continue;
    const value = raw[field.id];

    if (field.type === 'checkboxes') {
      const list = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
      if (list.some((v) => !field.options.includes(v))) return { ok: false, error: `${field.label}: pick from the options.` };
      if (field.required && list.length === 0) return { ok: false, error: `${field.label}: pick at least one.` };
      answers.push({ id: field.id, label: field.label, value: [...new Set(list)] });
      continue;
    }

    /* A file lives in the multipart body, not in the answers, so the only
       thing this function can check is whether one came: the caller passes
       `true` for a field that has a file. The server replaces the answer
       afterwards with the stored name — it is the only side with the bytes. */
    if (field.type === 'file') {
      const attached = value === true;
      if (field.required && !attached) return { ok: false, error: `${field.label}: attach a file.` };
      answers.push({ id: field.id, label: field.label, value: '' });
      continue;
    }

    if (field.type === 'consent') {
      const checked = value === true;
      if (field.required && !checked) return { ok: false, error: `Tick the box to continue: ${field.label}` };
      answers.push({ id: field.id, label: field.label, value: checked });
      continue;
    }

    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) {
      if (field.required) return { ok: false, error: `${field.label} is required.` };
      answers.push({ id: field.id, label: field.label, value: '' });
      continue;
    }
    if (text.length > (LIMIT[field.type] ?? 500)) return { ok: false, error: `${field.label} is too long.` };
    const problem = CHECK[field.type]?.(text, field);
    if (problem) return { ok: false, error: problem };
    answers.push({ id: field.id, label: field.label, value: text });
  }

  return { ok: true, answers };
}

/** The answer to `fieldId` when it is an email address — for Reply-To and the autoresponder. */
export function emailAnswer(answers: Answer[], fieldId: string): string | null {
  if (!fieldId) return null;
  const value = answers.find((answer) => answer.id === fieldId)?.value;
  return typeof value === 'string' && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(value) && value.length <= 254 ? value : null;
}

/** An answer as one line of text, for the admin and the CSV export. */
export function answerText(value: Answer['value']): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * One line for an answer, including a file's own name.
 *
 * The export and the inbox both want "photo.jpg", not the uuid the file is
 * stored under — and a submission whose file has been erased should say so
 * rather than show an empty cell.
 */
export function answerLine(answer: Answer): string {
  if (answer.file) return `${answer.file.originalName} (${Math.max(1, Math.round(answer.file.bytes / 1024))} KB)`;
  return answerText(answer.value);
}
