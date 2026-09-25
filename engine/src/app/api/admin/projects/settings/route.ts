import { z } from 'zod';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { PROJECTS_SETTING_KEY, projectTemplateSchema } from '@/lib/projects';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { getProjectTemplate } from '@/server/content/projectTemplate';
import { revalidateEverything } from '@/server/content/revalidate';
import { recordUsage } from '@/server/content/savedBlocks';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Projects → Page template: how every project page is laid out. Design, so
 * it sits with Appearance (`appearance:*`), not with the projects themselves.
 * The call-to-action blocks are checked like a popup's, so a block that
 * would vanish from every project page is refused with its name.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:read');
    if (!guard.ok) return guard.response;
    return ok({ template: await getProjectTemplate() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ template: projectTemplateSchema }));
    if (!parsed.ok) return parsed.response;
    const template = parsed.data.template;

    const problems = collectInvalidBlocks(template.cta as AnyBlock[]);
    if (problems.length > 0) return badRequest(`${problems[0]} and was not saved.`, { problems });
    const value = { ...template, cta: parseBlocks(template.cta as AnyBlock[]) };

    await db
      .insert(settings)
      .values({ key: PROJECTS_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'projects.template.update',
      targetType: 'settings',
      targetId: PROJECTS_SETTING_KEY,
      summary: 'Changed the project page template',
      ip: clientIp(request.headers),
    });
    await recordUsage('projectTemplate', PROJECTS_SETTING_KEY, value.cta as AnyBlock[]);
    revalidateEverything();
    return ok({ template: value });
  });
}
