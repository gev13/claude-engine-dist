import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ENGINE_VERSION, type Release, feedSchema, isNewer, releasesSince } from '@/lib/version';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Knowing there is an update (package 6, phase A)
   ───────────────────────────────────────────────────────────────────────────
   The feed is fetched from a fixed address in the environment, parsed against
   a schema, and kept in a settings row with the time it was taken. The result
   is data: a version string, a date and a sentence. Nothing in it is executed,
   and the only field that ever reaches a command line — the version — has to
   match the semver pattern first.

   The check is throttled, and never fails loudly: a site whose network is
   down is not a site in trouble, it is a site that does not yet know about a
   release.
   ═══════════════════════════════════════════════════════════════════════════ */

export const UPDATE_SETTING_KEY = 'engine.update';

/** How long a check is trusted before another is worth making. */
const THROTTLE_HOURS = 6;

/** Enough for a large feed, small enough that nothing silly is swallowed. */
const MAX_FEED_BYTES = 256 * 1024;

export const updateStateSchema = z.object({
  /** Whether this site looks for releases at all. */
  autoCheck: z.boolean().default(true),
  checkedAt: z.string().optional(),
  /** The newest version the feed offered when it was last read. */
  latestVersion: z.string().optional(),
  latestDate: z.string().optional(),
  latestSummary: z.string().optional(),
  latestUrl: z.string().optional(),
  requiresMigration: z.boolean().optional(),
  /** Everything between this site and the newest, newest first. */
  pending: z.array(z.object({ version: z.string(), date: z.string(), summary: z.string() })).max(50).default([]),
  /** The version an email has already gone out for, so it goes out once. */
  notifiedVersion: z.string().optional(),
  /** Why the last check did not work, if it did not. */
  error: z.string().optional(),
});

export type UpdateState = z.output<typeof updateStateSchema>;

export const EMPTY_STATE: UpdateState = updateStateSchema.parse({});

export async function getUpdateState(): Promise<UpdateState> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, UPDATE_SETTING_KEY)).limit(1);
    if (!row) return EMPTY_STATE;
    const parsed = updateStateSchema.safeParse(row.value);
    return parsed.success ? parsed.data : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

async function saveUpdateState(state: UpdateState): Promise<UpdateState> {
  await db
    .insert(settings)
    .values({ key: UPDATE_SETTING_KEY, value: state })
    .onConflictDoUpdate({ target: settings.key, set: { value: state, updatedAt: new Date() } });
  return state;
}

/** Whether the site is behind the newest version the feed offered. */
export function updateAvailable(state: UpdateState): boolean {
  return Boolean(state.latestVersion && isNewer(state.latestVersion, ENGINE_VERSION));
}

/** A new version nobody has been emailed about yet. */
export function shouldAnnounce(state: UpdateState): boolean {
  return updateAvailable(state) && state.notifiedVersion !== state.latestVersion;
}

/** Remember that this version has been announced, so it is announced once. */
export async function markAnnounced(version: string): Promise<void> {
  const state = await getUpdateState();
  await saveUpdateState({ ...state, notifiedVersion: version });
}

function stale(state: UpdateState): boolean {
  if (!state.checkedAt) return true;
  const taken = new Date(state.checkedAt).getTime();
  if (Number.isNaN(taken)) return true;
  return Date.now() - taken > THROTTLE_HOURS * 3_600_000;
}

/** Read the feed, with a timeout and a size cap. Throws with a plain reason. */
async function readFeed(): Promise<ReturnType<typeof feedSchema.parse>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(env.ENGINE_RELEASE_FEED, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`The release feed answered ${response.status}.`);

    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) throw new Error('The release feed is larger than expected.');

    const parsed = feedSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error('The release feed is not in the expected shape.');
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bring the stored state up to date. Returns it either way: a failed check
 * records why and keeps whatever was known before.
 */
export async function checkForUpdate(options: { force?: boolean } = {}): Promise<UpdateState> {
  const current = await getUpdateState();
  if (!options.force && (!current.autoCheck || !stale(current))) return current;

  try {
    const feed = await readFeed();
    const pending: Release[] = releasesSince(feed, ENGINE_VERSION);
    const newest = pending[0];

    return await saveUpdateState({
      ...current,
      checkedAt: new Date().toISOString(),
      latestVersion: feed.latest,
      latestDate: newest?.date,
      latestSummary: newest?.summary,
      latestUrl: newest?.url,
      requiresMigration: pending.some((release) => release.requiresMigration),
      pending: pending.map((release) => ({ version: release.version, date: release.date, summary: release.summary })),
      error: undefined,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The release feed could not be read.';
    return saveUpdateState({ ...current, checkedAt: new Date().toISOString(), error: reason });
  }
}

/** Switch looking for releases on or off. */
export async function setAutoCheck(autoCheck: boolean): Promise<UpdateState> {
  const state = await getUpdateState();
  return saveUpdateState({ ...state, autoCheck });
}
