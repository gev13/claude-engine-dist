'use client';

import { useRef } from 'react';
import { AdminButton, Field, Input, Textarea } from '@/components/admin/ui';
import {
  HEADER_NAME,
  HEADER_VALUE,
  HEADER_VALUE_MAX,
  MAX_BODY_FIELDS,
  MAX_WEBHOOK_HEADERS,
  SAMPLE_DATA,
  TEMPLATE_MAX,
  VALUE_MASK,
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_FIELDS,
  renderCustomBody,
  reservedHeader,
  templateProblems,
  type Webhook,
  type WebhookBodyField,
  type WebhookHeader,
} from '@/lib/webhooks';

/* ═══════════════════════════════════════════════════════════════════════════
   A webhook's headers and body (3.31)
   ───────────────────────────────────────────────────────────────────────────
   Header values are write-only, like the SMTP password: a stored one arrives
   as the mask, the field shows empty with a note, and leaving it empty keeps
   what is there. The body is the engine's envelope or a flat object of the
   receiver's own field names, previewed with stand-in values.
   ═══════════════════════════════════════════════════════════════════════════ */

const legend = 'mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke';

type HeaderProblem = { name?: string; value?: string };

/** What is wrong with one header's name and value, each on its own. */
export function headerProblem(header: WebhookHeader, others: WebhookHeader[]): HeaderProblem | undefined {
  const name = header.name.trim();
  const problem: HeaderProblem = {};
  if (!name) problem.name = 'Name the header';
  else if (!HEADER_NAME.test(name)) problem.name = 'Letters, digits and - only, no spaces';
  else if (reservedHeader(name)) problem.name = 'The engine sets that header itself';
  else if (others.some((other) => other.id !== header.id && other.name.trim().toLowerCase() === name.toLowerCase())) problem.name = 'That header is set twice';
  if (header.value === '') problem.value = 'Give it a value';
  else if (header.value !== VALUE_MASK && !HEADER_VALUE.test(header.value)) problem.value = 'No line breaks or special characters';
  else if (header.value !== VALUE_MASK && header.value.length > HEADER_VALUE_MAX) problem.value = `At most ${HEADER_VALUE_MAX} characters`;
  return problem.name || problem.value ? problem : undefined;
}

/** Everything that would stop the server saving this hook's headers and body. */
export function partsInvalid(hook: Webhook): boolean {
  if (hook.headers.some((header) => headerProblem(header, hook.headers))) return true;
  if (hook.body.mode !== 'custom') return false;
  if (hook.body.fields.length === 0) return true;
  const names = hook.body.fields.map((field) => field.name.trim());
  if (names.some((name) => !name) || new Set(names).size !== names.length) return true;
  return templateProblems(hook).length > 0;
}

export function HeadersEditor({ hook, storedIds, onChange }: { hook: Webhook; storedIds: Set<string>; onChange: (headers: WebhookHeader[]) => void }) {
  const set = (index: number, patch: Partial<WebhookHeader>) => onChange(hook.headers.map((header, i) => (i === index ? { ...header, ...patch } : header)));
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={legend}>Request headers</legend>
      <p className="m-0 mb-3 text-[13px] text-smoke">
        Sent with every delivery — a receiver’s own key goes here, e.g. <code>X-API-Key</code> or <code>Authorization</code>. Values are kept encrypted and
        never shown again once saved.
      </p>
      <div className="flex flex-col gap-3">
        {hook.headers.map((header, index) => {
          const stored = storedIds.has(header.id) && header.value === VALUE_MASK;
          const problem = header.name !== '' || header.value !== '' ? headerProblem(header, hook.headers) : undefined;
          return (
            <div key={header.id} className="grid items-start gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Field label="Header" htmlFor={`wh-hname-${header.id}`} error={problem?.name}>
                <Input
                  id={`wh-hname-${header.id}`}
                  value={header.name}
                  maxLength={64}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="X-API-Key"
                  onChange={(e) => set(index, { name: e.target.value.trim() })}
                />
              </Field>
              <Field
                label="Value"
                htmlFor={`wh-hvalue-${header.id}`}
                hint={stored ? 'a value is stored — type a new one to replace it' : 'stored encrypted; never shown again'}
                error={problem?.value}
              >
                <Input
                  id={`wh-hvalue-${header.id}`}
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={HEADER_VALUE_MAX}
                  value={header.value === VALUE_MASK ? '' : header.value}
                  placeholder={stored ? VALUE_MASK : ''}
                  // Emptying the field keeps what is stored; removing the row is how a header goes.
                  onChange={(e) => set(index, { value: e.target.value === '' && storedIds.has(header.id) ? VALUE_MASK : e.target.value })}
                />
              </Field>
              <div className="sm:pt-6">
                <AdminButton variant="ghost" type="button" onClick={() => onChange(hook.headers.filter((_, i) => i !== index))}>
                  Remove header
                </AdminButton>
              </div>
            </div>
          );
        })}
        {hook.headers.length < MAX_WEBHOOK_HEADERS && (
          <div>
            <AdminButton type="button" variant="secondary" onClick={() => onChange([...hook.headers, { id: crypto.randomUUID(), name: '', value: '' }])}>
              Add a header
            </AdminButton>
          </div>
        )}
      </div>
    </fieldset>
  );
}

