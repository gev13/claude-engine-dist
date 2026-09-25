import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { ENGINE_VERSION } from '@/lib/version';
import { badRequest, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { invalidateRouting } from '@/server/routing/config';
import {
  MAX_IMPORT_BYTES,
  contentArchivePath,
  deleteContentArchive,
  exportContent,
  importContent,
  inspectArchive,
  listContentArchives,
  receiveArchive,
} from '@/server/engine/transfer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Content export and import.
 *
 * Administrator territory throughout: an export carries every page and every
 * uploaded file off the server, and an import replaces all of it. Unlike a
 * restore, nobody is signed out afterwards — accounts are never touched.
 */

/** Typed out, because an import replaces every page the site has. */
const IMPORT_CONFIRM = 'replace all content';

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'transfer:read');
    if (!guard.ok) return guard.response;

    const download = new URL(request.url).searchParams.get('download');

    if (download) {
      const full = contentArchivePath(download);
      if (!full) return badRequest('That is not an export this site wrote.');
      const size = await stat(full).then(
        (s) => s.size,
        () => null,
      );
      if (size === null) return notFound('That export is no longer on disk.');

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'content.export.download',
        targetType: 'content',
        targetId: download,
        summary: `Downloaded the content export ${download}`,
        ip: clientIp(request.headers),
      });

      return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': String(size),
          'Content-Disposition': `attachment; filename="${download}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return ok({ items: await listContentArchives(), engineVersion: ENGINE_VERSION, maxImportBytes: MAX_IMPORT_BYTES });
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('export'),
    includeMedia: z.boolean().default(true),
    includeSettings: z.boolean().default(true),
  }),
  z.object({ action: z.literal('delete'), filename: z.string().min(1).max(200) }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'transfer:write');
    if (!guard.ok) return guard.response;

    const ip = clientIp(request.headers);
    const contentType = request.headers.get('content-type') ?? '';

    /* ── An archive arriving from another site ───────────────────────────── */
    if (contentType.includes('multipart/form-data')) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return badRequest('That upload could not be read.');
      }

      const file = form.get('file');
      if (!(file instanceof File)) return badRequest('Choose an export file first.');

      const mode = String(form.get('mode') ?? 'inspect');
      const received = await receiveArchive(file);
      if (!received.ok) return badRequest(received.error);

      // Looking, not applying: read the manifest and throw the upload away.
      if (mode !== 'import') {
        const inspected = await inspectArchive(received.path);
        await rm(received.path, { force: true });
        if (!inspected.ok) return badRequest(inspected.error);
        return ok({ manifest: inspected.manifest });
      }

      if (String(form.get('confirm') ?? '') !== IMPORT_CONFIRM) {
        await rm(received.path, { force: true });
        return badRequest(`Type "${IMPORT_CONFIRM}" to confirm.`);
      }

      // Audited before and after: if the process dies mid-way, the log still
      // records that somebody started it.
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'content.import.started',
        targetType: 'content',
        targetId: file.name.slice(0, 200),
        summary: `Started importing content from ${file.name.slice(0, 120)}`,
        ip,
      });

      const outcome = await importContent(received.path, {
        attributeTo: guard.user.id,
        createdById: guard.user.id,
      });

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: outcome.ok ? 'content.import.completed' : 'content.import.failed',
        targetType: 'content',
        targetId: file.name.slice(0, 200),
        summary: outcome.ok
          ? `Imported content; the site before it is kept as ${outcome.backupTaken}`
          : `Importing content failed: ${outcome.error}`,
        ip,
      });

      if (!outcome.ok) return badRequest(outcome.error);
      /* Every page, post and setting may have changed underneath the cache,
         and the permalinks and redirect rules with them. */
      invalidateRouting();
      revalidateEverything();

      return ok({ applied: outcome.applied, backupTaken: outcome.backupTaken });
    }

    /* ── Making one, or tidying up ───────────────────────────────────────── */
    const parsed = await readJson(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    if (input.action === 'export') {
      const result = await exportContent({
        includeMedia: input.includeMedia,
        includeSettings: input.includeSettings,
      });

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'content.export',
        targetType: 'content',
        targetId: result.ok ? result.filename : null,
        summary: result.ok
          ? `Exported content (${result.filename})`
          : `A content export failed: ${result.error}`,
        ip,
      });

      if (!result.ok) return badRequest(result.error);
      return ok({ export: result });
    }

    const removed = await deleteContentArchive(input.filename);
    if (!removed) return badRequest('That is not an export this site wrote.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'content.export.delete',
      targetType: 'content',
      targetId: input.filename,
      summary: `Deleted the content export ${input.filename}`,
      ip,
    });

    return ok({ deleted: input.filename });
  });
}
