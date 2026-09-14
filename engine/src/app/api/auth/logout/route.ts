import { cookies } from 'next/headers';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { REFRESH_COOKIE, clearAuthCookies, getClaims } from '@/server/auth/session';
import { consumeRefreshToken, revokeFamily } from '@/server/auth/tokens';
import { handle, ok } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revokes the whole session family, not just the current token. */
export async function POST(request: Request) {
  return handle(async () => {
    const claims = await getClaims();
    const raw = (await cookies()).get(REFRESH_COOKIE)?.value;

    if (raw) {
      const outcome = await consumeRefreshToken(raw);
      if (outcome.status === 'ok' || outcome.status === 'reused') {
        await revokeFamily(outcome.familyId);
      }
    } else if (claims?.fam) {
      await revokeFamily(claims.fam);
    }

    await clearAuthCookies();

    if (claims) {
      await audit({
        action: 'auth.logout',
        actorId: claims.sub,
        actorEmail: claims.email,
        ip: clientIp(request.headers),
        summary: 'Signed out',
      });
    }

    return ok({ status: 'ok' as const });
  });
}
