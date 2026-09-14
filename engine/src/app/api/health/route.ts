import { pingDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness plus a database check. Deliberately terse: it is polled by the
 * deploy pipeline and by uptime monitoring, and it must not disclose
 * versions, paths or configuration.
 */
export async function GET() {
  const database = await pingDb();

  return Response.json(
    { status: database ? 'ok' : 'degraded', database },
    {
      status: database ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
