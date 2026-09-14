import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { PageHeader } from '@/components/admin/PageHeader';
import { UpdateNotice } from '@/components/admin/UpdateNotice';
import { AdminLinkButton, Alert, Badge, Panel, Table, Td, Th } from '@/components/admin/ui';
import { formatDate } from '@/lib/utils';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { db } from '@/server/db';
import { auditLog, enquiries, media, pages, posts } from '@/server/db/schema';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard
   ───────────────────────────────────────────────────────────────────────────
   Read-only, so it queries the database directly instead of round-tripping
   through its own HTTP API: the panel layout has already authenticated the
   request, and every count here is a single aggregate.
   ═══════════════════════════════════════════════════════════════════════════ */

type StatusCounts = { total: number; published: number; draft: number };

const emptyCounts: StatusCounts = { total: 0, published: 0, draft: 0 };

type RecentItem = {
  id: string;
  title: string;
  href: string;
  path: string;
  kind: 'Page' | 'Post';
  status: 'draft' | 'published' | 'archived';
  updatedAt: Date;
};

type Snapshot = {
  pageCounts: StatusCounts;
  postCounts: StatusCounts;
  newEnquiries: number;
  mediaCount: number;
  mediaBytes: number;
  recent: RecentItem[];
  latestEnquiries: { id: string; name: string; email: string; company: string; createdAt: Date }[];
  activity: { id: string; action: string; summary: string; actorEmail: string | null; createdAt: Date }[];
};

