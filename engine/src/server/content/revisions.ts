import 'server-only';
import { getPermalinks } from '@/server/routing/config';
import { postPathById } from './posts';
import { forgetUsage, recordUsage, type UsageKind } from './savedBlocks';
import type { AnyBlock } from '@/lib/blocks';
import { projectPathById } from './projects';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { contentRevisions, pages, posts, projects, savedBlocks, users } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Content history
   ───────────────────────────────────────────────────────────────────────────
   A snapshot is taken after every successful write, so the newest revision
   always matches what is live and restoring is "write this snapshot back"
   rather than replaying diffs.

   Capture never throws. A failed snapshot must not fail the save that
   triggered it — losing a revision is a smaller problem than losing an
   editor's work, and the same reasoning governs `revalidateContent`.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RevisionEntity = 'page' | 'post' | 'project' | 'saved_block';

/** What the saved-block usage index calls each kind of content. */
const USAGE_KIND: Record<RevisionEntity, UsageKind> = { page: 'page', post: 'post', project: 'project', saved_block: 'savedBlock' };

/** Kept per entity. Older revisions are pruned as new ones arrive. */
export const REVISION_LIMIT = 30;

/**
 * The columns worth restoring.
 *
 * Deliberately not `select *`: ids, timestamps and counters describe the row's
 * place in the database rather than its content, and restoring a `viewCount`
 * or an `updatedAt` from three weeks ago would be wrong.
 */
const PAGE_FIELDS = [
  'slug', 'path', 'title', 'navLabel', 'summary', 'excerpt', 'status', 'blocks',
  'seo', 'parentId', 'sortOrder', 'template', 'priorityTier', 'customCss', 'appearance',
] as const;

const POST_FIELDS = [
  'slug', 'title', 'excerpt', 'body', 'blocks', 'layout', 'kind', 'status', 'seo',
  'coverMediaId', 'primaryCategoryId', 'readingMinutes', 'customCss', 'appearance',
] as const;

/** A project's content columns (2.14). Terms live in their own table and are not versioned. */
const PROJECT_FIELDS = [
  'slug', 'title', 'summary', 'excerpt', 'intro', 'status', 'blocks', 'seo', 'customCss', 'options',
  'coverMediaId', 'hoverMediaId', 'heroMediaId', 'client', 'year', 'url', 'sortOrder', 'featured',
] as const;

/** A saved block's content (2.15). Its mode is not versioned — changing it is a decision, not an edit. */
const SAVED_BLOCK_FIELDS = ['name', 'description', 'category', 'tree'] as const;

export function snapshotFields(entityType: RevisionEntity): readonly string[] {
  if (entityType === 'saved_block') return SAVED_BLOCK_FIELDS;
  return entityType === 'page' ? PAGE_FIELDS : entityType === 'project' ? PROJECT_FIELDS : POST_FIELDS;
}

/** Reduce a row to the fields a revision stores. */
export function toSnapshot(entityType: RevisionEntity, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of snapshotFields(entityType)) {
    if (field in row) out[field] = row[field] ?? null;
  }
  return out;
}

export type CaptureInput = {
  entityType: RevisionEntity;
  entityId: string;
  row: Record<string, unknown>;
  reason?: 'create' | 'update' | 'restore';
  actorId?: string | null;
  actorEmail?: string | null;
};

/**
 * Record the state of a page or post after a write.
 *
 * Skips the write entirely when nothing in the snapshot changed, so repeatedly
 * saving an unchanged form does not bury the real history under duplicates.
 */
