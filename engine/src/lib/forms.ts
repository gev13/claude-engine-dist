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

export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'number', 'textarea', 'select', 'radio', 'checkboxes', 'date', 'consent', 'step'] as const;
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
  })
  .refine((f) => !CHOICE_TYPES.includes(f.type) || f.options.length > 0, 'Give this question at least one option');

export type FormField = z.output<typeof formFieldSchema>;
export type Answer = { id: string; label: string; value: string | string[] | boolean };

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
export function validateAnswers(fields: FormField[], input: unknown): { ok: true; answers: Answer[] } | { ok: false; error: string } {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const answers: Answer[] = [];

  for (const field of fields) {
    if (field.type === 'step') continue;
    const value = raw[field.id];

    if (field.type === 'checkboxes') {
      const list = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
      if (list.some((v) => !field.options.includes(v))) return { ok: false, error: `${field.label}: pick from the options.` };
      if (field.required && list.length === 0) return { ok: false, error: `${field.label}: pick at least one.` };
      answers.push({ id: field.id, label: field.label, value: [...new Set(list)] });
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

/** An answer as one line of text, for the admin and the CSV export. */
export function answerText(value: Answer['value']): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return Array.isArray(value) ? value.join(', ') : value;
}
