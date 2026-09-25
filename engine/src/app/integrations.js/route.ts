import { CONSENT_COOKIE, REGION_COOKIE, consentVersion } from '@/lib/cookies';
import { getCookieNotice } from '@/server/content/cookies';
import { loaderSource } from '@/server/integrations/loader';
import { getIntegrations } from '@/server/integrations/settings';

export const revalidate = 300;

/* ═══════════════════════════════════════════════════════════════════════════
   /integrations.js — every tag, and the rules for when each may load (2.16)
   ───────────────────────────────────────────────────────────────────────────
   Served from the site's own origin, so it needs `script-src 'self'` and
   nothing more; the vendors it loads are allowed by the policy the
   middleware builds from the same settings. Revalidated whenever the
   integrations or the cookie notice are saved.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET() {
  const [integrations, notice] = await Promise.all([getIntegrations(), getCookieNotice()]);
  const body = loaderSource(integrations, {
    gate: notice.enabled && notice.mode === 'consent',
    version: consentVersion(notice),
    cookie: CONSENT_COOKIE,
    regionRequired: notice.region === 'required',
    regionCookie: REGION_COOKIE,
  });
  return new Response(body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // Short, so switching a tag off reaches browsers in minutes.
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
}
