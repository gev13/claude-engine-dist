import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SAMPLE_DATA,
  applyReplacements,
  VALUE_MASK,
  WEBHOOK_FIELDS,
  renderCustomBody,
  renderTemplate,
  reservedHeader,
  resolveWebhooks,
  templateProblems,
  webhookSchema,
} from '@/lib/webhooks';

/* 3.31 — a webhook's own headers and a body in the receiver's field names.
   The rules that keep a header from being a second header, and the template
   language that lets one field carry several of the event's. */

const id = '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b';
const hid = '1f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b';
const base = { id, name: 'CRM', url: 'https://hooks.example.com/x', events: ['enquiry.received'] };
const withHeaders = (headers: unknown[]) => webhookSchema.safeParse({ ...base, headers });
const header = (name: string, value = 'k-123', key = hid) => ({ id: key, name, value });

describe('custom headers', () => {
  it('accepts an ordinary auth header, and the mask that means “keep it”', () => {
    expect(withHeaders([header('X-API-Key')]).success).toBe(true);
    expect(withHeaders([header('Authorization', 'Bearer abc.def')]).success).toBe(true);
    expect(withHeaders([header('X-API-Key', VALUE_MASK)]).success).toBe(true);
  });

  it('refuses the names the sender sets itself, whatever their case', () => {
    for (const name of ['x-engine-signature', 'X-Engine-Event', 'X-ENGINE-anything', 'Host', 'content-type', 'Content-Length', 'Transfer-Encoding', 'Connection']) {
      expect(reservedHeader(name), name).toBe(true);
      expect(withHeaders([header(name)]).success, name).toBe(false);
    }
    expect(reservedHeader('X-Api-Key')).toBe(false);
  });

  it('refuses a name that is not a token, and CR or LF anywhere', () => {
    for (const name of ['X API Key', 'X-Key:', 'X-Key\r\nX-Evil', 'Ключ', '', 'a'.repeat(65)]) expect(withHeaders([header(name)]).success, JSON.stringify(name)).toBe(false);
    for (const value of ['abc\r\nX-Evil: 1', 'abc\nx', 'abc\rx', 'nul\u0000', 'ünicode']) expect(withHeaders([header('X-Key', value)]).success, JSON.stringify(value)).toBe(false);
  });

  it('caps the value, the count, and refuses one name twice', () => {
    expect(withHeaders([header('X-Key', 'a'.repeat(1000))]).success).toBe(true);
    expect(withHeaders([header('X-Key', 'a'.repeat(1001))]).success).toBe(false);
    // A stored value is ciphertext, longer than the cap and still fine.
    expect(withHeaders([header('X-Key', `enc.v1:${'a'.repeat(1400)}`)]).success).toBe(true);
    const six = Array.from({ length: 6 }, (_, i) => header(`X-K${i}`, 'v', `${i}f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b`));
    expect(withHeaders(six).success).toBe(false);
    expect(withHeaders(six.slice(0, 5)).success).toBe(true);
    expect(withHeaders([header('X-Key'), header('x-key', 'v', '2f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b')]).success).toBe(false);
  });
});

describe('the body', () => {
  it('is the envelope for every hook stored before it existed', () => {
    const [hook] = resolveWebhooks({ hooks: [{ ...base, secret: '' }] }).hooks;
    expect(hook!.body).toEqual({ mode: 'envelope', fields: [], replace: [] });
    expect(hook!.headers).toEqual([]);
  });

  it('needs at least one field, each named once, when it is custom', () => {
    expect(webhookSchema.safeParse({ ...base, body: { mode: 'custom', fields: [] } }).success).toBe(false);
    const twice = { mode: 'custom', fields: [{ name: 'a', template: '' }, { name: 'a', template: '' }] };
    expect(webhookSchema.safeParse({ ...base, body: twice }).success).toBe(false);
    expect(webhookSchema.safeParse({ ...base, body: { mode: 'custom', fields: [{ name: 'a', template: '{{name}}' }] } }).success).toBe(true);
  });

  it('builds the acceptance-test body: name, contact, and a message made of five fields', () => {
    const fields = [
      { name: 'name', template: '{{name}}' },
      { name: 'contact', template: '{{email}}' },
      { name: 'message', template: '{{message}}\n\nCompany: {{company}}\nRole: {{role}}\nServices: {{services}}\nTiming: {{ timing }}' },
    ];
    const data = { ...SAMPLE_DATA['enquiry.received'], message: 'We need a new site.', company: 'Acme', role: 'CTO', services: ['Design', 'SEO'], timing: 'Q1' };
    expect(renderCustomBody(fields, data)).toEqual({
      name: 'Test Sender',
      contact: 'test@example.com',
      message: 'We need a new site.\n\nCompany: Acme\nRole: CTO\nServices: Design, SEO\nTiming: Q1',
    });
  });

  it('reads one answer or all of them from a form submission, and a hidden value', () => {
    const data = {
      answers: [
        { id: 'email', label: 'Email', value: 'a@b.co' },
        { id: 'topics', label: 'Topics', value: ['x', 'y'] },
        { id: 'agree', label: 'Agree', value: true },
        { id: 'cv', label: 'CV', value: 'stored.pdf', file: { name: 'Me.pdf', url: 'https://x' } },
      ],
      hidden: { utm_source: 'google' },
    };
    expect(renderTemplate('{{answers.email}} / {{answers.topics}} / {{answers.agree}} / {{answers.cv}}', data)).toBe('a@b.co / x, y / Yes / Me.pdf');
    expect(renderTemplate('{{answers}}', data)).toBe('Email: a@b.co\nTopics: x, y\nAgree: Yes\nCV: Me.pdf');
    expect(renderTemplate('{{hidden.utm_source}}|{{hidden.nope}}|{{answers.nope}}', data)).toBe('google||');
  });

  it('leaves text it does not recognise alone, and never reaches the prototype', () => {
    expect(renderTemplate('{{ name }} {name} {{}} {{1x}}', { name: 'Ana' })).toBe('Ana {name} {{}} {{1x}}');
    expect(renderTemplate('{{constructor}}{{toString}}{{hidden.constructor}}', { hidden: {} })).toBe('');
    const body = renderCustomBody([{ name: '__proto__', template: 'x' }], {});
    expect(Object.getPrototypeOf(body)).toBe(Object.prototype);
    expect(JSON.stringify(body)).toBe('{"__proto__":"x"}');
  });

  it('names a placeholder the hook’s events do not carry', () => {
    const custom = (template: string, events: string[] = ['enquiry.received']) =>
      templateProblems(webhookSchema.parse({ ...base, events, body: { mode: 'custom', fields: [{ name: 'm', template }] } }));
    expect(custom('{{message}} {{company}}')).toEqual([]);
    expect(custom('{{mesage}}')).toHaveLength(1);
    expect(custom('{{answers.email}}')).toHaveLength(1);
    expect(custom('{{answers.email}} {{hidden.utm}}', ['form.submitted'])).toEqual([]);
    // Either event's fields will do when a hook takes both.
    expect(custom('{{message}} {{answers.email}}', ['form.submitted', 'enquiry.received'])).toEqual([]);
    expect(templateProblems(webhookSchema.parse(base))).toEqual([]);
  });
});

