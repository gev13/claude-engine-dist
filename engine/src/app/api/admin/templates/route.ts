import { nanoid } from 'nanoid';
import { z } from 'zod';
import { PAGE_TEMPLATES, SECTION_TEMPLATES, findPageTemplate, findSectionTemplate, instantiate } from '@/content/templates';
import { handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ensureDemoMedia } from '@/server/media/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Page templates and ready sections (P3-G). GET lists them for the pickers;
 * POST hands one out as blocks with fresh ids, after adding any demo picture
 * it uses to the media library — so it looks right on a site that never ran
 * the demo seed.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:read');
    if (!guard.ok) return guard.response;
    return ok({
      pages: PAGE_TEMPLATES.map(({ id, name, category, description, blocks }) => ({ id, name, category, description, types: blocks.map((block) => block.type) })),
      sections: SECTION_TEMPLATES.map(({ id, name, group, description, blocks }) => ({ id, name, group, description, types: blocks.map((block) => block.type) })),
    });
  });
}

const pickSchema = z.object({ kind: z.enum(['page', 'section']), id: z.string().min(1).max(60) });

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, pickSchema);
    if (!parsed.ok) return parsed.response;
    const { kind, id } = parsed.data;

    const template = kind === 'page' ? findPageTemplate(id) : findSectionTemplate(id);
    if (!template) return notFound('That template does not exist.');

    const blocks = instantiate(template.blocks, () => nanoid(10));
    await ensureDemoMedia(blocks);
    return ok({ blocks, ...('page' in template ? { page: template.page } : {}) });
  });
}
