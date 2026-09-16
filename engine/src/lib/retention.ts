import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   How long what a visitor sent is kept
   ───────────────────────────────────────────────────────────────────────────
   Keeping somebody's CV — or their answers to a form — for ever is a decision,
   and it is one nobody makes on purpose: it is what happens when nothing
   deletes anything. So each kind has a retention period, it is switched on by
   default, and turning it *off* is the deliberate act.

   The sweep is not a cron job. This engine has no scheduler, for the same
   reason scheduled publishing has none: something has to be running, and on a
   single Node process the honest trigger is the traffic the site already has.
   So the sweep is throttled and runs off two events that happen on any site
   in use — something arriving, and somebody opening the inbox it arrived in.

   That means a site nobody touches for a month does not delete for a month.
   Which is a real limitation and is written down here rather than glossed:
   a site with a legal deadline to meet should run `npm run retention:sweep`
   from its own cron, which sweeps every kind with `force`.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Everything the engine deletes on a schedule, each with its own period.
 *
 * Separate periods on purpose: a CV is kept for a hiring cycle, a form answer
 * for however long the conversation it started lasts, and an enquiry for as
 * long as the sales conversation might reopen. One number cannot be right for
 * all three. The settings key is the kind's own name.
 *
 * Newsletter sign-ups are deliberately *not* here: an address on a mailing
 * list is there because somebody asked to be on it, and deleting it after a
 * year would unsubscribe them without being asked. That one is unsubscribed,
 * not expired.
 */
export const RETENTION_KINDS = ['applications', 'submissions', 'enquiries'] as const;
export type RetentionKind = (typeof RETENTION_KINDS)[number];

export const RETENTION_LABELS: Record<RetentionKind, string> = {
  applications: 'applications',
  submissions: 'form submissions',
  enquiries: 'contact enquiries',
};

/** The same words for one of them, so a count of 1 reads as English. */
export const RETENTION_LABELS_ONE: Record<RetentionKind, string> = {
  applications: 'application',
  submissions: 'form submission',
  enquiries: 'contact enquiry',
};

export const countOf = (kind: RetentionKind, n: number) =>
  `${n} ${n === 1 ? RETENTION_LABELS_ONE[kind] : RETENTION_LABELS[kind]}`;

export const inDays = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** How often the sweep will actually do work, however often it is asked. */
export const SWEEP_THROTTLE_HOURS = 6;

export const retentionSchema = z.object({
  /**
   * Days to keep something after it arrives.
   *
   * A year by default: long enough to fill a role and reconsider somebody for
   * the next one, or to finish the conversation a form started, and short
   * enough that a stranger's details are not still on the server when they
   * have forgotten they wrote. `0` means keep for ever, and the screen makes
   * that look like the choice it is.
   */
  days: z.number().int().min(0).max(3650).default(365),

  /** When the sweep last ran, so it can be throttled. State, not settings. */
  sweptAt: z.string().datetime().optional(),
  /** What it removed last time, so the screen can show that it is working. */
  lastRemoved: z.number().int().min(0).optional(),
});

export type Retention = z.output<typeof retentionSchema>;

export const defaultRetention = (): Retention => retentionSchema.parse({});

/** Whether the sweep is due. A missing or unreadable date means yes. */
export function sweepDue(retention: Retention, now = Date.now()): boolean {
  if (retention.days === 0) return false;
  if (!retention.sweptAt) return true;
  const last = new Date(retention.sweptAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last > SWEEP_THROTTLE_HOURS * 3_600_000;
}

/** The moment before which something is past its keeping. */
export function cutoff(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
