import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { CSS_MAX, safeCss } from '@/lib/customCode';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { projectOptionsSchema } from '@/lib/projects';
import { blockInput, seoSchema, statusEnum } from '@/server/api/schemas';
import { badRequest } from '@/server/api/respond';
import { db } from '@/server/db';
import { projectTermLinks, projectTerms, type Block } from '@/server/db/schema';
import { sanitizeRichText } from './sanitize';

/* The request shape a project is written with, shared by create and update. */

const mediaId = z.string().uuid().nullable().optional();

export const projectFields = z.object({
  slug: z.string().min(1).max(180).optional(),
  title: z.string().min(1).max(300),
  summary: z.string().max(300).optional(),
  excerpt: z.string().max(2000).optional(),
  /** Rich text — sanitised before it is stored, like a post's body. */
  intro: z.string().max(50_000).optional(),
  coverMediaId: mediaId,
  hoverMediaId: mediaId,
  heroMediaId: mediaId,
  client: z.string().max(200).optional(),
  year: z.string().max(20).optional(),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || /^https?:\/\/[^\s<>"]+$/i.test(value), 'A full https:// address')
    .optional(),
  blocks: z.array(blockInput).max(300).optional(),
  seo: seoSchema.optional(),
  customCss: z.string().max(CSS_MAX).transform(safeCss).optional(),
  options: projectOptionsSchema.optional(),
  status: statusEnum.optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  featured: z.boolean().optional(),
  /** Category ids; the first listed, or `primaryCategoryId`, is the primary one. */
  categoryIds: z.array(z.string().uuid()).max(20).optional(),
  primaryCategoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
});

export type ProjectInput = z.infer<typeof projectFields>;

/**
 * A block that fails its schema would quietly vanish from the live page, so
 * it is refused on write with its name — the rule pages and posts follow.
 */
export function validateProjectBlocks(
  input: AnyBlock[],
): { ok: true; blocks: Block[] } | { ok: false; response: NextResponse } {
  const problems = collectInvalidBlocks(input);
  if (problems.length > 0) return { ok: false, response: badRequest(`${problems[0]} and was not saved.`, { problems }) };
  return { ok: true, blocks: parseBlocks(input) as Block[] };
}

export const cleanIntro = (html: string | undefined) => (html === undefined ? undefined : sanitizeRichText(html));

/**
 * Replace a project's categories and tags. Ids that are not terms of the
 * right taxonomy are ignored rather than trusted — the request names ids, the
 * database says what they are.
 */
export async function linkTerms(
  projectId: string,
  input: { categoryIds?: string[]; tagIds?: string[]; primaryCategoryId?: string | null },
): Promise<void> {
  if (input.categoryIds === undefined && input.tagIds === undefined) return;
  const wanted = [...new Set([...(input.categoryIds ?? []), ...(input.tagIds ?? [])])];
  const terms = wanted.length
    ? await db.select({ id: projectTerms.id, taxonomy: projectTerms.taxonomy }).from(projectTerms).where(inArray(projectTerms.id, wanted))
    : [];
  const kind = new Map(terms.map((term) => [term.id, term.taxonomy]));
  const categories = (input.categoryIds ?? []).filter((id) => kind.get(id) === 'category');
  const tags = (input.tagIds ?? []).filter((id) => kind.get(id) === 'tag');
  const primary =
    input.primaryCategoryId && categories.includes(input.primaryCategoryId) ? input.primaryCategoryId : categories[0];

  await db.transaction(async (tx) => {
    if (input.categoryIds !== undefined) {
      const existing = await tx
        .select({ termId: projectTermLinks.termId })
        .from(projectTermLinks)
        .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
        .where(and(eq(projectTermLinks.projectId, projectId), eq(projectTerms.taxonomy, 'category')));
      if (existing.length) {
        await tx
          .delete(projectTermLinks)
          .where(and(eq(projectTermLinks.projectId, projectId), inArray(projectTermLinks.termId, existing.map((row) => row.termId))));
      }
      if (categories.length) {
        await tx.insert(projectTermLinks).values(categories.map((termId) => ({ projectId, termId, isPrimary: termId === primary })));
      }
    }
    if (input.tagIds !== undefined) {
      const existing = await tx
        .select({ termId: projectTermLinks.termId })
        .from(projectTermLinks)
        .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
        .where(and(eq(projectTermLinks.projectId, projectId), eq(projectTerms.taxonomy, 'tag')));
      if (existing.length) {
        await tx
          .delete(projectTermLinks)
          .where(and(eq(projectTermLinks.projectId, projectId), inArray(projectTermLinks.termId, existing.map((row) => row.termId))));
      }
      if (tags.length) await tx.insert(projectTermLinks).values(tags.map((termId) => ({ projectId, termId, isPrimary: false })));
    }
  });
}

/** A project's category and tag ids, primary category first — what the editor shows. */
export async function termIdsOf(projectId: string) {
  const rows = await db
    .select({ id: projectTerms.id, taxonomy: projectTerms.taxonomy, isPrimary: projectTermLinks.isPrimary })
    .from(projectTermLinks)
    .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
    .where(eq(projectTermLinks.projectId, projectId));
  const categories = rows.filter((row) => row.taxonomy === 'category').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return {
    categoryIds: categories.map((row) => row.id),
    primaryCategoryId: categories.find((row) => row.isPrimary)?.id ?? categories[0]?.id ?? null,
    tagIds: rows.filter((row) => row.taxonomy === 'tag').map((row) => row.id),
  };
}

/** A project category or tag, as the terms screen writes it. */
export const termSchema = z.object({
  taxonomy: z.enum(['category', 'tag']),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(180).optional(),
  description: z.string().max(4000).default(''),
  seo: seoSchema.optional(),
  sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
});
