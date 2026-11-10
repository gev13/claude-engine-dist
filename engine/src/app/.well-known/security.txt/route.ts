import { SITE_URL } from '@/lib/env';
import { securityTxt } from '@/lib/securityTxt';
import { getSiteSettings } from '@/server/content/siteSettings';

/* 3.32 — RFC 9116. Read on every request rather than cached, so an expiry
   that passes stops the file at once instead of at the next revalidation. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSiteSettings();
  const state = securityTxt(
    { contact: s.securityContact, expires: s.securityExpires, languages: s.securityLanguages, encryption: s.securityEncryption, policy: s.securityPolicy },
    SITE_URL,
  );
  if (!state.serving) return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(state.body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
