import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env, isProd } from '@/lib/env';
import * as schema from './schema';

/**
 * A single pooled client per process. Next's dev server re-evaluates modules on
 * every change, so the client is cached on globalThis to avoid leaking sockets.
 */
const globalForDb = globalThis as unknown as { __hePg?: ReturnType<typeof postgres> };

const client =
  globalForDb.__hePg ??
  postgres(env.DATABASE_URL, {
    max: isProd ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });

if (!isProd) globalForDb.__hePg = client;

export const db = drizzle(client, { schema, casing: 'snake_case' });
export { schema };
export type Db = typeof db;

/** True when the database is reachable. Used by the health check and by the
 *  content layer to decide whether to fall back to bundled defaults. */
export async function pingDb(): Promise<boolean> {
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  }
}
