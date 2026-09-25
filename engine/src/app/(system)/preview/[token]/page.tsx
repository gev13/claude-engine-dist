import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { verifyPreviewToken } from '@/server/content/preview';
import { pageTrail } from '@/server/content/trail';
import { db } from '@/server/db';
import { PostArticle } from '@/components/site/blog/PostArticle';
import { getPostForPreview } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { pages, posts } from '@/server/db/schema';

/** Never cached, never indexed: this is unpublished content. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type Props = { params: Promise<{ token: string }> };

/**
 * Render one unpublished page or post from a signed link.
 *
 * A dedicated route rather than a `?preview=` parameter on the public
 * catch-all: reading a search parameter there would make every request to
 * every page dynamic and take ISR with it.
 */
export default async function PreviewPage({ params }: Props) {
  const { token } = await params;
  const result = verifyPreviewToken(token);
  if (!result.ok) notFound();

  const { entityType, entityId } = result.target;

  /* A post previews through the same component that renders it publicly, so
     the layout — article, blocks, or both — is exactly what will go live. */
  if (entityType === 'post') {
    const post = await getPostForPreview(entityId);
    if (!post) notFound();
    return (
      <div className="he-site">
        <PreviewBar status={post.status} expiresAt={result.expiresAt} />
        <main>
          <PostArticle post={post} permalinks={await getPermalinks()} preview />
        </main>
      </div>
    );
  }

  const row =
    entityType === 'page'
      ? (await db.select().from(pages).where(eq(pages.id, entityId)).limit(1))[0]
      : (await db.select().from(posts).where(eq(posts.id, entityId)).limit(1))[0];

  if (!row) notFound();

  // A page previews with the trail it will have once published; a post has none.
  const trail = 'path' in row && typeof row.path === 'string' ? await pageTrail(row.path, row.title) : undefined;

  return (
    <div className="he-site">
      <PreviewBar status={row.status} expiresAt={result.expiresAt} />
      <main>
        <BlockRenderer blocks={row.blocks} trail={trail} />
      </main>
    </div>
  );
}

function PreviewBar({ status, expiresAt }: { status: string; expiresAt: Date }) {
  return (
    <div className="border-b-2 border-flare bg-flare px-5 py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
      Preview · {status} · not visible to the public · link expires {expiresAt.toLocaleDateString()}
    </div>
  );
}
