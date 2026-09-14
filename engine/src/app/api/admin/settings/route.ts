import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  values: z.record(z.string().min(1).max(120), z.unknown()),
});

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const rows = await db.select().from(settings).orderBy(asc(settings.key));
    return ok({ items: rows });
  });
}

/** Upsert a partial map. Keys absent from the payload are left untouched. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    const entries = Object.entries(parsed.data.values);
    for (const [key, value] of entries) {
      await db
        .insert(settings)
        .values({ key, value, updatedById: guard.user.id })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedById: guard.user.id, updatedAt: new Date() },
        });
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'settings.update',
      targetType: 'settings',
      summary: `Updated ${entries.length} setting(s): ${entries.map(([k]) => k).join(', ')}`,
      ip: clientIp(request.headers),
    });

    // Everything, not a path list: the site name, tagline and email are in the
    // shared layout (header, footer, title template, JSON-LD) and in the route
    // handlers, so a rename must reach every page — not only the home page.
    revalidateEverything();

    const rows = await db.select().from(settings).orderBy(asc(settings.key));
    return ok({ items: rows });
  });
}
