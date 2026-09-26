import { and, count, desc, eq, ilike, like, or, type SQL } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { requireUser } from '@/server/api/guard';
import { badRequest, created, handle, ok } from '@/server/api/respond';
import { uploadedFiles } from '@/server/api/upload';
import { MediaUploadError, saveUpload } from '@/server/media/storage';
import { getMediaSettings, refreshVariants } from '@/server/media/variants';
import { canUploadSvg } from '@/lib/mediaSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS = {
  id: media.id,
  filename: media.filename,
  originalName: media.originalName,
  mimeType: media.mimeType,
  extension: media.extension,
  byteSize: media.byteSize,
  width: media.width,
  height: media.height,
  durationMs: media.durationMs,
  variants: media.variants,
  url: media.url,
  altText: media.altText,
  caption: media.caption,
  checksum: media.checksum,
  uploadedById: media.uploadedById,
  createdAt: media.createdAt,
};

/** `?type=` groups mime types the way the library UI filters them. */
function typeCondition(type: string | null): SQL | undefined {
  if (type === 'image') return like(media.mimeType, 'image/%');
  if (type === 'video') return like(media.mimeType, 'video/%');
  if (type === 'document') return eq(media.mimeType, 'application/pdf');
  if (type === 'animation') return eq(media.mimeType, 'application/json');
  return undefined;
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'media:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage') ?? 20) || 20));

    const conditions: SQL[] = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(ilike(media.originalName, pattern), ilike(media.altText, pattern))!);
    }
    const byType = typeCondition(url.searchParams.get('type'));
    if (byType) conditions.push(byType);

    const where = conditions.length ? and(...conditions) : undefined;

    const [items, [totals]] = await Promise.all([
      db
        .select(COLUMNS)
        .from(media)
        .where(where)
        .orderBy(desc(media.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db.select({ value: count() }).from(media).where(where),
    ]);

    return ok({ items, total: totals?.value ?? 0, page, perPage });
  });
}

/**
 * Multipart upload. Each file is validated and stored independently so a single
 * rejected file does not throw away the rest of a drag-and-drop batch — the
 * response reports both halves.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'media:write');
    if (!guard.ok) return guard.response;

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return badRequest('Upload must be sent as multipart/form-data.');
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('The upload could not be read. Try again.');
    }

    const files = uploadedFiles(form);
    if (files.length === 0) return badRequest('Attach at least one file.');
    if (files.length > env.MEDIA_MAX_FILES_PER_UPLOAD) {
      return badRequest(`Upload at most ${env.MEDIA_MAX_FILES_PER_UPLOAD} files at a time.`);
    }

    const ip = clientIp(request.headers);
    const mediaSettings = await getMediaSettings();
    const uploaded: Array<typeof media.$inferSelect> = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const file of files) {
      try {
        const stored = await saveUpload(file, guard.user.id, { allowSvg: canUploadSvg(mediaSettings, guard.user.role) });

        const [row] = await db
          .insert(media)
          .values({
            filename: stored.filename,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            extension: stored.extension,
            byteSize: stored.byteSize,
            width: stored.width,
            height: stored.height,
            durationMs: stored.durationMs ?? null,
            url: stored.url,
            checksum: stored.checksum,
            uploadedById: guard.user.id,
          })
          .returning();

        if (!row) throw new MediaUploadError('The file was stored but could not be recorded.');
        uploaded.push(row);
        /* Smaller copies, while responsive images are on (2.17). Started and
           not awaited: the upload is done, and a copy that fails only means
           the original is served. */
        if (mediaSettings.responsive) void refreshVariants(row.id, row.filename, { avif: mediaSettings.avif });

        await audit({
          actorId: guard.user.id,
          actorEmail: guard.user.email,
          action: 'media.upload',
          targetType: 'media',
          targetId: row.id,
          summary: `Uploaded "${row.originalName}"`,
          metadata: { filename: row.filename, byteSize: row.byteSize, mimeType: row.mimeType },
          ip,
        });
      } catch (error) {
        const message =
          error instanceof MediaUploadError ? error.message : 'The file could not be stored. Try again.';
        if (!(error instanceof MediaUploadError)) console.error('[media] upload failed', error);
        failed.push({ name: file.name || 'unnamed file', error: message });
      }
    }

    if (uploaded.length === 0) {
      return badRequest('No files could be uploaded.', failed);
    }

    return created({ items: uploaded, failed, total: uploaded.length });
  });
}
