/* ═══════════════════════════════════════════════════════════════════════════
   /.well-known/security.txt (RFC 9116, 3.32)
   ───────────────────────────────────────────────────────────────────────────
   Where to report a vulnerability, written from five Settings fields with
   `Canonical` filled in from the site's address.

   Off until filled in, like every other door: with no contact, no expiry, or
   an expiry that has passed, the route answers 404. A stale file is worse
   than none — it advertises a channel nobody is watching — so the screen
   warns before the date and the route stops serving after it.

   Pure, so the route and the Settings screen's warnings are one function.
   Every value lands in a plain-text file, so each is checked against its own
   grammar here, and a line break can never start a second field.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SECURITY_TXT_PATH = '/.well-known/security.txt';

export type SecurityTxtInput = {
  contact?: string[];
  expires?: string;
  languages?: string[];
  encryption?: string;
  policy?: string;
};

/** RFC 9116 asks for an expiry less than a year ahead. */
const YEAR_MS = 366 * 86_400_000;

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
const HTTPS = /^https:\/\/[^\s<>"]+$/;
const TEL = /^tel:\+?[0-9().\- ]{4,30}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** RFC 9116 §2.5.4: a key at an https address, in DNS, or by its OpenPGP fingerprint. */
const KEY_URI = /^(https:\/\/[^\s<>"]+|dns:[^\s<>"]+|openpgp4fpr:[0-9A-Fa-f]{16,64})$/;

/** No control characters at all: a line break would start a field of its own. */
const plain = (value: string) => !/[\x00-\x1f\x7f]/.test(value);

/** A contact as the file writes it: an email address becomes `mailto:`. */
export function contactUri(value: string): string | null {
  const v = value.trim();
  if (!v || !plain(v)) return null;
  if (EMAIL.test(v)) return `mailto:${v}`;
  if (/^mailto:/i.test(v) && EMAIL.test(v.slice(7))) return `mailto:${v.slice(7)}`;
  if (HTTPS.test(v) || TEL.test(v)) return v;
  return null;
}

/**
 * The expiry as an instant: a date alone means the end of that day (UTC), so
 * "2027-10-31" is good through the 31st everywhere.
 */
export function expiryOf(value: string | undefined): Date | null {
  const v = (value ?? '').trim();
  if (!v || !plain(v)) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!dateOnly && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const date = new Date(dateOnly ? `${v}T23:59:59.000Z` : v);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type SecurityTxtState =
  | { serving: true; body: string; notes: string[] }
  | { serving: false; reason: string; notes: string[] };

/**
 * The file, or why there is none. `notes` are what the screen shows: values
 * left out because they are not addresses, and an expiry that is near or
 * further than the RFC's year.
 */
export function securityTxt(input: SecurityTxtInput, siteUrl: string, now: Date = new Date()): SecurityTxtState {
  const notes: string[] = [];
  const contacts: string[] = [];
  for (const raw of input.contact ?? []) {
    const uri = contactUri(raw);
    if (uri) contacts.push(uri);
    else if (raw.trim()) notes.push(`“${raw.trim()}” is left out — a contact is an email address, an https:// page or tel:+…`);
  }

  const expires = expiryOf(input.expires);
  if ((input.expires ?? '').trim() && !expires) notes.push('The expiry is not a date — write it as 2027-10-31.');

  if (contacts.length === 0) return { serving: false, reason: 'Nothing is served until there is a contact.', notes };
  if (!expires) return { serving: false, reason: 'Nothing is served without an expiry date — RFC 9116 requires one.', notes };
  if (expires.getTime() <= now.getTime()) {
    return {
      serving: false,
      reason: `The expiry date (${expires.toISOString().slice(0, 10)}) has passed, so the file is no longer served — a stale one advertises a channel nobody is watching. Set a new date.`,
      notes,
    };
  }
  const left = expires.getTime() - now.getTime();
  if (left > YEAR_MS) notes.push('RFC 9116 recommends an expiry less than a year ahead, so the file is reviewed at least yearly.');
  else if (left < 30 * 86_400_000) notes.push(`It expires on ${expires.toISOString().slice(0, 10)} — set a later date before then, or the file stops being served.`);

  const languages = (input.languages ?? []).map((l) => l.trim()).filter((l) => LANGUAGE.test(l));
  const encryption = (input.encryption ?? '').trim();
  const policy = (input.policy ?? '').trim();
  if (encryption && !KEY_URI.test(encryption)) notes.push('The encryption key is left out — give an https:// address of the key, dns:… or openpgp4fpr:….');
  if (policy && !HTTPS.test(policy)) notes.push('The policy is left out — give an https:// address.');

  const lines = [
    ...contacts.map((uri) => `Contact: ${uri}`),
    `Expires: ${expires.toISOString()}`,
    ...(encryption && KEY_URI.test(encryption) ? [`Encryption: ${encryption}`] : []),
    ...(languages.length ? [`Preferred-Languages: ${languages.join(', ')}`] : []),
    `Canonical: ${siteUrl.replace(/\/+$/, '')}${SECURITY_TXT_PATH}`,
    ...(policy && HTTPS.test(policy) ? [`Policy: ${policy}`] : []),
  ];
  return { serving: true, body: `${lines.join('\n')}\n`, notes };
}