async function loadSnapshot(includeAudit: boolean): Promise<Snapshot> {
  const [pageStats, postStats, enquiryStats, mediaStats, recentPages, recentPosts, latestEnquiries, activity] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${pages.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${pages.status} = 'draft')::int`,
        })
        .from(pages),
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${posts.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${posts.status} = 'draft')::int`,
        })
        .from(posts),
      db
        .select({ unread: sql<number>`count(*) filter (where ${enquiries.status} = 'new')::int` })
        .from(enquiries),
      db
        .select({
          total: sql<number>`count(*)::int`,
          bytes: sql<number>`coalesce(sum(${media.byteSize}), 0)::bigint`,
        })
        .from(media),
      db
        .select({
          id: pages.id,
          title: pages.title,
          path: pages.path,
          status: pages.status,
          updatedAt: pages.updatedAt,
        })
        .from(pages)
        .orderBy(desc(pages.updatedAt))
        .limit(6),
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          status: posts.status,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .orderBy(desc(posts.updatedAt))
        .limit(6),
      db
        .select({
          id: enquiries.id,
          name: enquiries.name,
          email: enquiries.email,
          company: enquiries.company,
          createdAt: enquiries.createdAt,
        })
        .from(enquiries)
        .where(eq(enquiries.status, 'new'))
        .orderBy(desc(enquiries.createdAt))
        .limit(5),
      includeAudit
        ? db
            .select({
              id: auditLog.id,
              action: auditLog.action,
              summary: auditLog.summary,
              actorEmail: auditLog.actorEmail,
              createdAt: auditLog.createdAt,
            })
            .from(auditLog)
            .orderBy(desc(auditLog.createdAt))
            .limit(8)
        : Promise.resolve([]),
    ]);

  const recent: RecentItem[] = [
    ...recentPages.map((row) => ({
      id: row.id,
      title: row.title,
      href: `/admin/pages/${row.id}`,
      path: row.path,
      kind: 'Page' as const,
      status: row.status,
      updatedAt: row.updatedAt,
    })),
    ...recentPosts.map((row) => ({
      id: row.id,
      title: row.title,
      href: `/admin/posts/${row.id}`,
      path: `/blog/${row.slug}`,
      kind: 'Post' as const,
      status: row.status,
      updatedAt: row.updatedAt,
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);

  return {
    pageCounts: pageStats[0] ?? emptyCounts,
    postCounts: postStats[0] ?? emptyCounts,
    newEnquiries: enquiryStats[0]?.unread ?? 0,
    mediaCount: mediaStats[0]?.total ?? 0,
    // sum() comes back as a string from bigint; Number() is safe at library scale.
    mediaBytes: Number(mediaStats[0]?.bytes ?? 0),
    recent,
    latestEnquiries,
    activity,
  };
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Stat({
  label,
  value,
  detail,
  href,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail?: React.ReactNode;
  href: string;
  tone?: 'neutral' | 'alert';
}) {
  return (
    <Link
      href={href}
      className="block border-2 border-hairline bg-surface px-5 py-4 transition-colors hover:border-rule"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">{label}</div>
      <div
        className={`mt-2 font-display text-[32px] font-extrabold leading-none tracking-[-0.03em] ${
          tone === 'alert' && Number(value) > 0 ? 'text-flare-soft' : 'text-bone'
        }`}
      >
        {value}
      </div>
      {detail && <div className="mt-2 text-[13px] text-ash">{detail}</div>}
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const showAudit = can(user, 'audit:read');

  let snapshot: Snapshot | null = null;
  try {
    snapshot = await loadSnapshot(showAudit);
  } catch {
    // The panel is still usable without counts; a dead database should not
    // replace the whole screen with an error page.
    snapshot = null;
  }

  const greetingName = user?.firstName || user?.username || 'there';

  return (
    <>
      {/* Reads the last stored check; never reaches the network while rendering. */}
      <UpdateNotice user={user} />

      <PageHeader
        title={`Good to see you, ${greetingName}.`}
        description="Everything published, drafted and waiting, in one place."
        actions={
          <>
            <AdminLinkButton href="/admin/pages/new">New page</AdminLinkButton>
            <AdminLinkButton href="/admin/posts/new" variant="secondary">
              New post
            </AdminLinkButton>
            <AdminLinkButton href="/admin/media" variant="secondary">
              Media library
            </AdminLinkButton>
            <AdminLinkButton href="/" variant="ghost">
              View site
            </AdminLinkButton>
          </>
        }
      />

      {!snapshot ? (
        <Alert tone="error">
          The database could not be reached, so the dashboard has nothing to count. The rest of the panel will report
          the same problem until the connection is back.
        </Alert>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Pages"
              value={snapshot.pageCounts.total}
              href="/admin/pages"
              detail={
                <>
                  {snapshot.pageCounts.published} published · {snapshot.pageCounts.draft} draft
                </>
              }
            />
            <Stat
              label="Posts"
              value={snapshot.postCounts.total}
              href="/admin/posts"
              detail={
                <>
                  {snapshot.postCounts.published} published · {snapshot.postCounts.draft} draft
                </>
              }
            />
            <Stat
              label="New enquiries"
              value={snapshot.newEnquiries}
              href="/admin/enquiries"
              tone="alert"
              detail={snapshot.newEnquiries > 0 ? 'Unread — waiting on a reply' : 'Nothing unread'}
            />
            <Stat
              label="Media files"
              value={snapshot.mediaCount}
              href="/admin/media"
              detail={`${humanBytes(snapshot.mediaBytes)} stored`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <Panel
              title="Recently updated"
              actions={
                <Link
                  href="/admin/pages"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
                >
                  All pages
                </Link>
              }
            >
              {snapshot.recent.length === 0 ? (
                <p className="m-0 text-[14px] text-ash">
                  No content yet. <Link href="/admin/pages/new" className="text-flare-soft">Start with a page</Link>.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Title</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Updated</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recent.map((item) => (
                      <tr key={`${item.kind}-${item.id}`}>
                        <Td>
                          <Link href={item.href} className="text-bone hover:text-flare-soft">
                            {item.title}
                          </Link>
                          <div className="mt-0.5 font-mono text-[11px] text-smoke">{item.path}</div>
                        </Td>
                        <Td>
                          <Badge>{item.kind}</Badge>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              item.status === 'published' ? 'live' : item.status === 'draft' ? 'draft' : 'archived'
                            }
                          >
                            {item.status}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">
                          {formatDate(item.updatedAt)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>

            <div className="flex flex-col gap-6">
              <Panel
                title="Latest enquiries"
                actions={
                  <Link
                    href="/admin/enquiries"
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
                  >
                    Inbox
                  </Link>
                }
              >
                {snapshot.latestEnquiries.length === 0 ? (
                  <p className="m-0 text-[14px] text-ash">Nothing unread.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {snapshot.latestEnquiries.map((enquiry) => (
                      <li key={enquiry.id} className="border-l-2 border-flare pl-3">
                        <Link href={`/admin/enquiries/${enquiry.id}`} className="text-[14px] text-bone hover:text-flare-soft">
                          {enquiry.name}
                          {enquiry.company ? ` · ${enquiry.company}` : ''}
                        </Link>
                        <div className="font-mono text-[11px] text-smoke">
                          {enquiry.email} · {formatDate(enquiry.createdAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {showAudit && (
                <Panel
                  title="Recent activity"
                  actions={
                    <Link
                      href="/admin/audit"
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
                    >
                      Full log
                    </Link>
                  }
                >
                  {snapshot.activity.length === 0 ? (
                    <p className="m-0 text-[14px] text-ash">Nothing logged yet.</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {snapshot.activity.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-hairline pl-3">
                          <div className="text-[13px] leading-snug text-ash">{entry.summary || entry.action}</div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-smoke">
                            {entry.action} · {entry.actorEmail ?? 'system'} · {formatDate(entry.createdAt)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
