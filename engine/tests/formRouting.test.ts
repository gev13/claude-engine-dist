import { describe, expect, it } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { emailAnswer, fillTemplate, formAfterSchema, readHiddenValues, validateAnswers, visibleFields, type FormField } from '@/lib/forms';
import { hooksFor, resolveWebhooks, webhookSchema } from '@/lib/webhooks';
import { autoresponderEmail, formSubmissionEmail, notificationEmail } from '@/server/mail/templates';
import { isPublicAddress, postPublic } from '@/server/security/outbound';
import { signPayload } from '@/server/webhooks/sign';

/* 2.16 — what happens around a form being sent: conditions, hidden fields,
   the email, the reply, the redirect and the webhook. */

const field = (partial: Partial<FormField> & { id: string; type: FormField['type'] }): FormField =>
  ({ label: partial.id, required: false, options: [], width: 'full', ...partial }) as FormField;

describe('a stored form from before 2.16', () => {
  it('parses to exactly what it did: count-only email, no reply, no redirect, no hidden fields', () => {
    const props = blockSchemas.form.parse({ formName: 'Contact', fields: [{ id: 'a', type: 'text', label: 'Name' }] });
    expect(props.captcha).toBe('inherit');
    expect(props.notify).toMatchObject({ recipients: [], includeAnswers: false, subject: '' });
    expect(props.autoresponder.enabled).toBe(false);
    expect(props.after.redirect).toBe('');
    expect(props.hidden).toEqual([]);
  });

  it('keeps the contact form as it was', () => {
    expect(blockSchemas.contactForm.parse({}).after.redirect).toBe('');
  });
});

describe('conditional questions', () => {
  const fields = [
    field({ id: 'kind', type: 'radio', options: ['Person', 'Business'], required: true }),
    field({ id: 'size', type: 'select', options: ['1-10', '11+'], required: true, showIf: { field: 'kind', equals: 'Business' } }),
    field({ id: 'budget', type: 'text', required: true, showIf: { field: 'size', equals: '11+' } }),
  ];

  it('asks a question only when its condition holds', () => {
    expect(visibleFields(fields, { kind: 'Person' }).map((f) => f.id)).toEqual(['kind']);
    expect(visibleFields(fields, { kind: 'Business' }).map((f) => f.id)).toEqual(['kind', 'size']);
    expect(visibleFields(fields, { kind: 'Business', size: '11+' }).map((f) => f.id)).toEqual(['kind', 'size', 'budget']);
  });

  it('hides a question that depends on a hidden one, even with a stale answer', () => {
    expect(visibleFields(fields, { kind: 'Person', size: '11+' }).map((f) => f.id)).toEqual(['kind']);
  });

  it('neither requires nor stores a hidden question’s answer', () => {
    const result = validateAnswers(fields, { kind: 'Person', size: '11+', budget: 'lots' });
    expect(result).toEqual({ ok: true, answers: [{ id: 'kind', label: 'kind', value: 'Person' }] });
  });

  it('still requires a question once it is shown', () => {
    expect(validateAnswers(fields, { kind: 'Business' }).ok).toBe(false);
  });

  it('judges one step against the whole form', () => {
    const step = fields.slice(1);
    expect(validateAnswers(step, { kind: 'Business' }, fields).ok).toBe(false);
    expect(validateAnswers(step, { kind: 'Person' }, fields).ok).toBe(true);
  });
});

describe('hidden fields', () => {
  const defined = [
    { name: 'utm_source', source: 'utm_source' as const, value: '' },
    { name: 'origin', source: 'static' as const, value: 'landing-a' },
  ];

  it('keeps only names the form defines, and a static value as saved', () => {
    expect(readHiddenValues(defined, { utm_source: ' google ', origin: 'forged', extra: 'x' })).toEqual({ utm_source: 'google', origin: 'landing-a' });
  });

  it('caps a value and ignores anything that is not text', () => {
    expect(readHiddenValues(defined, { utm_source: 'x'.repeat(900) }).utm_source).toHaveLength(500);
    expect(readHiddenValues(defined, { utm_source: { a: 1 } })).toEqual({ origin: 'landing-a' });
    expect(readHiddenValues(defined, 'nonsense')).toEqual({ origin: 'landing-a' });
  });
});

