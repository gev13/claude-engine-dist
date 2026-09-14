import { z } from 'zod';
import { env } from '@/lib/env';
import { ENGINE_VERSION } from '@/lib/version';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { notifyEngineUpdate } from '@/server/mail/notify';
import {
  checkForUpdate,
  getUpdateState,
  markAnnounced,
  setAutoCheck,
  shouldAnnounce,
  updateAvailable,
} from '@/server/engine/releases';
import { clearRun, getRunState, startUpdate } from '@/server/engine/update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What engine this site runs, and whether a newer one exists (package 6).
 *
 * Reading the feed is the only outward call, and its address is fixed in the
 * environment — nothing an administrator types decides what the server
 * fetches.
 */
function payload(version: string, state: Awaited<ReturnType<typeof getUpdateState>>) {
  return {
    version,
    state,
    available: updateAvailable(state),
    /** Whether this deployment may take an update from the panel at all. */
    canApply: env.ENGINE_UPDATE_ENABLED,
  };
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'updates:read');
    if (!guard.ok) return guard.response;
    const [state, run] = await Promise.all([getUpdateState(), getRunState()]);
    return ok({ ...payload(ENGINE_VERSION, state), run });
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('check') }),
  z.object({ action: z.literal('autoCheck'), value: z.boolean() }),
  /** The version is checked against the feed and the semver pattern before anything runs. */
  z.object({ action: z.literal('apply'), version: z.string().min(1).max(40), confirm: z.literal('update this site') }),
  z.object({ action: z.literal('clearRun') }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'updates:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const ip = clientIp(request.headers);

    if (parsed.data.action === 'autoCheck') {
      const state = await setAutoCheck(parsed.data.value);
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'engine.update.autocheck',
        targetType: 'engine',
        summary: parsed.data.value ? 'Looking for engine releases' : 'No longer looking for engine releases',
        ip,
      });
      return ok(payload(ENGINE_VERSION, state));
    }

    if (parsed.data.action === 'clearRun') {
      const run = await clearRun();
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'engine.update.cleared',
        targetType: 'engine',
        summary: 'Cleared the last update run',
        ip,
      });
      return ok({ ...payload(ENGINE_VERSION, await getUpdateState()), run });
    }

    if (parsed.data.action === 'apply') {
      const started = await startUpdate(parsed.data.version, guard.user.email);

      if ('ok' in started && started.ok === false) {
        await audit({
          actorId: guard.user.id,
          actorEmail: guard.user.email,
          action: 'engine.update.refused',
          targetType: 'engine',
          targetId: parsed.data.version,
          summary: `Refused to update to ${parsed.data.version}: ${started.reason}`,
          ip,
        });
        return badRequest(started.reason);
      }

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'engine.update.started',
        targetType: 'engine',
        targetId: parsed.data.version,
        summary: `Started updating from ${ENGINE_VERSION} to ${parsed.data.version}`,
        ip,
      });
      return ok({ ...payload(ENGINE_VERSION, await getUpdateState()), run: started });
    }

    const state = await checkForUpdate({ force: true });

    // One message per version, and only for a version nobody has been told about.
    if (shouldAnnounce(state) && state.latestVersion) {
      notifyEngineUpdate({
        version: state.latestVersion,
        date: state.latestDate,
        summary: state.latestSummary,
        url: state.latestUrl,
        behind: state.pending.length || 1,
        requiresMigration: state.requiresMigration === true,
        markAnnounced,
      });
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'engine.update.check',
      targetType: 'engine',
      summary: state.error
        ? `Could not read the release feed: ${state.error}`
        : updateAvailable(state)
          ? `Running ${ENGINE_VERSION}; ${state.latestVersion} is available`
          : `Running ${ENGINE_VERSION}, which is current`,
      ip,
    });

    return ok(payload(ENGINE_VERSION, state));
  });
}
