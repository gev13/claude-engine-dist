import 'server-only';
import { eq } from 'drizzle-orm';
import { emptyTheme, parseTheme, type Theme } from '@/lib/theme';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

/** The single settings row the whole theme lives in. */
export const THEME_SETTING_KEY = 'theme';

/**
 * Read the saved theme.
 *
 * Mirrors how pages resolve: a database that is unreachable, or a row that no
 * longer matches the schema, degrades to the built-in design rather than to an
 * error. The site is never worse off than it was before the theme existed.
 */
export async function getTheme(): Promise<Theme> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, THEME_SETTING_KEY)).limit(1);
    return parseTheme(row?.value);
  } catch {
    return emptyTheme;
  }
}
