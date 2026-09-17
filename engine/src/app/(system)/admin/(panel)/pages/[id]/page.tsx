import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ToastProvider } from '@/components/admin/useToast';
import { db } from '@/server/db';
import { pages } from '@/server/db/schema';
import { PageEditor, type PageEditorRecord } from '../PageEditor';

export const metadata: Metadata = { title: 'Edit page' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The row is read here rather than fetched from the client so the editor opens
 * populated — the panel layout has already authenticated the request.
 */
async function loadPage(id: string): Promise<PageEditorRecord | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    path: row.path,
    navLabel: row.navLabel,
    summary: row.summary,
    excerpt: row.excerpt,
    status: row.status,
    template: row.template,
    priorityTier: row.priorityTier,
    sortOrder: row.sortOrder,
    blocks: row.blocks ?? [],
    seo: row.seo ?? {},
    customCss: row.customCss ?? '',
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    isSystem: row.isSystem,
  };
}

export default async function EditPageScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await loadPage(id).catch(() => null);
  if (!record) notFound();

  return (
    <ToastProvider>
      <PageEditor record={record} />
    </ToastProvider>
  );
}