describe('replacements (3.31.1)', () => {
  const interests = { answers: [{ id: 'interests', label: 'Interests', value: ['Design & Build', 'Support', 'Sales & Marketing'] }] };

  it('turns a choice’s ampersand into “and” on the way out', () => {
    const body = renderCustomBody([{ name: 'interests', template: '{{answers.interests}}' }], interests, [{ find: ' & ', to: ' and ' }]);
    expect(body).toEqual({ interests: 'Design and Build, Support, Sales and Marketing' });
    expect(body.interests).not.toContain('&');
  });

  it('touches values only, in order, as plain text', () => {
    // The template's own “&” is the admin's wording and is sent as typed.
    expect(renderTemplate('Q & A: {{answers.interests}}', interests, [{ find: ' & ', to: ' and ' }])).toBe('Q & A: Design and Build, Support, Sales and Marketing');
    expect(applyReplacements('a.b.c', [{ find: '.', to: '' }])).toBe('abc');
    expect(applyReplacements('R&D & co', [{ find: ' & ', to: ' and ' }])).toBe('R&D and co');
    expect(applyReplacements('x', [{ find: 'x', to: 'y' }, { find: 'y', to: 'z' }])).toBe('z');
    expect(applyReplacements('$&', [{ find: '$&', to: '$1' }])).toBe('$1');
  });

  it('is part of a stored hook, empty unless set, and refuses an empty find', () => {
    expect(webhookSchema.parse({ ...base, body: { mode: 'custom', fields: [{ name: 'a', template: '' }] } }).body.replace).toEqual([]);
    expect(webhookSchema.safeParse({ ...base, body: { mode: 'custom', fields: [{ name: 'a', template: '' }], replace: [{ find: '', to: 'x' }] } }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, () => ({ find: 'a', to: 'b' }));
    expect(webhookSchema.safeParse({ ...base, body: { mode: 'custom', fields: [{ name: 'a', template: '' }], replace: eleven } }).success).toBe(false);
  });
});

describe('the field list', () => {
  // The screen lists what a template can name; it must be what the payloads carry.
  const source = readFileSync(new URL('../src/server/webhooks/deliver.ts', import.meta.url), 'utf8');
  /** The keys of the object a payload function returns: lines at exactly that object's indent. */
  const keysOf = (fn: string, opener: string, indent: number) => {
    const start = source.indexOf(`export async function ${fn}`);
    const body = source.slice(start, source.indexOf('\n}\n', start));
    const object = body.slice(body.indexOf(opener));
    return [...object.matchAll(new RegExp(`^ {${indent}}(\\w+):`, 'gm'))].map((m) => m[1]!);
  };

  it('matches enquiryPayload()', () => {
    expect(new Set(WEBHOOK_FIELDS['enquiry.received'].map((f) => f.key))).toEqual(new Set(keysOf('enquiryPayload', 'return {', 4)));
  });

  it('matches submissionPayload()', () => {
    const keys = keysOf('submissionPayload', 'data: {', 6);
    expect(keys.length).toBeGreaterThan(5);
    const listed = WEBHOOK_FIELDS['form.submitted'].map((f) => f.key).filter((key) => !key.includes('<'));
    expect(new Set(listed)).toEqual(new Set(keys));
    expect(Object.keys(SAMPLE_DATA['form.submitted']).sort()).toEqual([...keys].sort());
    expect(Object.keys(SAMPLE_DATA['enquiry.received']).sort()).toEqual(keysOf('enquiryPayload', 'return {', 4).sort());
  });
});
