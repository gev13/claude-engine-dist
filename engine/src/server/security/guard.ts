import 'server-only';
import { tooMany } from '@/server/api/respond';
import { isIpBlocked, noteLimiterBreach } from './blocklist';

/* ═══════════════════════════════════════════════════════════════════════════
   The door (package 5)
   ───────────────────────────────────────────────────────────────────────────
   Two lines every public endpoint says before it does any work: is this
   address refused, and does this refusal count towards refusing it.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A response when the address is blocked, or null to carry on. The message
 * says nothing about why or for how long — an attacker learns nothing, and a
 * person who has been blocked by mistake has somebody to ask.
 */
export async function refuseIfBlocked(ip: string): Promise<Response | null> {
  if (!(await isIpBlocked(ip))) return null;
  return new Response(JSON.stringify({ error: 'This address cannot use this form. Get in touch if that seems wrong.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The answer to give when a rate limit has been hit, counting the refusal
 * towards an automatic block first. `what` names the limit for the record.
 */
export async function refuseRateLimited(ip: string, what: string, retryAfter: number, message?: string): Promise<Response> {
  await noteLimiterBreach(ip, what);
  return message ? tooMany(retryAfter, message) : tooMany(retryAfter);
}
