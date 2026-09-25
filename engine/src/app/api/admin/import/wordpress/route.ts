import { z } from 'zod';
import { reportTotals } from '@/lib/importReport';
import { parseWxr } from '@/lib/wordpress/wxr';
import { badRequest, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can } from '@/server/auth/rbac';
import { revalidateEverything } from '@/server/content/revalidate';
import { rebuildUsageIndex } from '@/server/content/savedBlocks';
import { invalidateRouting } from '@/server/routing/config';
import { reindexPosts } from '@/server/search/reindex';
import { defaultMapping, wpMappingSchema } from '@/server/wordpress/convert';
import { dropStaged, loadStaged, previewImport, runImport, stageSite } from '@/server/wordpress/importer';
import { readRestSite } from '@/server/wordpress/rest';
import { analyse } from '@/lib/wordpress/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* Reading a large site and fetching its files takes minutes, not seconds. */
export const maxDuration = 900;

/**
 * Import from WordPress (T37, 2.20) — administrator territory, like Export &
 * import: it writes content across the whole site. Three steps, each its own
 * request: read a source (a WXR upload, or a site address for the REST API),
 * preview a mapping, import it.
 */

/** A WXR export of a large blog is tens of megabytes; this is well past that. */
const MAX_WXR_BYTES = 200 * 1024 * 1024;

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'transfer:read');
    if (!guard.ok) return guard.response;
    return ok({ maxWxrBytes: MAX_WXR_BYTES });
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('read'), url: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('preview'), token: z.string().max(40), mapping: wpMappingSchema }),
  z.object({ action: z.literal('import'), token: z.string().max(40), mapping: wpMappingSchema, onInvalid: z.enum(['abort', 'skip']).default('abort') }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'transfer:write');
    if (!guard.ok) return guard.response;
    const ip = clientIp(request.headers);
    const allowRegex = can(guard.user, 'redirects:regex');

    /* ── A WXR file ──────────────────────────────────────────────────────── */
    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return badRequest('That upload could not be read.');
      }
      const file = form.get('file');
      if (!(file instanceof File)) return badRequest('Choose a WordPress export file first.');
      if (file.size <= 0) return badRequest('That file is empty.');
      if (file.size > MAX_WXR_BYTES) return badRequest('That file is larger than the 200 MB limit.');
      let site;
      try {
        site = parseWxr(await file.text());
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'That is not a WordPress export file.');
      }
      if (site.items.length === 0) return badRequest('That export holds no content.');
      const staged = await stageSite(site);
      return ok({ ...staged, mapping: defaultMapping(staged.analysis) });
    }

    const parsed = await readJson(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    /* ── A live site, through its REST API ───────────────────────────────── */
    if (input.action === 'read') {
      const read = await readRestSite(input.url);
      if (!read.ok) return badRequest(read.error);
      if (read.site.items.length === 0) return badRequest('That site shows no public content.');
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'content.wordpress.read',
        targetType: 'content',
        targetId: read.site.url.slice(0, 120),
        summary: `Read ${read.site.items.length} items from ${read.site.url.slice(0, 120)} for import`,
        ip,
      });
      const staged = await stageSite(read.site);
      return ok({ ...staged, mapping: defaultMapping(staged.analysis) });
    }

    const site = await loadStaged(input.token);
    if (!site) return notFound('That reading has expired — read the site or the file again.');

    if (input.action === 'preview') {
      const preview = await previewImport(site, input.mapping, { id: guard.user.id, allowRegex });
      return ok({ analysis: analyse(site), ...preview });
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'content.wordpress.started',
      targetType: 'content',
      targetId: site.url.slice(0, 120),
      summary: `Started importing from WordPress (${site.url.slice(0, 120)})`,
      ip,
    });
    const outcome = await runImport(site, input.mapping, { userId: guard.user.id, allowRegex, onInvalid: input.onInvalid });
    const counts = outcome.report ? reportTotals(outcome.report) : null;
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: outcome.ok ? 'content.wordpress.completed' : 'content.wordpress.failed',
      targetType: 'content',
      targetId: site.url.slice(0, 120),
      summary: outcome.ok
        ? `Imported from WordPress: ${counts?.create ?? 0} created, ${counts?.update ?? 0} updated, ${counts?.skip ?? 0} skipped, ${counts?.failed ?? 0} refused, ${outcome.media.stored} files stored; the site before it is kept as ${outcome.backupTaken}`
        : `Importing from WordPress failed: ${outcome.error}`,
      ip,
    });
    if (!outcome.ok) return badRequest(outcome.error, outcome.report ? { report: outcome.report } : undefined);

    await dropStaged(input.token);
    invalidateRouting();
    await rebuildUsageIndex();
    const search = await reindexPosts().catch(() => ({ error: 'The search index could not be rebuilt.' }));
    revalidateEverything();
    return ok({ ...outcome, search: search && 'error' in search ? search.error : null });
  });
}
