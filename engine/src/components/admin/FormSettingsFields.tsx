'use client';

import { AdminButton, Field, Input, Select, Textarea } from '@/components/admin/ui';
import { HIDDEN_SOURCES, HIDDEN_SOURCE_LABELS, type HiddenSource } from '@/lib/forms';

/* ═══════════════════════════════════════════════════════════════════════════
   A form's settings beyond its questions (T12/T13, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Bot protection, who is emailed, the visitor's reply, what happens after
   sending and the hidden fields — each folded away, because most forms need
   none of it and the questions are what somebody opens a form to edit.
   Every default here is what a form did before 2.16.
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = Record<string, unknown>;
type Set = (next: Props) => void;
type Question = { id: string; type: string; label: string; options?: string[] };

type Notify = { recipients?: string[]; includeAnswers?: boolean; subject?: string; replyToField?: string; includeMeta?: boolean; includeIp?: boolean };
type Autoresponder = { enabled?: boolean; emailField?: string; subject?: string; body?: string };
export type After = { redirect?: string; track?: boolean; event?: string; adsConversion?: string; yandexGoal?: string; linkedinConversion?: string };
type Hidden = { name: string; source: HiddenSource; value?: string };

const obj = <T,>(props: Props, key: string): T => ((props[key] && typeof props[key] === 'object' ? props[key] : {}) as T);

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-ash">
      <input type="checkbox" className="h-4 w-4 accent-flare" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Fold({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <details className="border-2 border-hairline bg-ink px-3 py-2">
      <summary className="cursor-pointer py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone">
        {title}
        {summary && <span className="ml-2 normal-case tracking-normal text-ash">— {summary}</span>}
      </summary>
      <div className="flex flex-col gap-3 pt-3 pb-1">{children}</div>
    </details>
  );
}

/** The email questions of a form, for Reply-To and the autoresponder. */
const emailQuestions = (fields: Question[]) => fields.filter((field) => field.type === 'email');

