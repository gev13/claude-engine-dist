import { z } from 'zod';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { getSiteSchema } from '@/server/content/structuredData';
import { SCHEMA_SETTING_KEY, siteSchemaSchema } from '@/lib/structuredData';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin → Structured data (3.20). `settings:*`, like the organization's other
 * details in Settings: it describes the whole site to search engines. One row,
 * replaced whole.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ schema: await getSiteSchema() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ schema: siteSchemaSchema }));
    if (!parsed.ok) return parsed.response;
    const { schema } = parsed.data;

    await db
      .insert(settings)
      .values({ key: SCHEMA_SETTING_KEY, value: schema, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value: schema, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'schema.update',
      targetType: 'settings',
      targetId: SCHEMA_SETTING_KEY,
      summary: 'Updated the structured data settings',
      metadata: { organizationType: schema.organizationType ?? 'Organization', offerCatalog: schema.offerCatalog === true },
      ip: clientIp(request.headers),
    });

    // The Organization is in the shared layout; every page's graph changes.
    revalidateEverything();
    return ok({ schema });
  });
}
