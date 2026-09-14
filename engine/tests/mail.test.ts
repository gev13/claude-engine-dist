import { describe, expect, it } from 'vitest';
import { MAIL_DEFAULTS, canSend, mailSettingsSchema, whyNotSending } from '../src/lib/mail';
import { SECRET_MASK, decryptSecret, encryptSecret, isEncrypted, nextSecret } from '../src/server/security/secrets';
import {
  notificationEmail,
  passwordResetEmail,
  securityAlertEmail,
  testEmail,
  welcomeEmail,
} from '../src/server/mail/templates';

const brand = { siteName: 'Studio North', siteUrl: 'https://example.com' };

describe('settings secrets', () => {
  it('come back exactly as they went in', () => {
    const stored = encryptSecret('hunter2 — with spaces, ünicode and :colons:');
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('hunter2');
    expect(decryptSecret(stored)).toBe('hunter2 — with spaces, ünicode and :colons:');
  });

  it('never produce the same ciphertext twice', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('refuse anything altered, foreign or missing', () => {
    const stored = encryptSecret('secret');
    const [prefix, iv, tag, body] = stored.split(':');
    const swapped = [prefix, iv, tag, Buffer.from('tampered').toString('base64url')].join(':');
    expect(decryptSecret(swapped)).toBeNull();
    // One flipped character in the ciphertext, which the tag catches.
    const flipped = [prefix, iv, tag, `${body!.slice(0, -1)}${body!.endsWith('A') ? 'B' : 'A'}`].join(':');
    expect(decryptSecret(flipped)).toBeNull();
    expect(decryptSecret('plain text')).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it('keep, replace or clear a stored password the way the form expects', () => {
    const existing = encryptSecret('old');
    // Untouched field, or the mask sent back unchanged.
    expect(nextSecret(undefined, existing)).toBe(existing);
    expect(nextSecret(SECRET_MASK, existing)).toBe(existing);
    // Cleared on purpose.
    expect(nextSecret('', existing)).toBe('');
    // Replaced.
    const replaced = nextSecret('new', existing);
    expect(decryptSecret(replaced)).toBe('new');
    // Nothing stored yet and nothing typed.
    expect(nextSecret(undefined, '')).toBe('');
  });
});

describe('mail settings', () => {
  it('start switched off and send nothing', () => {
    expect(MAIL_DEFAULTS.enabled).toBe(false);
    expect(canSend(MAIL_DEFAULTS)).toBe(false);
    expect(whyNotSending(MAIL_DEFAULTS)).toBe('Sending is switched off.');
  });

  it('say which piece is missing, in order', () => {
    const on = { ...MAIL_DEFAULTS, enabled: true };
    expect(whyNotSending(on)).toBe('No SMTP server is set.');
    expect(whyNotSending({ ...on, host: 'smtp.example.com' })).toBe('No “from” address is set.');
    const complete = { ...on, host: 'smtp.example.com', fromEmail: 'hello@example.com' };
    expect(whyNotSending(complete)).toBeNull();
    expect(canSend(complete)).toBe(true);
  });

  it('accept a stored row and fill in what it does not carry', () => {
    const parsed = mailSettingsSchema.parse({ host: 'smtp.example.com', port: '465', secure: true });
    expect(parsed.port).toBe(465);
    expect(parsed.events).toEqual({ enquiry: true, formSubmission: true, newsletter: false, security: true, engineUpdate: true });
    expect(parsed.notifyEmails).toEqual([]);
  });

  it('refuse more than five notification addresses and any that is not one', () => {
    const many = Array.from({ length: 6 }, (_, i) => `person${i}@example.com`);
    expect(mailSettingsSchema.safeParse({ notifyEmails: many }).success).toBe(false);
    expect(mailSettingsSchema.safeParse({ notifyEmails: ['not an address'] }).success).toBe(false);
  });
});

describe('email templates', () => {
  const every = [
    welcomeEmail({ ...brand, name: 'Sam', email: 'sam@example.com', signInUrl: 'https://example.com/admin/login' }),
    passwordResetEmail({ ...brand, name: 'Sam', resetUrl: 'https://example.com/admin/reset?token=abc', minutes: 30, ip: '203.0.113.9', when: 'Mon, 14 Sep 2026 10:00:00 GMT' }),
    securityAlertEmail({ ...brand, kind: 'accountLocked', summary: 'An account was locked.', facts: [['Username', 'sam']], adminUrl: 'https://example.com/admin/security' }),
    notificationEmail({ ...brand, title: 'New contact enquiry', intro: 'Somebody wrote in.', facts: [['From', 'Sam']], body: 'Hello there', adminUrl: 'https://example.com/admin/enquiries', adminLabel: 'Open enquiries' }),
    testEmail({ ...brand, by: 'sam@example.com', when: 'Mon, 14 Sep 2026 10:00:00 GMT' }),
  ];

  it('all carry a subject and both bodies', () => {
    for (const message of every) {
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.html).toContain('<!doctype html>');
      expect(message.text.length).toBeGreaterThan(0);
      // No external anything: mail clients block it and it leaks who opened.
      expect(message.html).not.toMatch(/<img|<script|https:\/\/fonts|cid:/);
    }
  });

  it('escape whatever a person put in their name', () => {
    const message = welcomeEmail({
      ...brand,
      name: '<script>alert(1)</script>',
      email: 'sam@example.com',
      signInUrl: 'https://example.com/admin/login',
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });

  it('put the link in the text part too, for a client that shows no HTML', () => {
    const reset = passwordResetEmail({ ...brand, name: '', resetUrl: 'https://example.com/r/xyz', minutes: 30, ip: '203.0.113.9', when: 'now' });
    expect(reset.text).toContain('https://example.com/r/xyz');
    expect(reset.subject).toContain('Studio North');
  });

  it('name the site in a security alert subject, so a filter can catch it', () => {
    const alert = securityAlertEmail({ ...brand, kind: 'failedLogins', summary: 'Five failures.', facts: [['IP', '203.0.113.9']], adminUrl: 'https://example.com/admin/security' });
    expect(alert.subject).toBe('[Studio North] Repeated failed sign-ins');
    expect(alert.text).toContain('203.0.113.9');
  });
});
