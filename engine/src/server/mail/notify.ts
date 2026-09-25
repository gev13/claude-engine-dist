import 'server-only';
import { SITE_URL } from '@/lib/env';
import { canSend } from '@/lib/mail';
import { getMailSettings, mailBrand, notifyRecipients, sendInBackground } from './send';
import { type Answer, answerLine, emailAnswer, fillTemplate } from '@/lib/forms';
import type { blockSchemas } from '@/lib/blocks';
import { rateLimit } from '@/server/auth/rateLimit';
import { type SecurityAlertKind, autoresponderEmail, formSubmissionEmail, notificationEmail, securityAlertEmail, welcomeEmail } from './templates';

type FormProps = ReturnType<(typeof blockSchemas)['form']['parse']>;
type FormNotify = FormProps['notify'];
type FormAutoresponder = FormProps['autoresponder'];

/* ═══════════════════════════════════════════════════════════════════════════
   Notifications (package 5)
   ───────────────────────────────────────────────────────────────────────────
   The engine's own messages, each behind its switch on the Email screen. They
   are started and not waited for: a visitor's enquiry is stored and answered
   whether or not the notification reaches anybody.

   Answers and enquiry details follow the same rule as the audit log — an
   email says what arrived and where to read it, and personal data stays in
   the admin rather than travelling through a mail relay.
   ═══════════════════════════════════════════════════════════════════════════ */

const adminUrl = (path: string) => `${SITE_URL}${path}`;

const when = () => new Date().toUTCString();

/**
 * Tell somebody an account has been made for them. Not behind an event
 * switch: an account nobody knows about is worse than an unwanted email. The
 * password is never in it — whoever created the account passes that on.
 */
export function sendWelcome(input: { name: string; email: string; invitedBy?: string }): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!canSend(mail)) return null;
    const brand = await mailBrand();
    const message = welcomeEmail({
      ...brand,
      name: input.name,
      email: input.email,
      signInUrl: `${SITE_URL}/admin/login`,
      invitedBy: input.invitedBy,
    });
    return { message: { ...message, to: input.email }, event: 'welcome' };
  });
}

/**
 * A newer engine exists (package 6). Sent once per version: the version is
 * marked announced only after the message actually leaves, so a relay that is
 * down means a retry on the next check rather than a notice nobody got.
 */
export function notifyEngineUpdate(input: {
  version: string;
  date?: string;
  summary?: string;
  url?: string;
  behind: number;
  requiresMigration: boolean;
  markAnnounced: (version: string) => Promise<void>;
}): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!mail.events.engineUpdate) return null;
    const to = await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const message = notificationEmail({
      ...brand,
      title: `Engine ${input.version} is available`,
      intro:
        input.behind > 1
          ? `This site is ${input.behind} releases behind. The newest is ${input.version}.`
          : `A new version of the engine has been released. This site is on an older one.`,
      facts: [
        ['New version', input.version],
        ...(input.date ? ([['Released', input.date]] as [string, string][]) : []),
        ['Database changes', input.requiresMigration ? 'Yes — migrations run during the update' : 'No'],
        ...(input.url ? ([['Release notes', input.url]] as [string, string][]) : []),
      ],
      body: input.summary,
      adminUrl: adminUrl('/admin/updates'),
      adminLabel: 'Open updates',
    });

    // The marker is set by the send path, after the message has gone.
    await input.markAnnounced(input.version);
    return { message: { ...message, to }, event: 'engine update' };
  });
}

/** A new contact enquiry. The sender's address becomes the reply-to. */
export function notifyEnquiry(input: { name: string; email: string; company: string; message: string; ip: string }): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!mail.events.enquiry) return null;
    const to = await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const message = notificationEmail({
      ...brand,
      title: 'New contact enquiry',
      intro: `${input.name} sent an enquiry through the site. Reply to this message to answer them directly.`,
      facts: [
        ['From', input.name],
        ['Email', input.email],
        ...(input.company ? ([['Company', input.company]] as [string, string][]) : []),
        ['Received', when()],
      ],
      body: input.message,
      adminUrl: adminUrl('/admin/enquiries'),
      adminLabel: 'Open contact enquiries',
    });
    return { message: { ...message, to, replyTo: input.email }, event: 'enquiry' };
  });
}

/**
 * A new form submission. The form's own Email settings (2.16) decide who
 * hears, what the subject says, and whether the answers travel: without
 * `includeAnswers` the message is the count-only notice it always was, and
 * the answers stay in the admin.
 */