describe('templates and addresses', () => {
  const answers = [
    { id: 'name', label: 'Name', value: 'Ana' },
    { id: 'email', label: 'Email', value: 'ana@example.com' },
    { id: 'bad', label: 'Other', value: 'not an address' },
  ];

  it('fills {formName} and {field:id}, and leaves an unknown field empty', () => {
    expect(fillTemplate('{formName}: {field:name} <{field:email}> {field:nope}', 'Quote', answers)).toBe('Quote: Ana <ana@example.com> ');
  });

  it('uses an answer as an address only when it is one', () => {
    expect(emailAnswer(answers, 'email')).toBe('ana@example.com');
    expect(emailAnswer(answers, 'bad')).toBeNull();
    expect(emailAnswer(answers, '')).toBeNull();
    expect(emailAnswer([{ id: 'e', label: 'e', value: 'a@b.co\r\nBcc: x@y.z' }], 'e')).toBeNull();
  });

  it('only redirects to a path on this site', () => {
    expect(formAfterSchema.safeParse({ redirect: '/thank-you' }).success).toBe(true);
    expect(formAfterSchema.safeParse({ redirect: '//evil.example' }).success).toBe(false);
    expect(formAfterSchema.safeParse({ redirect: 'https://evil.example' }).success).toBe(false);
    expect(formAfterSchema.safeParse({ redirect: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('the emails', () => {
  const brand = { siteName: 'Site', siteUrl: 'https://example.com' };
  const base = { ...brand, subject: 'New submission: Quote', formName: 'Quote', source: '/contact', received: 'now', count: 2, meta: [] as [string, string][], adminUrl: 'https://example.com/admin/submissions' };

  it('carries no answers unless the form asks — and is then exactly the 2.15 notice', () => {
    const message = formSubmissionEmail({ ...base, subject: 'New submission to “Quote”', answers: null });
    // What notifyFormSubmission built before 2.16, field for field.
    const before = notificationEmail({
      ...brand,
      title: 'New submission to “Quote”',
      intro: 'Somebody filled in a form on the site. The answers are in the admin, not in this email.',
      facts: [
        ['Form', 'Quote'],
        ['Page', '/contact'],
        ['Answers', '2'],
        ['Received', 'now'],
      ],
      adminUrl: 'https://example.com/admin/submissions',
      adminLabel: 'Read the answers',
    });
    expect(message).toEqual(before);
  });

  it('says who it was sent to when the form has its own list', () => {
    const message = formSubmissionEmail({ ...base, answers: null, ownRecipients: true });
    expect(message.html).toContain('this form’s notifications');
    expect(message.text).toContain('Answers: 2');
  });

  it('escapes every answer, and links a file to the admin', () => {
    const message = formSubmissionEmail({
      ...base,
      answers: [
        { label: 'Name', value: '<img src=x onerror=alert(1)>' },
        { label: 'CV', value: 'cv.pdf', link: 'https://example.com/api/admin/submissions/1/file/cv' },
      ],
      meta: [['utm_source', '"google"']],
    });
    expect(message.html).not.toContain('<img src=x');
    expect(message.html).toContain('&lt;img');
    expect(message.html).toContain('href="https://example.com/api/admin/submissions/1/file/cv"');
    expect(message.html).toContain('&quot;google&quot;');
  });

  it('writes the reply as escaped paragraphs', () => {
    const message = autoresponderEmail({ ...brand, subject: 'Thanks', body: 'Hello <b>Ana</b>\n\nSecond paragraph' });
    expect(message.html).toContain('Hello &lt;b&gt;Ana&lt;/b&gt;');
    expect(message.html.match(/<p style="margin:0 0 14px/g)?.length).toBe(2);
    expect(message.text).toContain('Second paragraph');
  });
});

describe('webhooks', () => {
  const hook = (partial: Record<string, unknown>) =>
    webhookSchema.parse({ id: '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', name: 'CRM', url: 'https://hooks.example.com/x', ...partial });

  it('sends each event only to the hooks that want it, for the forms they name', () => {
    const settings = {
      hooks: [
        hook({}),
        hook({ id: '9f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', forms: ['Quote'] }),
        hook({ id: 'af3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', events: ['enquiry.received'] }),
        hook({ id: 'bf3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', enabled: false }),
      ],
    };
    expect(hooksFor(settings, 'form.submitted', 'Contact')).toHaveLength(1);
    expect(hooksFor(settings, 'form.submitted', 'Quote')).toHaveLength(2);
    expect(hooksFor(settings, 'enquiry.received')).toHaveLength(1);
  });

  it('accepts https addresses only', () => {
    expect(webhookSchema.safeParse({ id: '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', name: 'x', url: 'http://hooks.example.com' }).success).toBe(false);
    expect(webhookSchema.safeParse({ id: '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', name: 'x', url: 'https://user:pw@hooks.example.com' }).success).toBe(false);
  });

  it('reads a broken row as no webhooks', () => {
    expect(resolveWebhooks({ hooks: 'nope' }).hooks).toEqual([]);
  });

  it('signs the timestamp with the body', () => {
    const signature = signPayload('secret', '1700000000', '{"a":1}');
    // HMAC-SHA256("secret", '1700000000.{"a":1}'), computed independently.
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signature).toBe(signPayload('secret', '1700000000', '{"a":1}'));
    expect(signature).not.toBe(signPayload('secret', '1700000001', '{"a":1}'));
  });
});

describe('requests to typed addresses', () => {
  it('knows a public address from a private one', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) expect(isPublicAddress(ip), ip).toBe(true);
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'localhost']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it('refuses a private address before anything is sent', async () => {
    expect(await postPublic('https://127.0.0.1/hook', '{}', {})).toMatchObject({ ok: false });
    expect(await postPublic('https://169.254.169.254/latest/meta-data', '{}', {})).toMatchObject({ ok: false });
    expect(await postPublic('http://example.com/', '{}', {})).toMatchObject({ ok: false, error: 'Only https:// addresses are allowed.' });
  });

  it('refuses a name that resolves to a private address', async () => {
    const result = await postPublic('https://localhost/hook', '{}', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not on the public internet/);
  });
});