export function BodyEditor({ hook, onChange }: { hook: Webhook; onChange: (body: Webhook['body']) => void }) {
  const focused = useRef<{ index: number; at: number } | null>(null);
  const fields = hook.body.fields;
  const setField = (index: number, patch: Partial<WebhookBodyField>) =>
    onChange({ ...hook.body, fields: fields.map((field, i) => (i === index ? { ...field, ...patch } : field)) });

  /** Puts `{{key}}` where the cursor was in the last template touched, or at the end of the last field. */
  function insert(key: string) {
    if (fields.length === 0) return;
    const target = focused.current ?? { index: fields.length - 1, at: fields[fields.length - 1]!.template.length };
    const field = fields[target.index];
    if (!field) return;
    const token = `{{${key}}}`;
    const at = Math.min(target.at, field.template.length);
    setField(target.index, { template: (field.template.slice(0, at) + token + field.template.slice(at)).slice(0, TEMPLATE_MAX) });
    focused.current = { index: target.index, at: at + token.length };
  }

  const problems = templateProblems(hook);
  const previewEvent = hook.events[0];
  const names = fields.map((field) => field.name.trim());

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={legend}>Body</legend>
      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-2.5 text-[14px] text-ash">
          <input
            type="radio"
            name={`wh-body-${hook.id}`}
            className="mt-1 h-4 w-4 accent-flare"
            checked={hook.body.mode === 'envelope'}
            onChange={() => onChange({ ...hook.body, mode: 'envelope' })}
          />
          <span>
            Envelope — the engine’s own JSON: <code>id</code>, <code>event</code>, <code>createdAt</code>, <code>site</code> and <code>data</code>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-[14px] text-ash">
          <input
            type="radio"
            name={`wh-body-${hook.id}`}
            className="mt-1 h-4 w-4 accent-flare"
            checked={hook.body.mode === 'custom'}
            onChange={() =>
              onChange({ mode: 'custom', fields: fields.length ? fields : [{ name: 'message', template: previewEvent === 'enquiry.received' ? '{{message}}' : '{{answers}}' }] })
            }
          />
          <span>Custom — the receiver’s own field names, each filled from a template</span>
        </label>
      </div>

      {hook.body.mode === 'custom' && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const name = field.name.trim();
              const nameError = !name ? 'Name the field' : names.filter((other) => other === name).length > 1 ? 'Used twice' : undefined;
              return (
                <div key={index} className="grid items-start gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Field label="Field" htmlFor={`wh-fname-${hook.id}-${index}`} error={field.name !== '' || fields.length > 1 ? nameError : undefined}>
                    <Input
                      id={`wh-fname-${hook.id}-${index}`}
                      value={field.name}
                      maxLength={64}
                      spellCheck={false}
                      placeholder="message"
                      onChange={(e) => setField(index, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Template" htmlFor={`wh-ftpl-${hook.id}-${index}`}>
                    <Textarea
                      id={`wh-ftpl-${hook.id}-${index}`}
                      rows={Math.min(8, Math.max(2, field.template.split('\n').length))}
                      maxLength={TEMPLATE_MAX}
                      spellCheck={false}
                      value={field.template}
                      placeholder="{{message}}"
                      onSelect={(e) => (focused.current = { index, at: e.currentTarget.selectionStart })}
                      onChange={(e) => {
                        focused.current = { index, at: e.target.selectionStart };
                        setField(index, { template: e.target.value });
                      }}
                    />
                  </Field>
                  <div className="sm:pt-6">
                    <AdminButton
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        focused.current = null;
                        onChange({ ...hook.body, fields: fields.filter((_, i) => i !== index) });
                      }}
                    >
                      Remove field
                    </AdminButton>
                  </div>
                </div>
              );
            })}
            {fields.length === 0 && <p className="m-0 text-[13px] text-flare-soft">A custom body needs at least one field.</p>}
            {fields.length < MAX_BODY_FIELDS && (
              <div>
                <AdminButton type="button" variant="secondary" onClick={() => onChange({ ...hook.body, fields: [...fields, { name: '', template: '' }] })}>
                  Add a field
                </AdminButton>
              </div>
            )}
          </div>

          {problems.length > 0 && (
            <ul className="m-0 list-none p-0 text-[12px] text-flare-soft">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          {hook.events.map((event) => (
            <div key={event}>
              <p className={legend}>Fields for “{WEBHOOK_EVENT_LABELS[event]}” — press one to put it in the template you were writing</p>
              <ul className="m-0 grid list-none gap-x-4 gap-y-1 p-0 sm:grid-cols-2">
                {WEBHOOK_FIELDS[event].map((field) => (
                  <li key={field.key} className="text-[13px] text-smoke">
                    {field.key.includes('<') ? (
                      <code className="text-ash">{`{{${field.key}}}`}</code>
                    ) : (
                      <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] text-bone underline-offset-2 hover:underline" onClick={() => insert(field.key)}>
                        {`{{${field.key}}}`}
                      </button>
                    )}{' '}
                    — {field.hint}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="m-0 text-[13px] text-smoke">
            Every value is sent as text; a list is joined with commas. Text around the placeholders is sent as typed, so one field can combine several — a
            message followed by the company, role and timing, say.
          </p>

          {previewEvent && fields.length > 0 && (
            <div>
              <p className={legend}>Preview, with stand-in values (Send a test sends this)</p>
              <pre className="m-0 max-h-72 overflow-auto rounded border border-hairline bg-ink p-3 text-[12px] whitespace-pre-wrap text-ash">
                {JSON.stringify(renderCustomBody(fields, SAMPLE_DATA[previewEvent]), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
