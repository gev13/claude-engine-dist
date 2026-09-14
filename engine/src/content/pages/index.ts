import type { PageDefinition } from '@/content/types';

/* ═══════════════════════════════════════════════════════════════════════════
   Bundled page definitions
   ───────────────────────────────────────────────────────────────────────────
   Pages resolve database-first and fall back to whatever is listed here, so a
   clone renders before any database exists.

   A new site starts empty: the installer creates one starter page in the
   database, and everything after that is made in the admin. Add a definition
   here only for a page that must survive an empty database — a holding page,
   say, or a legally required notice.
   ═══════════════════════════════════════════════════════════════════════════ */

export const pageDefinitions: PageDefinition[] = [];

export function pageDefinitionByPath(path: string): PageDefinition | undefined {
  return pageDefinitions.find((page) => page.path === path);
}
