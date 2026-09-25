import 'server-only';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import type { AnyBlock } from '@/lib/blocks';
import { freshIds } from '@/lib/blockTree';
import { uniqueSlug } from '@/lib/slug';
import { db } from '@/server/db';
import { pages, postCategories, posts, projectTermLinks, projects, savedBlocks, type Block, type SeoFields } from '@/server/db/schema';
import { recordUsage } from './savedBlocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Duplicate a page, a post, a project or a saved block (T7, 2.15)
   ───────────────────────────────────────────────────────────────────────────
   A copy is a new draft that renders exactly like the original — and shares
   nothing with it: every block and row column gets a new id (a block id
   scopes CSS; a form id files submissions), a form is renamed "… (copy)" so
   its submissions are told apart in the inbox, it starts a translation group
   of its own, and it belongs to whoever made it. Its revision history starts
   empty; the audit log says where it came from.
   ═══════════════════════════════════════════════════════════════════════════ */

const copyTitle = (title: string, max: number) => `${title} (copy)`.slice(0, max);
const copySlug = (slug: string, taken: string[]) => uniqueSlug(`${slug}-copy`.slice(0, 180), taken);
const copyBlocks = (blocks: unknown) => freshIds((blocks ?? []) as AnyBlock[], () => nanoid(10), { renameForms: true }) as Block[];

/** A copy's own SEO: everything but the canonical, which named the original. */
function copySeo(seo: unknown): SeoFields {
  const { canonicalUrl: _drop, ...rest } = (seo ?? {}) as SeoFields;
  return rest;
}

export async function duplicatePage(id: string, userId: string) {
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!row) return null;
  const siblings = await db.select({ slug: pages.slug, path: pages.path }).from(pages).where(eq(pages.locale, row.locale));
  // The path keeps its parent and gains "-copy" on its last segment: /services/seo → /services/seo-copy.
  const parent = row.path.split('/').slice(0, -1).join('/');
  const last = row.path.split('/').pop() || row.slug;
  const takenPaths = new Set(siblings.map((page) => page.path));
  let lastCopy = `${last}-copy`;
  for (let n = 2; takenPaths.has(`${parent}/${lastCopy}`); n++) lastCopy = `${last}-copy-${n}`;

  const blocks = copyBlocks(row.blocks);
  const [copy] = await db
    .insert(pages)
    .values({
      slug: copySlug(row.slug, siblings.map((page) => page.slug)),
      path: row.path === '/' ? '/home-copy' : `${parent}/${lastCopy}`,
      locale: row.locale,
      title: copyTitle(row.title, 300),
      navLabel: row.navLabel,
      summary: row.summary,
      excerpt: row.excerpt,
      status: 'draft',
      blocks,
      seo: copySeo(row.seo),
      customCss: row.customCss,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      template: row.template,
      priorityTier: row.priorityTier,
      isSystem: false,
      publishedAt: null,
      authorId: userId,
    })
    .returning();
  if (copy) await recordUsage('page', copy.id, blocks as AnyBlock[]);
  return copy ? { copy, from: row.title } : null;
}

export async function duplicatePost(id: string, userId: string) {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return null;
  const taken = (await db.select({ slug: posts.slug }).from(posts).where(eq(posts.locale, row.locale))).map((post) => post.slug);
  const blocks = copyBlocks(row.blocks);
  const [copy] = await db
    .insert(posts)
    .values({
      slug: copySlug(row.slug, taken),
      locale: row.locale,
      title: copyTitle(row.title, 300),
      excerpt: row.excerpt,
      body: row.body,
      blocks,
      layout: row.layout,
      kind: row.kind,
      status: 'draft',
      seo: copySeo(row.seo),
      customCss: row.customCss,
      coverMediaId: row.coverMediaId,
      primaryCategoryId: row.primaryCategoryId,
      readingMinutes: row.readingMinutes,
      publishedAt: null,
      authorId: userId,
    })
    .returning();
  if (!copy) return null;
  const links = await db.select().from(postCategories).where(eq(postCategories.postId, row.id));
  if (links.length) await db.insert(postCategories).values(links.map((link) => ({ postId: copy.id, categoryId: link.categoryId })));
  await recordUsage('post', copy.id, blocks as AnyBlock[]);
  return { copy, from: row.title };
}

export async function duplicateProject(id: string, userId: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!row) return null;
  const taken = (await db.select({ slug: projects.slug }).from(projects).where(eq(projects.locale, row.locale))).map((p) => p.slug);
  const blocks = copyBlocks(row.blocks);
  const [copy] = await db
    .insert(projects)
    .values({
      slug: copySlug(row.slug, taken),
      locale: row.locale,
      title: copyTitle(row.title, 300),
      summary: row.summary,
      excerpt: row.excerpt,
      intro: row.intro,
      coverMediaId: row.coverMediaId,
      hoverMediaId: row.hoverMediaId,
      heroMediaId: row.heroMediaId,
      client: row.client,
      year: row.year,
      url: row.url,
      blocks,
      seo: copySeo(row.seo),
      customCss: row.customCss,
      options: row.options,
      status: 'draft',
      publishedAt: null,
      sortOrder: row.sortOrder,
      featured: row.featured,
      authorId: userId,
    })
    .returning();
  if (!copy) return null;
  const links = await db.select().from(projectTermLinks).where(eq(projectTermLinks.projectId, row.id));
  if (links.length) {
    await db.insert(projectTermLinks).values(links.map((link) => ({ projectId: copy.id, termId: link.termId, isPrimary: link.isPrimary })));
  }
  await recordUsage('project', copy.id, blocks as AnyBlock[]);
  return { copy, from: row.title };
}

export async function duplicateSavedBlock(id: string, userId: string) {
  const [row] = await db.select().from(savedBlocks).where(and(eq(savedBlocks.id, id))).limit(1);
  if (!row || row.deletedAt) return null;
  const tree = freshIds((row.tree ?? []) as AnyBlock[], () => nanoid(10)) as Block[];
  const [copy] = await db
    .insert(savedBlocks)
    .values({
      name: copyTitle(row.name, 120),
      description: row.description,
      category: row.category,
      mode: row.mode,
      tree,
      locale: row.locale,
      createdById: userId,
      updatedById: userId,
    })
    .returning();
  if (copy) await recordUsage('savedBlock', copy.id, tree as AnyBlock[]);
  return copy ? { copy, from: row.name } : null;
}
