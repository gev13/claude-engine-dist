# Tracking, consent, bot protection and form routing

Since 2.16. Everything here is off until an administrator switches it on; a
site that updates and changes nothing loads exactly what it loaded before.

## Integrations — Settings → Integrations

Tracking and marketing tags as an id and a switch each: Google Tag Manager,
Google Analytics 4, Google Ads, Meta Pixel, LinkedIn Insight, Yandex Metrica,
Microsoft Clarity, Hotjar and TikTok Pixel. The engine writes each vendor's
own loader — you never paste their code — and checks every id against the
vendor's format before it is saved and again before it is used.

- **Consent category.** Each tag belongs to one: necessary, analytics,
  marketing or preferences. With the cookie notice asking for consent, a tag
  waits until its category is granted.
- **Google Consent Mode v2.** Optional. Google's tags load before consent with
  storage *denied* (cookieless pings only), and switch to *granted* when a
  visitor agrees.
- **Google Ads conversions** are listed by name here, and a form picks one by
  that name.
- **Extra origins.** A tag that loads from somewhere unusual can add hosts to
  the site's content policy — `https://host` or `https://*.host` only.
- **Custom snippets** (up to ten) are arbitrary script, so they stay hidden
  until *Allow custom scripts* is ticked. Each has a place (head, start or end
  of body), the pages it runs on (`/*`, `/blog/*`, …), a consent category and
  the origins it needs.

A GA4 id saved under the old *Custom code* screen keeps working and shows up
here; saving Integrations moves it. *Custom code* is now *Custom CSS*.

Everything is loaded by one script, `/integrations.js`, from the site's own
origin. It also follows client-side navigation, so page views are counted as
people move around the site.

## The content policy

The public site's Content-Security-Policy is built for every request from
what is switched on: each tag's hosts, each snippet's origins, the CAPTCHA
provider. Nothing else can load. The Security screen lists every third party
and its hosts.

## Cookie consent — Settings → Cookie notice

The notice has two modes:

- **Notice** — what it was before 2.16: a message with an OK.
- **Ask for consent** — Accept all and Reject all, equally prominent, and a
  *Preferences* dialog with a switch per category (necessary is always on).
  Categories, their names and descriptions, the button labels and how many
  months an answer lasts are all editable.

The answer is stored in a first-party cookie, `he_consent`. Changing the
categories on offer, or pressing *Ask everyone again*, asks every visitor
afresh. Withdrawing consent removes the known cookies of that category's
tags (`_ga*`, `_fbp`, `_ym*`, `li_*`, …) where the browser allows it.

**Only where required** asks only visitors whose country requires consent
(the EU/EEA, the UK and Switzerland). The country comes from your CDN's
header (`CF-IPCountry` on Cloudflare, `X-Vercel-IP-Country` on Vercel);
without one, everybody is asked.

**Keep an anonymous count** records, per day, how many visitors accepted,
rejected or chose — no address, no id, nothing that identifies anyone.

A link to `#cookie-settings` anywhere on the site reopens the notice.

## Bot protection — Security → Bot protection

Every public form already has a hidden trap for bots and a rate limit. A
challenge adds a check in front of them: **Cloudflare Turnstile**, **Google
reCAPTCHA v2** (the tick box), **reCAPTCHA v3** (a score — choose the
threshold) or **hCaptcha**.

- The site key is public; the secret key is kept encrypted and never shown
  again. *Use the provider's test keys* fills in keys that always pass, for
  trying it out.
- Choose which forms it protects: form blocks, the contact form, newsletter
  sign-ups and job applications. A form block can override that in its own
  settings (*Bot protection*).
- The widget loads only when a form is about to be seen.
- **When the provider cannot be reached** a submission is let through on the
  trap and the rate limit alone, unless *Refuse submissions…* is ticked. A
  secret the server can no longer decrypt is treated the same way, and the
  screen says so.

## Form blocks — what happens when one is sent

A form block's settings, under its questions:

- **Email.** Up to ten addresses (or the site's notification list), a subject
  with `{formName}` and `{field:question-id}`, and *Reply-To* set to the
  visitor's email question. *Put every answer in the email* sends the answers
  as a table — off by default, because they are personal data. Files are
  always a link into the admin, never an attachment. The hidden fields and
  (optionally) the IP address can be added.
- **Reply to the visitor.** An automatic reply to the address in an email
  question, with its own subject and text. At most three a day reach any one
  address, so the form cannot be used to fill somebody else's inbox.
- **After sending.** Open a page — a thank-you page for an advertising
  conversion — and tell the site's tags: an event (`generate_lead` by
  default, which Meta hears as `Lead`), a Google Ads conversion, a Yandex
  goal, a LinkedIn conversion id. The contact form has the same options.
- **Hidden fields.** Up to twelve, each a fixed value or one of: the campaign
  parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
  `utm_content`), `gclid`, `fbclid`, the referrer, the landing page or this
  page. Campaign values are the ones the visitor *arrived* with, even if they
  fill the form in pages later. They are stored with the submission, shown in
  Form submissions and the email, and exported as extra columns.
- **Show only when…** Any question can depend on an earlier answer: "Company
  size" only when "I am" is "A business". A question that is not shown is not
  required and not stored — the server applies the same rule.

## Webhooks — Enquiries → Webhooks

Administrators only. Up to ten receivers — a CRM, Zapier, Make — each an
https address, the events it wants (form blocks, the contact form) and
optionally only some forms by name.

Each delivery is a POST of JSON:

```json
{ "id": "<delivery id>", "event": "form.submitted", "createdAt": "…", "site": "https://example.com",
  "data": { "submissionId": "…", "formName": "Quote", "page": "/contact", "receivedAt": "…",
            "answers": [{ "id": "email", "label": "Email", "value": "…" }],
            "hidden": { "utm_source": "google" } } }
```

with the headers `X-Engine-Event`, `X-Engine-Delivery`, `X-Engine-Timestamp`
and, when a secret is set, `X-Engine-Signature`: `sha256=` and the hex
HMAC-SHA256 of `<timestamp>.<raw body>` keyed with the secret. Compare it in
constant time and refuse a timestamp more than five minutes old.

Deliveries are tried three times (at once, after ten seconds, after a
minute), logged for thirty days on the screen, and can be resent. The log
never keeps the payload. The server refuses addresses that resolve to a
private or local network, and does not follow redirects.
