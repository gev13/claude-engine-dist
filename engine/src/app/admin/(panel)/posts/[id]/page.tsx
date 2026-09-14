import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { ToastProvider } from '@/components/admin/useToast';
import { db } from '@/server/db';
import { categories, media, postCategories, posts } from '@/server/db/schema';
import { PostEditor, type CategoryOption, type CoverInfo, type PostEditorRecord } from '../PostEditor';

export const metadata: Metadata = { title: 'Edit post' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = { record: PostEditorRecord; options: CategoryOption[]; cover: CoverInfo | null };

async function loadPost(id: string): Promise<Loaded | null> {
  if (!UUID.test(id)) return null;

  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) return null;

  const [linked, options, coverRow] = await Promise.all([
    db.select({ categoryId: postCategories.categoryId }).from(postCategories).where(eq(postCategories.postId, row.id)),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    row.coverMediaId
      ? db
          .select({ id: media.id, url: media.url, altText: media.altText })
          .from(media)
          .where(eq(media.id, row.coverMediaId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    record: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      body: row.body,
      blocks: row.blocks ?? [],
      kind: row.kind,
      status: row.status,
      seo: row.seo ?? {},
      coverMediaId: row.coverMediaId,
      primaryCategoryId: row.primaryCategoryId,
      categoryIds: linked.map((link) => link.categoryId),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    },
    options,
    cover: coverRow[0] ?? null,
  };
}

export default async function EditPostScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadPost(id).catch(() => null);
  if (!loaded) notFound();

  return (
    <ToastProvider>
      <PostEditor record={loaded.record} categories={loaded.options} cover={loaded.cover} />
    </ToastProvider>
  );
}