function QuestionSelect({ label, hint, value, options, onChange }: { label: string; hint?: string; value: string; options: Question[]; onChange: (id: string) => void }) {
  return (
    <Field label={label} hint={hint}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{options.length ? 'None' : 'Add an email question first'}</option>
        {options.map((field) => (
          <option key={field.id} value={field.id}>
            {field.label || field.id}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * "Show only when…" on one question: an earlier question, and the answer
 * that shows this one. Only earlier questions are offered — a condition on a
 * later one could never be met before this one is reached.
 */
export function ShowIfField({
  item,
  earlier,
  update,
}: {
  item: { showIf?: { field: string; equals: string } };
  earlier: Question[];
  update: (patch: { showIf?: { field: string; equals: string } }) => void;
}) {
  const candidates = earlier.filter((field) => !['step', 'file', 'textarea'].includes(field.type));
  if (candidates.length === 0 && !item.showIf) return null;
  const source = candidates.find((field) => field.id === item.showIf?.field);
  const answers = source?.type === 'consent' ? ['true', 'false'] : (source?.options ?? []);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Show only when" hint="leave on “Always” to always ask it">
        <Select
          value={item.showIf?.field ?? ''}
          onChange={(e) => update({ showIf: e.target.value ? { field: e.target.value, equals: '' } : undefined })}
        >
          <option value="">Always</option>
          {candidates.map((field) => (
            <option key={field.id} value={field.id}>
              {field.label || field.id}
            </option>
          ))}
        </Select>
      </Field>
      {item.showIf && (
        <Field label="…is answered">
          {answers.length > 0 ? (
            <Select value={item.showIf.equals} onChange={(e) => update({ showIf: { ...item.showIf!, equals: e.target.value } })}>
              <option value="">Choose…</option>
              {answers.map((answer) => (
                <option key={answer} value={answer}>
                  {source?.type === 'consent' ? (answer === 'true' ? 'Ticked' : 'Not ticked') : answer}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={item.showIf.equals} maxLength={80} onChange={(e) => update({ showIf: { ...item.showIf!, equals: e.target.value } })} />
          )}
        </Field>
      )}
    </div>
  );
}

/** After sending — shared by the form block and the contact form. */
export function AfterFields({ value, onChange }: { value: After; onChange: (next: After) => void }) {
  const track = value.track !== false;
  return (
    <>
      <Field label="Then open this page" hint="a site path such as /thank-you — for an advertising conversion; empty shows the thank-you message">
        <Input value={value.redirect ?? ''} placeholder="/thank-you" maxLength={300} onChange={(e) => onChange({ ...value, redirect: e.target.value.trim() })} />
      </Field>
      <Check label="Tell the site’s tracking tags (Integrations) that the form was sent" checked={track} onChange={(next) => onChange({ ...value, track: next })} />
      {track && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event name" hint="Google, the data layer and TikTok; Meta hears generate_lead as Lead">
            <Input value={value.event ?? 'generate_lead'} maxLength={60} onChange={(e) => onChange({ ...value, event: e.target.value.trim() })} />
          </Field>
          <Field label="Google Ads conversion" hint="the name of a conversion listed under Integrations → Google Ads">
            <Input value={value.adsConversion ?? ''} maxLength={60} onChange={(e) => onChange({ ...value, adsConversion: e.target.value })} />
          </Field>
          <Field label="Yandex Metrica goal">
            <Input value={value.yandexGoal ?? ''} maxLength={60} onChange={(e) => onChange({ ...value, yandexGoal: e.target.value.trim() })} />
          </Field>
          <Field label="LinkedIn conversion id" hint="digits">
            <Input value={value.linkedinConversion ?? ''} inputMode="numeric" maxLength={12} onChange={(e) => onChange({ ...value, linkedinConversion: e.target.value.trim() })} />
          </Field>
        </div>
      )}
    </>
  );
}

export function FormSettingsFields({ props, set }: { props: Props; set: Set }) {
  const fields = (Array.isArray(props.fields) ? props.fields : []) as Question[];
  const emails = emailQuestions(fields);
  const notify = obj<Notify>(props, 'notify');
  const reply = obj<Autoresponder>(props, 'autoresponder');
  const after = obj<After>(props, 'after');
  const hidden = (Array.isArray(props.hidden) ? props.hidden : []) as Hidden[];
  const captcha = (props.captcha as string | undefined) ?? 'inherit';

  const setNotify = (patch: Partial<Notify>) => set({ ...props, notify: { ...notify, ...patch } });
  const setReply = (patch: Partial<Autoresponder>) => set({ ...props, autoresponder: { ...reply, ...patch } });
  const setHidden = (next: Hidden[]) => set({ ...props, hidden: next.slice(0, 12) });

  return (
    <div className="flex flex-col gap-3">
      <Fold title="Email" summary={notify.recipients?.length ? `to ${notify.recipients.length} address${notify.recipients.length === 1 ? '' : 'es'}` : 'to the site’s notification list'}>
        <Field label="Send to" hint="up to 10 addresses, one per line; empty uses the list on the Email screen">
          <Textarea
            rows={2}
            value={(notify.recipients ?? []).join('\n')}
            onChange={(e) =>
              setNotify({
                recipients: e.target.value
                  .split(/[\n,]/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 10),
              })
            }
          />
        </Field>
        <Field label="Subject" hint="{formName} and {field:question-id} are filled in">
          <Input value={notify.subject ?? ''} placeholder="New submission to “{formName}”" maxLength={200} onChange={(e) => setNotify({ subject: e.target.value })} />
        </Field>
        <QuestionSelect label="Reply-To" hint="answering the email then answers the visitor" value={notify.replyToField ?? ''} options={emails} onChange={(id) => setNotify({ replyToField: id })} />
        <Check label="Put every answer in the email" checked={notify.includeAnswers === true} onChange={(next) => setNotify({ includeAnswers: next })} />
        <p className="m-0 text-[13px] text-smoke">
          Off, the email says a form arrived and links to it. On, the answers also sit in whoever’s inbox receives it — they are personal data. Files are always a link to the admin, never an attachment.
        </p>
        <Check label="Include the hidden fields (campaign, referrer…)" checked={notify.includeMeta !== false} onChange={(next) => setNotify({ includeMeta: next })} />
        <Check label="Include the visitor’s IP address" checked={notify.includeIp === true} onChange={(next) => setNotify({ includeIp: next })} />
      </Fold>

      <Fold title="Reply to the visitor" summary={reply.enabled ? 'on' : 'off'}>
        <Check label="Send the visitor an automatic reply" checked={reply.enabled === true} onChange={(next) => setReply({ enabled: next })} />
        {reply.enabled && (
          <>
            <QuestionSelect label="To the address in" value={reply.emailField ?? ''} options={emails} onChange={(id) => setReply({ emailField: id })} />
            <Field label="Subject" hint="{formName} and {field:question-id} are filled in">
              <Input value={reply.subject ?? ''} placeholder="Thank you — {formName}" maxLength={200} onChange={(e) => setReply({ subject: e.target.value })} />
            </Field>
            <Field label="Message" hint="plain text; a blank line starts a new paragraph">
              <Textarea rows={6} value={reply.body ?? ''} maxLength={6000} onChange={(e) => setReply({ body: e.target.value })} />
            </Field>
            <p className="m-0 text-[13px] text-smoke">At most three replies a day go to any one address, so the form cannot be used to fill somebody else’s inbox.</p>
          </>
        )}
      </Fold>

      <Fold title="After sending" summary={after.redirect ? `opens ${after.redirect}` : 'shows the thank-you message'}>
        <AfterFields value={after} onChange={(next) => set({ ...props, after: next })} />
      </Fold>

      <Fold title="Hidden fields" summary={hidden.length ? `${hidden.length}` : 'none'}>
        <p className="m-0 text-[13px] text-smoke">
          Stored with each submission and shown in the email and the export. Campaign values are the ones the visitor arrived with, even if they filled in the form pages later.
        </p>
        {hidden.map((row, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
            <Field label="Name">
              <Input value={row.name} maxLength={40} placeholder="utm_source" onChange={(e) => setHidden(hidden.map((h, j) => (j === i ? { ...h, name: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') } : h)))} />
            </Field>
            <Field label="Value from">
              <Select value={row.source} onChange={(e) => setHidden(hidden.map((h, j) => (j === i ? { ...h, source: e.target.value as HiddenSource } : h)))}>
                {HIDDEN_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {HIDDEN_SOURCE_LABELS[source]}
                  </option>
                ))}
              </Select>
            </Field>
            {row.source === 'static' ? (
              <Field label="Value">
                <Input value={row.value ?? ''} maxLength={200} onChange={(e) => setHidden(hidden.map((h, j) => (j === i ? { ...h, value: e.target.value } : h)))} />
              </Field>
            ) : (
              <span />
            )}
            <AdminButton type="button" variant="ghost" onClick={() => setHidden(hidden.filter((_, j) => j !== i))}>
              Remove
            </AdminButton>
          </div>
        ))}
        {hidden.length < 12 && (
          <div>
            <AdminButton
              type="button"
              variant="secondary"
              onClick={() => {
                const next = HIDDEN_SOURCES.find((source) => source !== 'static' && !hidden.some((h) => h.source === source)) ?? 'static';
                setHidden([...hidden, { name: next === 'static' ? '' : next, source: next, value: '' }]);
              }}
            >
              Add hidden field
            </AdminButton>
          </div>
        )}
      </Fold>

      <Fold title="Bot protection" summary={captcha === 'inherit' ? 'as the site is set' : captcha === 'on' ? 'always on' : 'off'}>
        <Field label="CAPTCHA" hint="the provider and keys are under Security → Bot protection">
          <Select value={captcha} onChange={(e) => set({ ...props, captcha: e.target.value })}>
            <option value="inherit">As set for form blocks on the Security screen</option>
            <option value="on">Always on this form</option>
            <option value="off">Off on this form</option>
          </Select>
        </Field>
      </Fold>
    </div>
  );
}