export async function captureRevision(input: CaptureInput): Promise<void> {
  /* Every content write passes through here, which makes it the one place
     the saved-block usage index can be kept current without a save route
     forgetting to (2.15). It never throws, like the capture itself. */
  const blocks = (input.row.blocks ?? input.row.tree) as AnyBlock[] | undefined;
  if (Array.isArray(blocks)) await recordUsage(USAGE_KIND[input.entityType], input.entityId, blocks);

  try {
    const snapshot = toSnapshot(input.entityType, input.row);

    const [latest] = await db
      .select({ n: contentRevisions.revisionNumber, snapshot: contentRevisions.snapshot })
      .from(contentRevisions)
      .where(
        and(
          eq(contentRevisions.entityType, input.entityType),
          eq(contentRevisions.entityId, input.entityId),
        ),
      )
      .orderBy(desc(contentRevisions.revisionNumber))
      .limit(1);

    // Both sides go through `toSnapshot` before comparing. Postgres stores
    // jsonb with its own key order, so the value read back never matches the
    // key order of a freshly built object — comparing them raw made every
    // no-op save look like a change and doubled the history.
    if (latest && JSON.stringify(toSnapshot(input.entityType, latest.snapshot)) === JSON.stringify(snapshot)) {
      return;
    }

    await db.insert(contentRevisions).values({
      entityType: input.entityType,
      entityId: input.entityId,
      revisionNumber: (latest?.n ?? 0) + 1,
      snapshot,
      reason: input.reason ?? 'update',
      authorId: input.actorId ?? null,
      authorEmail: input.actorEmail ?? null,
    });

    await prune(input.entityType, input.entityId);
  } catch (error) {
    console.error('[revisions] capture failed', {
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}

/** Drop everything older than the newest REVISION_LIMIT for one entity. */
async function prune(entityType: RevisionEntity, entityId: string): Promise<void> {
  const keep = await db
    .select({ id: contentRevisions.id })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entityType, entityType), eq(contentRevisions.entityId, entityId)))
    .orderBy(desc(contentRevisions.revisionNumber))
    .limit(REVISION_LIMIT);

  if (keep.length < REVISION_LIMIT) return;

  const cutoff = keep[keep.length - 1]!.id;
  const [cutoffRow] = await db
    .select({ n: contentRevisions.revisionNumber })
    .from(contentRevisions)
    .where(eq(contentRevisions.id, cutoff))
    .limit(1);
  if (!cutoffRow) return;

  await db
    .delete(contentRevisions)
    .where(
      and(
        eq(contentRevisions.entityType, entityType),
        eq(contentRevisions.entityId, entityId),
        lt(contentRevisions.revisionNumber, cutoffRow.n),
      ),
    );
}

export type RevisionSummary = {
  id: string;
  revisionNumber: number;
  reason: string;
  authorEmail: string | null;
  authorName: string | null;
  createdAt: Date;
  /** Snapshot fields that differ from the revision immediately before it. */
  changed: string[];
};

