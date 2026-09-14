import Link from 'next/link';
import { ENGINE_VERSION } from '@/lib/version';
import { can } from '@/server/auth/rbac';
import type { SessionUser } from '@/server/auth/session';
import { getUpdateState, updateAvailable } from '@/server/engine/releases';

/* ═══════════════════════════════════════════════════════════════════════════
   "There is a newer engine" (package 6, phase B)
   ───────────────────────────────────────────────────────────────────────────
   Shown on the dashboard, to administrators only. It reads what the last
   check stored and never checks by itself: a page render is the wrong place
   to wait on somebody else's server, and a notice that made the dashboard
   slow would be a worse notice.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function UpdateNotice({ user }: { user: SessionUser | null }) {
  if (!can(user, 'updates:read')) return null;

  const state = await getUpdateState().catch(() => null);
  if (!state || !updateAvailable(state)) return null;

  const behind = state.pending.length;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-flare bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="m-0 text-[15px] text-bone">
          Engine {state.latestVersion} is available — this site runs {ENGINE_VERSION}.
        </p>
        <p className="m-0 mt-1 text-[13px] text-smoke">
          {behind > 1 ? `${behind} releases waiting. ` : ''}
          {state.requiresMigration ? 'One of them changes the database.' : 'No database changes.'}
        </p>
      </div>
      <Link
        href="/admin/updates"
        className="inline-flex items-center border-2 border-flare px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft transition-colors hover:bg-flare hover:text-ink"
      >
        See what changed
      </Link>
    </div>
  );
}
