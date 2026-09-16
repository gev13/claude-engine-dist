import { describe, expect, it } from 'vitest';
import {
  RETENTION_KINDS,
  RETENTION_LABELS,
  RETENTION_LABELS_ONE,
  SWEEP_THROTTLE_HOURS,
  countOf,
  cutoff,
  defaultRetention,
  inDays,
  retentionSchema,
  sweepDue,
} from '@/lib/retention';

/* ═══════════════════════════════════════════════════════════════════════════
   How long what a visitor sent is kept
   ───────────────────────────────────────────────────────────────────────────
   The arithmetic is pinned here because getting it wrong is not a cosmetic
   bug in either direction: too eager deletes a CV somebody still needs, too
   lazy keeps personal data past the period the site promised.

   The sweep itself needs a database and is exercised end to end; what is
   testable in isolation is *when* it decides to run and *what* it decides is
   past its keeping.
   ═══════════════════════════════════════════════════════════════════════════ */

const HOUR = 3_600_000;
const NOW = new Date('2026-09-16T12:00:00.000Z').getTime();
const agoHours = (n: number) => new Date(NOW - n * HOUR).toISOString();

describe('the default', () => {
  /* Keeping a CV for ever is what happens when nothing deletes anything, so
     the default has to be a period — not "off". */
  it('keeps applications for a year unless told otherwise', () => {
    expect(defaultRetention().days).toBe(365);
    expect(defaultRetention().sweptAt).toBeUndefined();
  });

  it('refuses a period that is not a whole number of days in range', () => {
    expect(retentionSchema.safeParse({ days: -1 }).success).toBe(false);
    expect(retentionSchema.safeParse({ days: 1.5 }).success).toBe(false);
    expect(retentionSchema.safeParse({ days: 4000 }).success).toBe(false);
    expect(retentionSchema.safeParse({ days: 0 }).success).toBe(true);
    expect(retentionSchema.safeParse({ days: 30 }).success).toBe(true);
  });
});

describe('when the sweep runs', () => {
  it('runs the first time, when it has never run', () => {
    expect(sweepDue(retentionSchema.parse({ days: 365 }), NOW)).toBe(true);
  });

  it('waits out the throttle, then runs again', () => {
    const justRan = retentionSchema.parse({ days: 365, sweptAt: agoHours(1) });
    expect(sweepDue(justRan, NOW)).toBe(false);

    const longAgo = retentionSchema.parse({ days: 365, sweptAt: agoHours(SWEEP_THROTTLE_HOURS + 1) });
    expect(sweepDue(longAgo, NOW)).toBe(true);
  });

  /* Zero is "keep for ever", and the sweep must not merely find nothing to
     do — it must not run at all, or it would rewrite `sweptAt` for ever. */
  it('never runs when deletion is switched off', () => {
    expect(sweepDue(retentionSchema.parse({ days: 0 }), NOW)).toBe(false);
    expect(sweepDue(retentionSchema.parse({ days: 0, sweptAt: agoHours(500) }), NOW)).toBe(false);
  });

  it('treats an unreadable date as "never swept" rather than skipping for ever', () => {
    const broken = { days: 365, sweptAt: 'not a date' } as never;
    expect(sweepDue(broken, NOW)).toBe(true);
  });
});

describe('what counts as past its keeping', () => {
  const now = new Date(NOW);

  it('counts back exactly the number of days', () => {
    expect(cutoff(30, now).toISOString()).toBe('2026-08-17T12:00:00.000Z');
    expect(cutoff(1, now).toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });

  it('a year is 365 days back, not a calendar year', () => {
    // Stated rather than assumed: the field is days, and the screen says days.
    expect(NOW - cutoff(365, now).getTime()).toBe(365 * 24 * HOUR);
  });
});

describe('the kinds', () => {
  /* Two settings rows, each named after its kind — `settings.key` is the
     primary key, so the names must stay distinct and must not collide with
     anything else stored there. */
  it('are distinct, and each names its own row', () => {
    expect(new Set(RETENTION_KINDS).size).toBe(RETENTION_KINDS.length);
    expect(RETENTION_KINDS).toContain('applications');
    expect(RETENTION_KINDS).toContain('submissions');
    expect(RETENTION_KINDS).toContain('enquiries');
  });

  /* Newsletter sign-ups are deliberately absent: an address is on a mailing
     list because somebody asked to be, and expiring it after a year would
     unsubscribe them without being asked. That one is unsubscribed, not
     expired — so if it ever appears here, it was not a decision. */
  it('leaves newsletter sign-ups out', () => {
    expect(RETENTION_KINDS).not.toContain('newsletter');
    expect(RETENTION_KINDS).not.toContain('subscribers');
  });

  it('each have wording for the screens and the log, singular and plural', () => {
    for (const kind of RETENTION_KINDS) {
      expect(RETENTION_LABELS[kind], kind).toBeTruthy();
      expect(RETENTION_LABELS_ONE[kind], kind).toBeTruthy();
      // "1 form submissions" and "older than 1 days" both shipped once.
      expect(countOf(kind, 1)).toBe(`1 ${RETENTION_LABELS_ONE[kind]}`);
      expect(countOf(kind, 2)).toBe(`2 ${RETENTION_LABELS[kind]}`);
    }
    expect(inDays(1)).toBe('1 day');
    expect(inDays(365)).toBe('365 days');
  });

  /* Separate periods on purpose: a CV is kept for a hiring cycle and a form
     answer for however long the conversation it started lasts. One number
     cannot be right for both, so nothing here may share state. */
  it('start from the same default without sharing it', () => {
    const a = defaultRetention();
    const b = defaultRetention();
    a.days = 30;
    expect(b.days).toBe(365);
  });
});
