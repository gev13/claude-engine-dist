import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { type FormField, answerLine, answerText, formFieldSchema, formSteps, validateAnswers } from '../src/lib/forms';

const field = (input: Record<string, unknown>) => formFieldSchema.parse({ id: String(input.id ?? input.type), label: 'Q', ...input }) as FormField;

describe('form fields', () => {
  it('needs options for a choice question', () => {
    expect(formFieldSchema.safeParse({ id: 'a', type: 'select', label: 'Pick' }).success).toBe(false);
    expect(formFieldSchema.safeParse({ id: 'a', type: 'select', label: 'Pick', options: ['One'] }).success).toBe(true);
  });

  it('refuses a form with two fields of the same id', () => {
    const fields = [{ id: 'a', type: 'text', label: 'A' }, { id: 'a', type: 'email', label: 'B' }];
    expect(blockSchemas.form.safeParse({ formName: 'F', fields }).success).toBe(false);
  });

  it('splits a form into steps at each step marker', () => {
    const steps = formSteps([field({ id: 'n', type: 'text' }), field({ id: 's', type: 'step', label: 'Two' }), field({ id: 'e', type: 'email' })]);
    expect(steps.map((s) => [s.title, s.fields.map((f) => f.id)])).toEqual([
      [undefined, ['n']],
      ['Two', ['e']],
    ]);
  });
});

describe('checking answers', () => {
  const fields = [
    field({ id: 'name', type: 'text', label: 'Name', required: true }),
    field({ id: 'email', type: 'email', label: 'Email', required: true }),
    field({ id: 'kind', type: 'radio', label: 'Kind', options: ['A', 'B'] }),
    field({ id: 'areas', type: 'checkboxes', label: 'Areas', options: ['X', 'Y'] }),
    field({ id: 'ok', type: 'consent', label: 'I agree', required: true }),
  ];
  const good = { name: 'Sam', email: 'sam@example.com', kind: 'A', areas: ['X'], ok: true };

  it('keeps the questions beside the answers, in order, and drops invented ones', () => {
    const result = validateAnswers(fields, { ...good, invented: 'drop me' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answers.map((a) => a.id)).toEqual(['name', 'email', 'kind', 'areas', 'ok']);
      expect(result.answers[0]).toEqual({ id: 'name', label: 'Name', value: 'Sam' });
    }
  });

  it('refuses a missing required answer, a bad email, a made-up option and an unticked consent', () => {
    expect(validateAnswers(fields, { ...good, name: '  ' })).toEqual({ ok: false, error: 'Name is required.' });
    expect(validateAnswers(fields, { ...good, email: 'nope' }).ok).toBe(false);
    expect(validateAnswers(fields, { ...good, kind: 'Z' }).ok).toBe(false);
    expect(validateAnswers(fields, { ...good, areas: ['X', 'Q'] }).ok).toBe(false);
    expect(validateAnswers(fields, { ...good, ok: false }).ok).toBe(false);
  });

  it('lets optional questions stay empty, and prints answers for the admin', () => {
    const result = validateAnswers(fields, { name: 'Sam', email: 'sam@example.com', ok: true });
    expect(result.ok).toBe(true);
    expect(answerText(['X', 'Y'])).toBe('X, Y');
    expect(answerText(true)).toBe('Yes');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The file question
   ───────────────────────────────────────────────────────────────────────────
   A file lives in the multipart body, not in the answers, so `validateAnswers`
   cannot see one. Both sides hand it `true` for a field that has a file —
   the browser from its own state, the server from the parts that arrived —
   so both ask exactly the same question and a required attachment cannot be
   skipped by talking to the endpoint directly.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a file question', () => {
  const cv = field({ id: 'cv', type: 'file', label: 'Your CV', required: true });
  const extra = field({ id: 'extra', type: 'file', label: 'Anything else' });

  it('refuses a required attachment that did not come', () => {
    const result = validateAnswers([cv], { cv: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('attach a file');
  });

  it('accepts one that did, without inventing a value for it', () => {
    const result = validateAnswers([cv], { cv: true });
    expect(result.ok).toBe(true);
    /* Empty on purpose: the server is the only side with the bytes, and it
       overwrites this with the stored name. A placeholder here could reach
       the inbox if the server ever forgot to. */
    if (result.ok) expect(result.answers[0]).toEqual({ id: 'cv', label: 'Your CV', value: '' });
  });

  it('lets an optional one stay empty', () => {
    const result = validateAnswers([extra], {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers).toHaveLength(1);
  });

  /* A string is what a script would send if it tried to answer a file
     question with text rather than a file. Only `true` counts. */
  it('does not accept a claim that a file came', () => {
    expect(validateAnswers([cv], { cv: 'photo.jpg' }).ok).toBe(false);
    expect(validateAnswers([cv], { cv: 1 }).ok).toBe(false);
    expect(validateAnswers([cv], { cv: 'true' }).ok).toBe(false);
  });

  it('names the visitor’s own file in the inbox and the export', () => {
    expect(
      answerLine({
        id: 'cv',
        label: 'Your CV',
        value: 'anna-cv.pdf',
        file: { name: '0f3b.pdf', originalName: 'anna-cv.pdf', bytes: 204800 },
      }),
    ).toBe('anna-cv.pdf (200 KB)');
    // Without a file it is the plain answer, as before.
    expect(answerLine({ id: 'a', label: 'Q', value: 'Yes' })).toBe('Yes');
  });
});
