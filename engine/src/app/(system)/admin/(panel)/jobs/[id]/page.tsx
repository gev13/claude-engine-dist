import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { ToastProvider } from '@/components/admin/useToast';
import { db } from '@/server/db';
import { applications, jobs, media } from '@/server/db/schema';
import { JobEditor, type CoverInfo, type JobEditorRecord } from '../JobEditor';

export const metadata: Metadata = { title: 'Edit role' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = { record: JobEditorRecord; cover: CoverInfo | null };

async function loadJob(id: string): Promise<Loaded | null> {
  if (!UUID.test(id)) return null;

  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!row) return null;

  const [[count], coverRow] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(applications).where(eq(applications.jobId, row.id)),
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
      slug: row.slug,
      locale: row.locale,
      title: row.title,
      excerpt: row.excerpt,
      location: row.location,
      contractType: row.contractType,
      workingTime: row.workingTime,
      seniority: row.seniority,
      workweek: row.workweek,
      department: row.department,
      description: row.description,
      responsibilities: row.responsibilities,
      benefits: row.benefits,
      coverMediaId: row.coverMediaId,
      seo: row.seo ?? {},
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      deadline: row.deadline ? row.deadline.toISOString() : null,
      isOpen: row.isOpen,
      status: row.status,
      sortOrder: row.sortOrder,
      applicationCount: count?.n ?? 0,
    },
    cover: coverRow[0] ?? null,
  };
}

export default async function EditJobScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadJob(id).catch(() => null);
  if (!loaded) notFound();

  return (
    <ToastProvider>
      <JobEditor record={loaded.record} cover={loaded.cover} />
    </ToastProvider>
  );
}
