import 'server-only';
import { eq } from 'drizzle-orm';
import { type Popup, popupsSchema } from '@/lib/popups';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const POPUPS_SETTING_KEY = 'popups';

/**
 * Every saved popup. Never throws: a missing row, a malformed one or an
 * unreachable database all mean "no popups", so a popup can never take the
 * site down.
 */
export async function getPopups(): Promise<Popup[]> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, POPUPS_SETTING_KEY)).limit(1);
    const parsed = popupsSchema.safeParse(row?.value ?? []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