/** The history of one entity, newest first, without the snapshot bodies. */
export async function listRevisions(
  entityType: RevisionEntity,
  entityId: string,
): Promise<RevisionSummary[]> {
  const rows = await db
    .select({
      id: contentRevisions.id,
      revisionNumber: contentRevisions.revisionNumber,
      reason: contentRevisions.reason,
      snapshot: contentRevisions.snapshot,
      authorEmail: contentRevisions.authorEmail,
      createdAt: contentRevisions.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(contentRevisions)
    .leftJoin(users, eq(users.id, contentRevisions.authorId))
    .where(and(eq(contentRevisions.entityType, entityType), eq(contentRevisions.entityId, entityId)))
    .orderBy(desc(contentRevisions.revisionNumber));

  return rows.map((row, i) => {
    // Rows are newest first, so the previous revision is the *next* element.
    const previous = rows[i + 1]?.snapshot;
    const changed = previous
      ? snapshotFields(entityType).filter(
          (f) => JSON.stringify(row.snapshot[f]) !== JSON.stringify(previous[f]),
        )
      : [];

    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();

    return {
      id: row.id,
      revisionNumber: row.revisionNumber,
      reason: row.reason,
      authorEmail: row.authorEmail,
      authorName: name || null,
      createdAt: row.createdAt,
      changed,
    };
  });
}

export async function getRevision(id: string) {
  const [row] = await db.select().from(contentRevisions).where(eq(contentRevisions.id, id)).limit(1);
  return row ?? null;
}

/**
 * Build the update from the allowlist rather than spreading the snapshot.
 *
 * A snapshot is JSON in a column: if one were ever tampered with it could
 * otherwise name any column on the table. Only the fields a revision is
 * allowed to restore make it into the SET clause.
 */
function restorableSet(entityType: RevisionEntity, snapshot: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of snapshotFields(entityType)) {
    if (field in snapshot) out[field] = snapshot[field];
  }
  out.updatedAt = new Date();
  return out;
}

export type RestoreResult =
  | { ok: true; entityType: RevisionEntity; entityId: string; revisionNumber: number; path: string | null }
  | { ok: false; reason: 'not_found' | 'entity_missing' };

/**
 * Write a revision's snapshot back over the live row.
 *
 * The restore is itself a write, so it captures a new revision — the history
 * gains an entry rather than rewinding, and an accidental restore can itself
 * be undone.
 */
export async function restoreRevision(
  id: string,
  actor: { id: string; email: string },
): Promise<RestoreResult> {
  const revision = await getRevision(id);
  if (!revision) return { ok: false, reason: 'not_found' };

  const snapshot = revision.snapshot as Record<string, unknown>;

  if (revision.entityType === 'page') {
    const [existing] = await db.select().from(pages).where(eq(pages.id, revision.entityId)).limit(1);
    if (!existing) return { ok: false, reason: 'entity_missing' };

    const [updated] = await db
      .update(pages)
      .set(restorableSet('page', snapshot))
      .where(eq(pages.id, revision.entityId))
      .returning();

    await captureRevision({
      entityType: 'page',
      entityId: revision.entityId,
      row: updated as unknown as Record<string, unknown>,
      reason: 'restore',
      actorId: actor.id,
      actorEmail: actor.email,
    });

    return {
      ok: true,
      entityType: 'page',
      entityId: revision.entityId,
      revisionNumber: revision.revisionNumber,
      path: updated?.path ?? null,
    };
  }

  if (revision.entityType === 'saved_block') {
    const [existing] = await db.select().from(savedBlocks).where(eq(savedBlocks.id, revision.entityId)).limit(1);
    if (!existing) return { ok: false, reason: 'entity_missing' };
    const [updated] = await db
      .update(savedBlocks)
      .set(restorableSet('saved_block', snapshot))
      .where(eq(savedBlocks.id, revision.entityId))
      .returning();
    await captureRevision({
      entityType: 'saved_block',
      entityId: revision.entityId,
      row: updated as unknown as Record<string, unknown>,
      reason: 'restore',
      actorId: actor.id,
      actorEmail: actor.email,
    });
    return { ok: true, entityType: 'saved_block', entityId: revision.entityId, revisionNumber: revision.revisionNumber, path: null };
  }

  if (revision.entityType === 'project') {
    const [existing] = await db.select().from(projects).where(eq(projects.id, revision.entityId)).limit(1);
    if (!existing) return { ok: false, reason: 'entity_missing' };
    const [updated] = await db
      .update(projects)
      .set(restorableSet('project', snapshot))
      .where(eq(projects.id, revision.entityId))
      .returning();
    await captureRevision({
      entityType: 'project',
      entityId: revision.entityId,
      row: updated as unknown as Record<string, unknown>,
      reason: 'restore',
      actorId: actor.id,
      actorEmail: actor.email,
    });
    return {
      ok: true,
      entityType: 'project',
      entityId: revision.entityId,
      revisionNumber: revision.revisionNumber,
      path: updated ? await projectPathById(await getPermalinks(), updated.id) : null,
    };
  }

  const [existing] = await db.select().from(posts).where(eq(posts.id, revision.entityId)).limit(1);
  if (!existing) return { ok: false, reason: 'entity_missing' };

  const [updated] = await db
    .update(posts)
    .set(restorableSet('post', snapshot))
    .where(eq(posts.id, revision.entityId))
    .returning();

  await captureRevision({
    entityType: 'post',
    entityId: revision.entityId,
    row: updated as unknown as Record<string, unknown>,
    reason: 'restore',
    actorId: actor.id,
    actorEmail: actor.email,
  });

  return {
    ok: true,
    entityType: 'post',
    entityId: revision.entityId,
    revisionNumber: revision.revisionNumber,
    path: updated ? await postPathById(await getPermalinks(), updated.id) : null,
  };
}

/** History goes with the content it describes. */
export async function deleteRevisionsFor(entityType: RevisionEntity, entityIds: string[]) {
  if (entityIds.length === 0) return;
  // Deleted content uses nothing any more.
  await forgetUsage(USAGE_KIND[entityType], entityIds);
  await db
    .delete(contentRevisions)
    .where(
      and(eq(contentRevisions.entityType, entityType), inArray(contentRevisions.entityId, entityIds)),
    );
}

/** Used by the editor to show "12 revisions" without loading them. */
export async function countRevisions(entityType: RevisionEntity, entityId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entityType, entityType), eq(contentRevisions.entityId, entityId)));
  return row?.n ?? 0;
}
