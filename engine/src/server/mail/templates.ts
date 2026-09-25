import 'server-only';

/* ═══════════════════════════════════════════════════════════════════════════
   Email templates (package 5)
   ───────────────────────────────────────────────────────────────────────────
   Plain, self-contained HTML with a text part beside it: no external images,
   no web fonts, no tracking. Mail clients are not browsers — the styling is
   inline, the layout is a single column, and every message reads perfectly
   well as text alone.

   Every template returns the subject and both bodies; the sender adds the
   envelope. Nothing here reaches the database or the network.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Message = { subject: string; html: string; text: string };

export type Brand = { siteName: string; siteUrl: string };

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One shared shell, so every message looks like it came from the same place. */
function shell(brand: Brand, heading: string, body: string, footNote?: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:24px;background:#f4f3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#201e1d;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e0dc;border-radius:12px;">
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 20px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#6f6a65;">${esc(brand.siteName)}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;">${esc(heading)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:8px 28px 26px;">
      <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #e3e0dc;font-size:12px;line-height:1.6;color:#6f6a65;">
        ${footNote ? `${esc(footNote)}<br>` : ''}Sent by <a href="${esc(brand.siteUrl)}" style="color:#c0341a;">${esc(brand.siteName)}</a>.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

const p = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;">${text}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0;"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;background:#c0341a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${esc(label)}</a></p>` +
  `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#6f6a65;word-break:break-all;">Or paste this into your browser:<br>${esc(href)}</p>`;

/** Label/value rows — the facts in a security alert or a notification. */
function factTable(facts: [string, string][]): string {
  const rows = facts
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 14px 6px 0;font-size:13px;color:#6f6a65;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;">${esc(value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">${rows}</table>`;
}

const factLines = (facts: [string, string][]) => facts.map(([label, value]) => `${label}: ${value}`).join('\n');

/* ── The messages ─────────────────────────────────────────────────────────── */

export function welcomeEmail(input: Brand & { name: string; email: string; signInUrl: string; invitedBy?: string }): Message {
  const greeting = input.name ? `Hello ${input.name},` : 'Hello,';
  const who = input.invitedBy ? ` by ${input.invitedBy}` : '';
  return {
    subject: `Your account on ${input.siteName}`,
    html: shell(
      input,
      'Your account is ready',
      p(esc(greeting)) +
        p(`An account was created for you${esc(who)} on <strong>${esc(input.siteName)}</strong>.`) +
        factTable([['Sign in with', input.email]]) +
        p('Use the password you were given, and change it once you are in. You will be asked to set up two-factor authentication on your first sign-in — keep the recovery codes somewhere safe.') +
        button(input.signInUrl, 'Sign in'),
      'If you were not expecting this, tell whoever runs the site.',
    ),
    text: `${greeting}

An account was created for you${who} on ${input.siteName}.

Sign in with: ${input.email}
Sign in: ${input.signInUrl}

Use the password you were given, and change it once you are in. You will be asked to set up two-factor authentication on your first sign-in — keep the recovery codes somewhere safe.

If you were not expecting this, tell whoever runs the site.`,
  };
}

export function passwordResetEmail(
  input: Brand & { name: string; resetUrl: string; minutes: number; ip: string; when: string },
): Message {
  const greeting = input.name ? `Hello ${input.name},` : 'Hello,';
  return {
    subject: `Reset your password on ${input.siteName}`,
    html: shell(
      input,
      'Reset your password',
      p(esc(greeting)) +
        p(`Someone asked to reset the password for your account on <strong>${esc(input.siteName)}</strong>. The link works once and expires in ${input.minutes} minutes.`) +
        button(input.resetUrl, 'Choose a new password') +
        factTable([
          ['Requested', input.when],
          ['From IP', input.ip],
        ]) +
        p('If this was not you, ignore this message — your password has not changed.'),
      'Nobody can see your current password; it is stored only as a hash.',
    ),
    text: `${greeting}

Someone asked to reset the password for your account on ${input.siteName}. The link works once and expires in ${input.minutes} minutes.

${input.resetUrl}

Requested: ${input.when}
From IP: ${input.ip}

If this was not you, ignore this message — your password has not changed.`,
  };
}

export type SecurityAlertKind = 'failedLogins' | 'accountLocked' | 'ipBlocked' | 'newLocation' | 'passwordChanged' | 'twoFactorChanged';

const ALERT_HEADINGS: Record<SecurityAlertKind, string> = {
  failedLogins: 'Repeated failed sign-ins',
  accountLocked: 'An account has been locked',
  ipBlocked: 'An address has been blocked',
  newLocation: 'A sign-in from a new address',
  passwordChanged: 'A password was changed',
  twoFactorChanged: 'Two-factor authentication changed',
};

export function securityAlertEmail(
  input: Brand & { kind: SecurityAlertKind; summary: string; facts: [string, string][]; adminUrl: string },
): Message {
  const heading = ALERT_HEADINGS[input.kind];
  return {
    subject: `[${input.siteName}] ${heading}`,
    html: shell(
      input,
      heading,
      p(esc(input.summary)) +
        factTable(input.facts) +
        button(input.adminUrl, 'Open the security screen') +
        p('Blocked addresses and locked accounts can be released there.'),
      'You are receiving this because security alerts are switched on in Email settings.',
    ),
    text: `${heading}

${input.summary}

${factLines(input.facts)}

Security screen: ${input.adminUrl}

You are receiving this because security alerts are switched on in Email settings.`,
  };
}

export function notificationEmail(
  input: Brand & { title: string; intro: string; facts: [string, string][]; body?: string; adminUrl: string; adminLabel: string },
): Message {
  return {
    subject: `[${input.siteName}] ${input.title}`,
    html: shell(
      input,
      input.title,
      p(esc(input.intro)) +
        factTable(input.facts) +
        (input.body ? p(esc(input.body).replace(/\n/g, '<br>')) : '') +
        button(input.adminUrl, input.adminLabel),
      'You are receiving this because you are listed for notifications in Email settings.',
    ),
    text: `${input.title}

${input.intro}

${factLines(input.facts)}
${input.body ? `\n${input.body}\n` : ''}
${input.adminLabel}: ${input.adminUrl}`,
  };
}

/**
 * A form block's submission (2.16). With `answers` it carries every answer
 * as a table — the form asked for that in its Email settings; without, it is
 * the count-only notice every form sent before. A file is a link into the
 * admin, never an attachment: the file stays on the server.
 */
export function formSubmissionEmail(
  input: Brand & {
    subject: string;
    formName: string;
    source: string;
    received: string;
    count: number;
    answers: { label: string; value: string; link?: string }[] | null;
    meta: [string, string][];
    adminUrl: string;
    /** The form has recipients of its own, rather than the Email screen's list. */
    ownRecipients?: boolean;
  },
): Message {
  // A form that asked for nothing new sends exactly the notice it sent before 2.16.
  if (!input.answers && input.meta.length === 0 && !input.ownRecipients) {
    return notificationEmail({
      ...input,
      title: input.subject,
      intro: 'Somebody filled in a form on the site. The answers are in the admin, not in this email.',
      facts: [
        ['Form', input.formName],
        ['Page', input.source || '—'],
        ['Answers', String(input.count)],
        ['Received', input.received],
      ],
      adminUrl: input.adminUrl,
      adminLabel: 'Read the answers',
    });
  }
  const facts: [string, string][] = [
    ['Form', input.formName],
    ['Page', input.source || '—'],
    ...(input.answers ? [] : ([['Answers', String(input.count)]] as [string, string][])),
    ['Received', input.received],
  ];
  const answerRows = (input.answers ?? [])
    .map(
      (answer) =>
        `<tr><td style="padding:8px 14px 8px 0;font-size:13px;color:#6f6a65;vertical-align:top;border-top:1px solid #efece8;">${esc(answer.label)}</td>` +
        `<td style="padding:8px 0;font-size:14px;border-top:1px solid #efece8;">${
          answer.link ? `<a href="${esc(answer.link)}" style="color:#c0341a;">${esc(answer.value)}</a>` : esc(answer.value).replace(/\n/g, '<br>')
        }</td></tr>`,
    )
    .join('');
  const answersHtml = input.answers
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 18px;">${answerRows}</table>`
    : '';
  const metaHtml = input.meta.length ? `<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#6f6a65;">Details</p>${factTable(input.meta)}` : '';

  const answersText = input.answers ? `\n${input.answers.map((a) => `${a.label}: ${a.value}${a.link ? ` (${a.link})` : ''}`).join('\n')}\n` : '';
  const metaText = input.meta.length ? `\nDetails\n${factLines(input.meta)}\n` : '';

  return {
    subject: `[${input.siteName}] ${input.subject}`,
    html: shell(
      input,
      input.subject,
      p(esc(input.answers ? 'Somebody filled in a form on the site. Their answers are below and in the admin.' : 'Somebody filled in a form on the site. The answers are in the admin, not in this email.')) +
        factTable(facts) +
        answersHtml +
        metaHtml +
        button(input.adminUrl, 'Read the answers'),
      input.ownRecipients
        ? 'You are receiving this because you are listed for this form’s notifications.'
        : 'You are receiving this because you are listed for notifications in Email settings.',
    ),
    text: `${input.subject}

${factLines(facts)}
${answersText}${metaText}
Read the answers: ${input.adminUrl}`,
  };
}

/**
 * The reply a visitor gets after sending a form (2.16). Plain text written in
 * the form's settings, blank lines as paragraphs, every value escaped — the
 * answers filled into it came from the public internet.
 */
export function autoresponderEmail(input: Brand & { subject: string; body: string }): Message {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);
  return {
    subject: input.subject,
    html: shell(
      input,
      input.subject,
      paragraphs.map((para) => p(esc(para).replace(/\n/g, '<br>'))).join(''),
      `You are receiving this because you sent a form on ${input.siteName}.`,
    ),
    text: `${paragraphs.join('\n\n')}\n\n—\n${input.siteName}\n${input.siteUrl}`,
  };
}

export function testEmail(input: Brand & { by: string; when: string }): Message {
  return {
    subject: `[${input.siteName}] Test message`,
    html: shell(
      input,
      'Your email settings work',
      p('This is a test from the Email screen. If you are reading it, the engine can send mail with the settings you saved.') +
        factTable([
          ['Sent by', input.by],
          ['Sent at', input.when],
        ]),
    ),
    text: `Your email settings work.

This is a test from the Email screen. If you are reading it, the engine can send mail with the settings you saved.

Sent by: ${input.by}
Sent at: ${input.when}`,
  };
}
