'use client';

import { useState } from 'react';
import { AdminButton, Field, Input, Panel } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/admin/client';
import { errorMessage } from '@/app/(system)/admin/(panel)/_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   How long something is kept
   ───────────────────────────────────────────────────────────────────────────
   One panel, two inboxes. Applications and form submissions keep the same
   shape of setting for the same reason, and a second copy of this would be a
   second place for the wording about "keep for ever" to drift.

   The endpoint is the inbox's own collection route, which takes a PUT of
   `{ days }` and answers with the saved period — so this component needs to
   know nothing about which kind it is editing beyond where to send it.
   ═══════════════════════════════════════════════════════════════════════════ */

export type RetentionState = { days: number; sweptAt?: string; lastRemoved?: number };

export function RetentionPanel({
  endpoint,
  retention,
  canChange,
  /** Plural, lower case: "applications", "form submissions". */
  noun,
  /** What goes with the row — "and its CV", "and any files". */
  alsoDeletes,
  onSaved,
}: {
  endpoint: string;
  retention: RetentionState | undefined;
  canChange: boolean;
  noun: string;
  alsoDeletes: string;
  onSaved: () => void | Promise<unknown>;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saved = String(retention?.days ?? 365);
  const value = draft ?? saved;
  const days = Number(value) || 0;

  async function save() {
    setBusy(true);
    try {
      const result = await api<{ removed: number }>(endpoint, { method: 'PUT', json: { days } });
      setDraft(null);
      toast(
        result.removed > 0
          ? `Saved. ${result.removed} past the new period ${result.removed === 1 ? 'was' : 'were'} deleted.`
          : 'Saved.',
        'success',
      );
      await onSaved();
    } catch (caught) {
      toast(errorMessage(caught, 'The keeping period could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={`How long ${noun} are kept`}>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Keep for" hint="days after it arrives">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={3650}
              value={value}
              disabled={!canChange || busy}
              onChange={(e) => setDraft(e.target.value)}
              className="w-[120px]"
              aria-label={`Days to keep ${noun}`}
            />
            {canChange && (
              <AdminButton
                type="button"
                variant="secondary"
                disabled={busy || value === saved}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save'}
              </AdminButton>
            )}
          </div>
        </Field>
      </div>

      <p className="m-0 mt-4 max-w-[70ch] text-[13px] leading-relaxed text-ash">
        {days === 0 ? (
          <>
            <strong className="text-flare-soft">Nothing is deleted automatically.</strong> Everything stays on the
            server until somebody erases it by hand. That is a choice worth making on purpose.
          </>
        ) : (
          <>
            A row {alsoDeletes} is deleted {days} days after it arrives. The sweep runs when something arrives or
            somebody opens this screen, at most once every six hours — this engine has no scheduler, so a site
            nobody touches for a week does not delete for a week. Run{' '}
            <code className="font-mono text-flare-soft">npm run retention:sweep</code> from cron if the period has
            to be honoured whatever the traffic does.
          </>
        )}
      </p>

      {retention?.sweptAt && (
        <p className="m-0 mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-smoke">
          Last swept {formatDate(retention.sweptAt)}
          {typeof retention.lastRemoved === 'number' ? ` — ${retention.lastRemoved} removed` : ''}
        </p>
      )}

      {!canChange && (
        <p className="m-0 mt-3 text-[12px] text-smoke">
          Only an administrator can change this: it governs the erasure of personal data.
        </p>
      )}
    </Panel>
  );
}
