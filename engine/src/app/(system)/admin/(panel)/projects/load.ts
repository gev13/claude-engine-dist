import 'server-only';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db';
import { media, projectTerms, projects } from '@/server/db/schema';
import { projectPathById } from '@/server/content/projects';
import { termIdsOf } from '@/server/content/projectWrites';
import { getPermalinks } from '@/server/routing/config';
import type { MediaInfo, ProjectRecord, TermOption } from './ProjectEditor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every project category and tag, for the editor's Filing panel. */
export async function loadTermOptions(): Promise<TermOption[]> {
  try {
    const rows = await db
      .select({ id: projectTerms.id, name: projectTerms.name, taxonomy: projectTerms.taxonomy })
      .from(projectTerms)
      .orderBy(asc(projectTerms.sortOrder), asc(projectTerms.name));
    return rows.map((row) => ({ ...row, taxonomy: row.taxonomy === 'tag' ? 'tag' : 'category' }));
  } catch {
    return [];
  }
}

/** One project as the editor edits it, with the three pictures it points at. */
export async function loadProjectRecord(
  id: string,
): Promise<{ record: ProjectRecord; media: Partial<Record<'cover' | 'hover' | 'hero', MediaInfo>> } | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!row) return null;
  const ids = [row.coverMediaId, row.hoverMediaId, row.heroMediaId].filter((value): value is string => Boolean(value));
  const found = ids.length
    ? await db.select({ id: media.id, url: media.url, altText: media.altText, mimeType: media.mimeType }).from(media).where(inArray(media.id, ids))
    : [];
  const byId = new Map(found.map((item) => [item.id, item]));
  return {
    record: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      excerpt: row.excerpt,
      intro: row.intro,
      client: row.client,
      year: row.year,
      url: row.url,
      blocks: (row.blocks ?? []) as ProjectRecord['blocks'],
      seo: row.seo ?? {},
      customCss: row.customCss ?? '',
      options: (row.options ?? {}) as ProjectRecord['options'],
      status: row.status,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      sortOrder: row.sortOrder,
      featured: row.featured,
      coverMediaId: row.coverMediaId,
      hoverMediaId: row.hoverMediaId,
      heroMediaId: row.heroMediaId,
      ...(await termIdsOf(row.id)),
      publicPath: await projectPathById(await getPermalinks(), row.id),
    },
    media: {
      cover: row.coverMediaId ? byId.get(row.coverMediaId) : undefined,
      hover: row.hoverMediaId ? byId.get(row.hoverMediaId) : undefined,
      hero: row.heroMediaId ? byId.get(row.heroMediaId) : undefined,
    },
  };
}
