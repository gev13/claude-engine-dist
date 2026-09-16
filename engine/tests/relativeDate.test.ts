import { describe, expect, it } from 'vitest';
import { formatAbsolute, formatRelative, hasPassed, relativeParts } from '@/lib/relativeDate';

/* ═══════════════════════════════════════════════════════════════════════════
   "12 days ago", "12 days left"
   ───────────────────────────────────────────────────────────────────────────
   The arithmetic is pinned here so the wording can be left to Intl. What
   matters is choosing the unit a person would choose: six days is "6 days",
   not "1 week"; thirty-five days is "1 month", not "5 weeks".
   ═══════════════════════════════════════════════════════════════════════════ */

const NOW = new Date('2026-05-13T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

const DAY = 86_400_000;

describe('relativeParts', () => {
  it('counts days for anything inside a week', () => {
    expect(relativeParts(ago(12 * DAY), NOW)).toEqual({ value: -2, unit: 'week' });
    expect(relativeParts(ago(3 * DAY), NOW)).toEqual({ value: -3, unit: 'day' });
    expect(relativeParts(ahead(12 * DAY), NOW)).toEqual({ value: 2, unit: 'week' });
  });

  it('is negative in the past and positive in the future', () => {
    expect(relativeParts(ago(2 * DAY), NOW)!.value).toBeLessThan(0);
    expect(relativeParts(ahead(2 * DAY), NOW)!.value).toBeGreaterThan(0);
  });

  it('steps up to the unit a person would use', () => {
    expect(relativeParts(ago(45 * 60_000), NOW)).toEqual({ value: -45, unit: 'minute' });
    expect(relativeParts(ago(5 * 3_600_000), NOW)).toEqual({ value: -5, unit: 'hour' });
    expect(relativeParts(ago(35 * DAY), NOW)).toEqual({ value: -1, unit: 'month' });
    expect(relativeParts(ago(400 * DAY), NOW)).toEqual({ value: -1, unit: 'year' });
  });

  it('never rounds a real gap down to nothing', () => {
    // 36 hours is "2 days", not "1 day" and certainly not "0".
    expect(relativeParts(ago(1.5 * DAY), NOW)).toEqual({ value: -2, unit: 'day' });
    // Just over a minute must not become "0 minutes".
    expect(relativeParts(ago(61_000), NOW)!.value).toBe(-1);
  });

  it('treats the last minute as "now"', () => {
    expect(relativeParts(ago(10_000), NOW)).toEqual({ value: 0, unit: 'second' });
  });

  it('returns nothing for a date that is not one', () => {
    expect(relativeParts(new Date('nonsense'), NOW)).toBeNull();
  });
});

describe('formatRelative', () => {
  it('says it in English', () => {
    expect(formatRelative(ago(3 * DAY), 'en', NOW)).toMatch(/3 days ago/);
    expect(formatRelative(ahead(12 * DAY), 'en', NOW)).toMatch(/in 2 weeks/);
  });

  it('says it in the reader’s own language, without anybody translating it', () => {
    const russian = formatRelative(ago(3 * DAY), 'ru', NOW);
    const armenian = formatRelative(ago(3 * DAY), 'hy', NOW);
    // Not English, and not empty — the exact wording is Intl's business.
    expect(russian).not.toMatch(/days ago/);
    expect(russian.length).toBeGreaterThan(0);
    expect(armenian.length).toBeGreaterThan(0);
  });

  it('falls back rather than throwing on a language the runtime lacks', () => {
    expect(() => formatRelative(ago(DAY), 'zz-ZZ', NOW)).not.toThrow();
    expect(formatRelative(ago(DAY), 'zz-ZZ', NOW).length).toBeGreaterThan(0);
  });

  it('gives an empty string for a date that is not one', () => {
    expect(formatRelative(new Date('nonsense'), 'en', NOW)).toBe('');
  });
});

describe('formatAbsolute', () => {
  it('writes the date out in the reader’s language', () => {
    expect(formatAbsolute(new Date('2026-03-25T00:00:00Z'), 'en')).toMatch(/2026/);
    expect(formatAbsolute(new Date('2026-03-25T00:00:00Z'), 'ru')).toMatch(/2026/);
  });

  it('is empty for a date that is not one', () => {
    expect(formatAbsolute(new Date('nonsense'), 'en')).toBe('');
  });
});

describe('hasPassed', () => {
  it('knows a deadline from a date still to come', () => {
    expect(hasPassed(ago(DAY), NOW)).toBe(true);
    expect(hasPassed(ahead(DAY), NOW)).toBe(false);
  });

  it('treats an unreadable date as not passed, rather than as expired', () => {
    expect(hasPassed(new Date('nonsense'), NOW)).toBe(false);
  });
});
