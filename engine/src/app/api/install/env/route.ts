import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { badRequest, conflict, handle, readJson } from '@/server/api/respond';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { getInstallState } from '@/server/install/status';
import {
  allowAttempt,
  applySchema,
  buildDatabaseUrl,
  checkDatabaseUrl,
  describeDbError,
  generateSecret,
  testConnection,
  writeEnvFile,
} from '@/server/install/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parts = z.object({
  mode: z.literal('parts'),
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65_535).default(5432),
  name: z.string().trim().min(1).max(63),
  user: z.string().trim().min(1).max(63),
  password: z.string().max(200).default(''),
  ssl: z.boolean().default(false),
});

const url = z.object({
  mode: z.literal('url'),
  url: z.string().trim().min(1).max(500),
});

const schema = z.object({
  database: z.discriminatedUnion('mode', [parts, url]),
  siteUrl: z.string().trim().url().max(300).optional(),
});

/**
 * Write .env and apply the schema, before there is anything to authenticate
 * against.
 *
 * This is the second unauthenticated write in the application, and it connects
 * to a host somebody typed — which, left open, is a port scanner. Four things
 * fence it:
 *
 *   1. it refuses once the site is installed, on the same two-fact gate as
 *      POST /api/install;
 *   2. it refuses while the configured database is reachable — a working site
 *      can never have its configuration rewritten through it;
 *   3. it is limited in the process itself. The shared limiter keeps its
 *      counts in Postgres and fails open when it cannot reach it — correct
 *      everywhere else, useless here, since the branch worth limiting is the
 *      one where the database is down by definition;
 *   4. the connect timeout is five seconds, so it cannot be used to probe
 *      slowly for open ports.
 *
 * The submitted password is used and never returned.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    // This one holds when the database is unreachable; the shared limiter
    // below does not, and cannot.
    if (!allowAttempt(ip)) return conflict('Too many attempts. Restart the site to try again.');

    const limit = await rateLimit({ key: `install-env:${ip}`, limit: 10, windowSec: 900, blockSec: 900 });
    if (!limit.allowed) return conflict('Too many attempts. Try again later.');

    const state = await getInstallState();
    if (state.installed) return conflict('This site is already installed.');

    /* ── Reachable already: the schema is the only thing missing ──────────
       Nothing is written to .env — the environment is evidently working — and
       no restart is needed, because the running process is already pointed at
       this database. */
    if (state.databaseReachable) {
      if (state.schemaReady) return conflict('The database is already configured.');

      try {
        await applySchema(env.DATABASE_URL);
      } catch (error) {
        return badRequest(describeDbError(error));
      }

      return NextResponse.json({
        status: 'ok' as const,
        schema: 'applied' as const,
        wroteEnv: false,
        restartRequired: false,
      });
    }

    /* ── Not reachable: take the details, prove them, then write them ───── */

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    let connection: string;
    try {
      connection =
        parsed.data.database.mode === 'url'
          ? checkDatabaseUrl(parsed.data.database.url)
          : buildDatabaseUrl(parsed.data.database);
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Those database details are not valid.');
    }

    // Prove the credentials before writing anything: a .env that names a
    // database nobody can reach is worse than no .env, because the next screen
    // then has nothing useful to say.
    try {
      await testConnection(connection);
    } catch (error) {
      return badRequest(describeDbError(error));
    }

    try {
      await applySchema(connection);
    } catch (error) {
      return badRequest(describeDbError(error));
    }

    await writeEnvFile({
      DATABASE_URL: connection,
      AUTH_ACCESS_SECRET: generateSecret(),
      AUTH_REFRESH_SECRET: generateSecret(),
      SETTINGS_SECRET: generateSecret(),
      AUTH_REQUIRE_2FA: 'true',
      ...(parsed.data.siteUrl ? { NEXT_PUBLIC_SITE_URL: parsed.data.siteUrl } : {}),
    });

    return NextResponse.json({
      status: 'ok' as const,
      schema: 'applied' as const,
      wroteEnv: true,
      // Node parsed its environment at boot and the connection pool was built
      // from it. Nothing this request can do changes that.
      restartRequired: true,
    });
  });
}
