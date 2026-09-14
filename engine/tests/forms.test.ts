import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { type FormField, answerText, formFieldSchema, formSteps, validateAnswers } from '../src/lib/forms';

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
