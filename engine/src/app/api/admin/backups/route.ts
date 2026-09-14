import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { ENGINE_VERSION } from '@/lib/version';
import { badRequest, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revokeAllForUser } from '@/server/auth/tokens';
import {
  archivePath,
  createBackup,
  deleteBackup,
  listBackups,
  orphanArchives,
  readManifest,
  restoreBackup,
} from '@/server/engine/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Backups (package 6, phase C).
 *
 * A backup holds every account and every enquiry, so this is administrator
 * territory throughout. The only name a caller may send is one this engine
 * generated — `archivePath` refuses anything else — and every action is
 * audited, restores most of all.
 */

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'backups:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const download = url.searchParams.get('download');

    // A file, not a page: streamed straight from disk.
    if (download) {
      const full = archivePath(download);
      if (!full) return badRequest('That is not a backup this site wrote.');
      const size = await stat(full).then(
        (s) => s.size,
        () => null,
      );
      if (size === null) return notFound('That archive is no longer on disk.');

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'backup.download',
        targetType: 'backup',
        targetId: download,
        summary: `Downloaded ${download}`,
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

    const [items, orphans] = await Promise.all([listBackups(50), orphanArchives()]);
    return ok({ items, orphans, engineVersion: ENGINE_VERSION });
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), includeMedia: z.boolean().default(true) }),
  z.object({ action: z.literal('delete'), filename: z.string().min(1).max(200) }),
  z.object({ action: z.literal('inspect'), filename: z.string().min(1).max(200) }),
  /** Deliberately wordy: a restore replaces the site, so it is typed out. */
  z.object({ action: z.literal('restore'), filename: z.string().min(1).max(200), confirm: z.literal('replace everything') }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'backups:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const ip = clientIp(request.headers);

    if (input.action === 'create') {
      const row = await createBackup({ reason: 'manual', includeMedia: input.includeMedia, createdById: guard.user.id });
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'backup.create',
        targetType: 'backup',
        targetId: row.filename,
        summary: row.status === 'ready' ? `Took a backup (${row.filename})` : `A backup failed: ${row.error ?? 'unknown'}`,
        ip,
      });
      if (row.status !== 'ready') return badRequest(row.error ?? 'The backup could not be taken.');
      return ok({ backup: row });
    }

    if (input.action === 'inspect') {
      const manifest = await readManifest(input.filename);
      if (!manifest) return badRequest('That archive could not be read.');
      return ok({ manifest });
    }

    if (input.action === 'delete') {
      const removed = await deleteBackup(input.filename);
      if (!removed) return badRequest('That is not a backup this site wrote.');
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'backup.delete',
        targetType: 'backup',
        targetId: input.filename,
        summary: `Deleted ${input.filename}`,
        ip,
      });
      return ok({ deleted: input.filename });
    }

    // Restore. Audited before and after: if the process dies mid-way, the log
    // still says somebody started it.
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'backup.restore.started',
      targetType: 'backup',
      targetId: input.filename,
      summary: `Started restoring ${input.filename}`,
      ip,
    });

    const outcome = await restoreBackup(input.filename, { createdById: guard.user.id });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: outcome.ok ? 'backup.restore.completed' : 'backup.restore.failed',
      targetType: 'backup',
      targetId: input.filename,
      summary: outcome.ok
        ? `Restored ${input.filename}; the site before it is kept as ${outcome.backupTaken}`
        : `Restoring ${input.filename} failed: ${outcome.error}`,
      ip,
    });

    if (!outcome.ok) return badRequest(outcome.error);

    // The accounts table has just been replaced: whoever is signed in may no
    // longer exist, or may be somebody else. End this administrator's sessions
    // so the next request is authenticated against the restored rows.
    await revokeAllForUser(guard.user.id);

    return ok({ restored: input.filename, replaced: outcome.replaced, backupTaken: outcome.backupTaken, signedOut: true });
  });
}
