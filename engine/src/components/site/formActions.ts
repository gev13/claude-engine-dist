import { withSlash } from '@/lib/permalinks';
import type { FormHidden, HiddenSource } from '@/lib/forms';

/* ═══════════════════════════════════════════════════════════════════════════
   What a form does in the browser around sending (T13, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Hidden fields read the campaign a visitor arrived with, and "arrived with"
   is the first page of the visit, not this one: somebody who lands from an
   ad on the home page and fills in the form three pages later still came
   from that ad. The first page's parameters are kept in sessionStorage — for
   this tab and this visit only, and only once a form on the site asks for
   them, so a site without hidden fields stores nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOUCH_KEY = 'he-first-touch';
const CAMPAIGN: HiddenSource[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

type Touch = Partial<Record<HiddenSource, string>>;

function current(): Touch {
  const query = new URLSearchParams(window.location.search);
  const touch: Touch = {};
  for (const key of CAMPAIGN) {
    const value = query.get(key);
    if (value) touch[key] = value.slice(0, 300);
  }
  touch.referrer = document.referrer.slice(0, 300);
  touch.landingPage = window.location.pathname.slice(0, 300);
  return touch;
}

/**
 * The visit's first touch: stored the first time it is asked for, and
 * replaced when a later page arrives with a campaign of its own.
 */
export function firstTouch(): Touch {
  const now = current();
  const hasCampaign = CAMPAIGN.some((key) => now[key]);
  try {
    const stored = sessionStorage.getItem(TOUCH_KEY);
    if (stored && !hasCampaign) return JSON.parse(stored) as Touch;
    sessionStorage.setItem(TOUCH_KEY, JSON.stringify(now));
  } catch {
    /* Blocked storage: this page's own parameters are the best there is. */
  }
  return now;
}

/** Remember the landing page as soon as a page with a form is opened, not when it is sent. */
export function noteFirstTouch(): void {
  try {
    if (!sessionStorage.getItem(TOUCH_KEY)) firstTouch();
  } catch {
    /* Nothing to remember in. */
  }
}

/** The values for a form's hidden fields. A static one is sent as saved; the server uses its own copy anyway. */
export function hiddenValues(fields: FormHidden[]): Record<string, string> {
  if (fields.length === 0) return {};
  const touch = firstTouch();
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = field.source === 'static' ? field.value : field.source === 'pageUrl' ? window.location.href.slice(0, 300) : (touch[field.source] ?? '');
    if (value) out[field.name] = value;
  }
  return out;
}

type After = { redirect: string; track: boolean; event: string; adsConversion: string; yandexGoal: string; linkedinConversion: string };

type Tracker = (name: string, options: { params?: Record<string, string>; adsConversion?: string; yandexGoal?: string; linkedinConversion?: string }) => void;

/**
 * After a successful send: the conversion to every tag that is loaded
 * (`heTrack` is defined by /integrations.js, so a site without tags sends
 * nothing), then the thank-you page if there is one. The redirect waits a
 * moment so the tags' own requests leave first.
 */
export function afterSubmit(after: After, formName: string): boolean {
  if (after.track) {
    const track = (window as unknown as { heTrack?: Tracker }).heTrack;
    try {
      track?.(after.event || 'generate_lead', {
        params: { form_name: formName },
        adsConversion: after.adsConversion || undefined,
        yandexGoal: after.yandexGoal || undefined,
        linkedinConversion: after.linkedinConversion || undefined,
      });
    } catch {
      /* A tag's failure is never the visitor's. */
    }
  }
  if (after.redirect && after.redirect.startsWith('/') && !after.redirect.startsWith('//')) {
    const target = withSlash(after.redirect);
    window.setTimeout(() => window.location.assign(target), after.track ? 300 : 0);
    return true;
  }
  return false;
}
