import 'server-only';
import { eq, lt, sql } from 'drizzle-orm';
import {
  RETENTION_KINDS,
  type Retention,
  type RetentionKind,
  countOf,
  cutoff,
  defaultRetention,
  inDays,
  retentionSchema,
  sweepDue,
} from '@/lib/retention';
import type { Answer } from '@/lib/forms';
import { audit } from '@/server/auth/audit';
import { db } from '@/server/db';
import { applications, enquiries, formSubmissions, settings } from '@/server/db/schema';
import { deleteStoredFile } from '@/server/applications/storage';

/* ═══════════════════════════════════════════════════════════════════════════
   Deleting what is past its keeping
   ───────────────────────────────────────────────────────────────────────────
   Three kinds — applications, form submissions and contact enquiries —
   sharing everything but the table they read. Two of them can hold a file the
   database cannot unlink, so both collect the filenames before the rows go:
   afterwards nothing says which files were whose, and they would sit in the
   directory for ever. An enquiry is text only and has none.

   Nothing here throws. A sweep that fails must not take down the page that
   triggered it — an inbox, or worse, a public form somebody is in the middle
   of submitting.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The saved period for one kind. Never throws: an unreadable row is the default. */
export async function getRetention(kind: RetentionKind): Promise<Retention> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, kind)).limit(1);
    const parsed = retentionSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : defaultRetention();
  } catch {
    return defaultRetention();
  }
}

export async function saveRetention(
  kind: RetentionKind,
  next: Retention,
  actorId?: string,
): Promise<Retention> {
  await db
    .insert(settings)
    .values({ key: kind, value: next, updatedById: actorId ?? null })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedById: actorId ?? null, updatedAt: new Date() },
    });
  return next;
}

export type SweepResult = {
  kind: RetentionKind;
  ran: boolean;
  removed: number;
  keptDays: number;
  /** How many files went with the rows. Zero for a kind that has none. */
  files: number;
};

/**
 * The rows past their keeping, and the files they hold.
 *
 * Each kind answers the same two questions — which rows, and which files —
 * so the sweep itself has one shape and the tables differ only here.
 */
async function doomed(kind: RetentionKind, before: Date): Promise<{ count: number; files: string[] }> {
  if (kind === 'applications') {
    const rows = await db
      .select({ cvFilename: applications.cvFilename })
      .from(applications)
      .where(lt(applications.createdAt, before));
    return { count: rows.length, files: rows.map((r) => r.cvFilename).filter((n): n is string => !!n) };
  }

  /* An enquiry is the contact form's own table: text only, no attachment, so
     there is nothing to unlink. */
  if (kind === 'enquiries') {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(enquiries)
      .where(lt(enquiries.createdAt, before));
    return { count: row?.n ?? 0, files: [] };
  }

  /* A submission's files live inside its answers, one per `file` question, so
     the filenames have to be read out of the jsonb rather than off a column. */
  const rows = await db
    .select({ answers: formSubmissions.answers })
    .from(formSubmissions)
    .where(lt(formSubmissions.createdAt, before));

  const files = rows.flatMap((row) =>
    ((row.answers ?? []) as Answer[]).map((answer) => answer.file?.name).filter((n): n is string => !!n),
  );
  return { count: rows.length, files };
}

async function eraseRows(kind: RetentionKind, before: Date): Promise<void> {
  if (kind === 'applications') {
    await db.delete(applications).where(lt(applications.createdAt, before));
    return;
  }
  if (kind === 'enquiries') {
    await db.delete(enquiries).where(lt(enquiries.createdAt, before));
    return;
  }
  await db.delete(formSubmissions).where(lt(formSubmissions.createdAt, before));
}

/**
 * Delete one kind's rows past their keeping, and their files with them.
 *
 * Files first, one at a time rather than in a bulk statement, because a
 * missing file is not an error — `deleteStoredFile` never throws — so one
 * gone file cannot stop the sweep half way and leave the rest undeleted for
 * another six hours.
 */
export async function sweep(kind: RetentionKind, options: { force?: boolean } = {}): Promise<SweepResult> {
  const nothing = { kind, ran: false, removed: 0, keptDays: 0, files: 0 };
  try {
    const retention = await getRetention(kind);
    if (retention.days === 0) return nothing;
    if (!options.force && !sweepDue(retention)) {
      return { kind, ran: false, removed: 0, keptDays: retention.days, files: 0 };
    }

    const before = cutoff(retention.days);
    const { count, files } = await doomed(kind, before);

    for (const name of files) await deleteStoredFile(name);
    if (count > 0) await eraseRows(kind, before);

    await saveRetention(kind, { ...retention, sweptAt: new Date().toISOString(), lastRemoved: count });

    /* Recorded because erasing personal data is an event worth accounting
       for — and, as everywhere else, it records how many, never whose. */
    if (count > 0) {
      await audit({
        action: `${kind}.retention`,
        targetType: 'settings',
        targetId: kind,
        summary: `Deleted ${countOf(kind, count)} older than ${inDays(retention.days)}`,
        metadata: { kind, days: retention.days, removed: count, files: files.length },
      });
    }

    return { kind, ran: true, removed: count, keptDays: retention.days, files: files.length };
  } catch {
    return nothing;
  }
}

/** Every kind, for the command that runs from a site's own cron. */
export async function sweepAll(options: { force?: boolean } = {}): Promise<SweepResult[]> {
  const results: SweepResult[] = [];
  for (const kind of RETENTION_KINDS) results.push(await sweep(kind, options));
  return results;
}