export function notifyFormSubmission(input: {
  submissionId: string;
  formName: string;
  source: string;
  answers: Answer[];
  meta: Record<string, string>;
  ip: string;
  notify: FormNotify;
}): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    const own = input.notify.recipients;
    // A form with its own recipients asked for mail; the site-wide list follows the event switch.
    if (own.length === 0 && !mail.events.formSubmission) return null;
    const to = own.length > 0 ? own : await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const fallback = `New submission to “${input.formName}”`;
    const subject = (input.notify.subject ? fillTemplate(input.notify.subject, input.formName, input.answers).trim().slice(0, 200) : '') || fallback;
    const meta: [string, string][] = input.notify.includeMeta ? Object.entries(input.meta) : [];
    if (input.notify.includeIp && input.ip && input.ip !== 'unknown') meta.push(['IP address', input.ip]);

    const message = formSubmissionEmail({
      ...brand,
      subject,
      formName: input.formName,
      source: input.source,
      received: when(),
      count: input.answers.length,
      answers: input.notify.includeAnswers
        ? input.answers.map((answer) => ({
            label: answer.label,
            value: answerLine(answer) || '—',
            link: answer.file ? adminUrl(`/api/admin/submissions/${input.submissionId}/file/${answer.id}`) : undefined,
          }))
        : null,
      meta,
      adminUrl: adminUrl('/admin/submissions'),
      ownRecipients: own.length > 0,
    });
    const replyTo = emailAnswer(input.answers, input.notify.replyToField) ?? undefined;
    return { message: { ...message, to, replyTo }, event: 'form submission' };
  });
}

/**
 * The reply a visitor gets (2.16). Only to the address they typed into the
 * form's own email question, and at most three a day to any one address —
 * otherwise a form is a way to make this site email somebody else's inbox
 * with text a stranger chose.
 */
export function sendAutoresponder(input: { formName: string; answers: Answer[]; settings: FormAutoresponder }): void {
  const to = emailAnswer(input.answers, input.settings.emailField);
  if (!input.settings.enabled || !to || !input.settings.body.trim()) return;
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!canSend(mail)) return null;
    const limit = await rateLimit({ key: `autoreply:${to.toLowerCase()}`, limit: 3, windowSec: 86_400, blockSec: 86_400 });
    if (!limit.allowed) return null;
    const brand = await mailBrand();
    const subject = fillTemplate(input.settings.subject || 'Thank you — {formName}', input.formName, input.answers).trim().slice(0, 200);
    const body = fillTemplate(input.settings.body, input.formName, input.answers);
    return { message: { ...autoresponderEmail({ ...brand, subject, body }), to }, event: 'form autoresponder' };
  });
}

/**
 * Somebody applied for a role.
 *
 * The applicant's covering letter and CV stay on the server, like every other
 * notification here: the message says what arrived and where to read it. The
 * name and email *are* included, because whoever watches a careers inbox needs
 * to know who applied without opening the admin — and unlike the enquiry
 * notification there is no reply-to, since replying to a job application is a
 * decision, not a reflex.
 */
export function notifyApplication(input: { jobTitle: string; name: string; email: string; hasCv: boolean }): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!mail.events.application) return null;
    const to = await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const message = notificationEmail({
      ...brand,
      title: `New application for “${input.jobTitle}”`,
      intro: 'Somebody applied through the careers pages. The covering letter and CV are in the admin.',
      facts: [
        ['Role', input.jobTitle],
        ['Applicant', input.name],
        ['Email', input.email],
        ['CV', input.hasCv ? 'Attached' : 'None'],
        ['Received', when()],
      ],
      adminUrl: adminUrl('/admin/applications'),
      adminLabel: 'Read the application',
    });
    return { message: { ...message, to }, event: 'application' };
  });
}

/** A newsletter sign-up. Off by default — a busy list would be noise. */
export function notifyNewsletter(input: { email: string; source: string }): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!mail.events.newsletter) return null;
    const to = await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const message = notificationEmail({
      ...brand,
      title: 'New newsletter sign-up',
      intro: 'Somebody joined the mailing list.',
      facts: [
        ['Email', input.email],
        ['From', input.source || '—'],
        ['Signed up', when()],
      ],
      adminUrl: adminUrl('/admin/newsletter'),
      adminLabel: 'Open newsletter sign-ups',
    });
    return { message: { ...message, to }, event: 'newsletter sign-up' };
  });
}

/**
 * Something worth an administrator's attention: repeated failed sign-ins, a
 * locked account, a blocked address. Sent to the notification addresses, not
 * to the account involved — an attacker must not be able to send mail to
 * somebody by guessing their password wrongly.
 */
export function notifySecurity(input: { kind: SecurityAlertKind; summary: string; facts: [string, string][] }): void {
  sendInBackground(async () => {
    const mail = await getMailSettings();
    if (!mail.events.security) return null;
    const to = await notifyRecipients(mail);
    if (to.length === 0) return null;

    const brand = await mailBrand();
    const message = securityAlertEmail({
      ...brand,
      kind: input.kind,
      summary: input.summary,
      facts: [...input.facts, ['Noticed', when()]],
      adminUrl: adminUrl('/admin/security'),
    });
    return { message: { ...message, to }, event: `security alert (${input.kind})` };
  });
}
