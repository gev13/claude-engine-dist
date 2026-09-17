import 'server-only';
import { CODE_SETTING_KEY, type SiteCode, codeSchema, defaultCode } from '@/lib/customCode';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * The site's custom CSS and analytics id.
 *
 * Never throws: a missing row, a malformed one or an unreachable database all
 * mean "no custom code", which is the shipped state. A broken settings row
 * must not be able to take every page down, and it is written into every page.
 */
export async function getSiteCode(): Promise<SiteCode> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, CODE_SETTING_KEY)).limit(1);
    const parsed = codeSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : defaultCode();
  } catch {
    return defaultCode();
  }
}
