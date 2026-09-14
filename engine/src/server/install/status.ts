import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { settings, users } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Install state
   ───────────────────────────────────────────────────────────────────────────
   The installer creates an administrator without being authenticated, which
   makes "is this site already installed?" the only thing standing between a
   fresh deployment and an open admin-account factory.

   So the gate is two independent facts, and **either** one closes it:

     1. an `install.completed` settings row exists, and
     2. the users table is empty.

   Deleting the settings row does not reopen the installer while an account
   exists; deleting every account does not reopen it while the row exists. A
   single check would be a single thing to delete.
   ═══════════════════════════════════════════════════════════════════════════ */

export const INSTALL_SETTING_KEY = 'install.completed';

export type InstallState = {
  installed: boolean;
  /** False when the database cannot be reached at all. */
  databaseReachable: boolean;
  /** True when the schema has been applied — the tables exist. */
  schemaReady: boolean;
  userCount: number;
};

export async function getInstallState(): Promise<InstallState> {
  try {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    const [marker] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, INSTALL_SETTING_KEY))
      .limit(1);

    return {
      installed: Boolean(marker) || n > 0,
      databaseReachable: true,
      schemaReady: true,
      userCount: n,
    };
  } catch (error) {
    // Two different failures land here: the database is down, or it is up but
    // the schema has never been applied. The installer needs to tell them
    // apart, because the fix is different.
    const message = error instanceof Error ? error.message : String(error);
    const missingTable = /relation .* does not exist|undefined_table/i.test(message);

    return {
      installed: false,
      databaseReachable: missingTable,
      schemaReady: false,
      userCount: 0,
    };
  }
}

/** Cheap boolean for the layout gates. Never throws. */
export async function isInstalled(): Promise<boolean> {
  try {
    return (await getInstallState()).installed;
  } catch {
    return false;
  }
}
