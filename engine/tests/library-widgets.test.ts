import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { areaPath, formatChartValue, linePoints, niceScale, pieSlices } from '../src/lib/chart';
import { type DayHours, formatClock, groupDays, isTimeZone, openStatus, zonedMoment } from '../src/lib/hours';
import { shareHref } from '../src/lib/share';

describe('chart arithmetic', () => {
  it('rounds the axis up to a tidy top', () => {
    expect(niceScale(87).ticks).toEqual([0, 25, 50, 75, 100]);
    expect(niceScale(40).ticks).toEqual([0, 10, 20, 30, 40]);
    expect(niceScale(8200).max).toBe(10000);
    expect(niceScale(0).max).toBe(1);
  });

  it('centres line points in their slots and closes an area to the baseline', () => {
    const points = linePoints([0, 100], 100);
    expect(points).toEqual([
      { x: 25, y: 100 },
      { x: 75, y: 0 },
    ]);
    expect(areaPath(points)).toBe('M25 100 L75 0 L75 100 L25 100 Z');
  });

  it('turns pie values into shares of 100 with their starts', () => {
    expect(pieSlices([1, 1, 2])).toEqual([
      { share: 25, start: 0 },
      { share: 25, start: 25 },
      { share: 50, start: 50 },
    ]);
    expect(pieSlices([0, 0])).toEqual([
      { share: 0, start: 0 },
      { share: 0, start: 0 },
    ]);
  });

  it('prints values with grouped thousands and the chosen affixes', () => {
    expect(formatChartValue(1234.5, '€', 'k')).toBe('€1,234.5k');
  });

  it('keeps charts to closed kinds and non-negative values', () => {
    const base = { series: [{ name: 'A' }], rows: [{ label: 'x', values: [1] }] };
    expect(blockSchemas.chart.parse(base).kind).toBe('column');
    expect(blockSchemas.chart.safeParse({ ...base, kind: 'radar' }).success).toBe(false);
    expect(blockSchemas.chart.safeParse({ ...base, rows: [{ label: 'x', values: [-1] }] }).success).toBe(false);
  });
});

const WEEKDAYS_9_TO_530: DayHours[] = (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) => ({ day, slots: [{ open: '09:00', close: '17:30' }] }));

describe('opening hours', () => {
  it('knows when a weekday office is open and when it opens next', () => {
    expect(openStatus(WEEKDAYS_9_TO_530, { day: 0, minute: 600 })).toEqual({ open: true, always: false, closes: { day: 0, minute: 1050 } });
    expect(openStatus(WEEKDAYS_9_TO_530, { day: 0, minute: 1080 })).toEqual({ open: false, opens: { day: 1, minute: 540 } });
    // Saturday lunchtime: next open is Monday morning.
    expect(openStatus(WEEKDAYS_9_TO_530, { day: 5, minute: 720 })).toEqual({ open: false, opens: { day: 0, minute: 540 } });
  });

  it('runs a late slot past midnight, including Sunday night into Monday', () => {
    const bar: DayHours[] = [{ day: 'fri', slots: [{ open: '18:00', close: '02:00' }] }, { day: 'sun', slots: [{ open: '20:00', close: '03:00' }] }];
    expect(openStatus(bar, { day: 5, minute: 60 })).toMatchObject({ open: true, closes: { day: 5, minute: 120 } });
    expect(openStatus(bar, { day: 0, minute: 60 })).toMatchObject({ open: true, closes: { day: 0, minute: 180 } });
  });

  it('joins stretches that touch, so it never says "closes at midnight" when it does not', () => {
    const late: DayHours[] = [{ day: 'sun', slots: [{ open: '22:00', close: '24:00' }] }, { day: 'mon', slots: [{ open: '00:00', close: '08:00' }] }];
    expect(openStatus(late, { day: 6, minute: 1380 })).toMatchObject({ open: true, closes: { day: 0, minute: 480 } });
    const always: DayHours[] = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => ({ day, slots: [{ open: '00:00', close: '24:00' }] }));
    expect(openStatus(always, { day: 3, minute: 5 })).toEqual({ open: true, always: true });
    expect(openStatus([], { day: 3, minute: 5 })).toEqual({ open: false });
  });

  it('merges days that keep the same hours and can start the week on Sunday', () => {
    expect(groupDays(WEEKDAYS_9_TO_530, 'mon', true).map((row) => row.days.join())).toEqual(['mon,tue,wed,thu,fri', 'sat,sun']);
    expect(groupDays(WEEKDAYS_9_TO_530, 'sun', false)[0]!.days).toEqual(['sun']);
  });

  it('reads the day and minute in the chosen zone', () => {
    // 14 September 2026 is a Monday; London is on summer time.
    expect(zonedMoment(new Date('2026-09-14T08:30:00Z'), 'Europe/London')).toEqual({ day: 0, minute: 570 });
    expect(isTimeZone('Europe/London')).toBe(true);
    expect(isTimeZone('Mars/Olympus')).toBe(false);
  });

  it('prints either clock', () => {
    expect(formatClock(570, '12h')).toBe('9:30 am');
    expect(formatClock(0, '12h')).toBe('12:00 am');
    expect(formatClock(780, '24h')).toBe('13:00');
  });

  it('accepts only real times, each day once and a known zone', () => {
    const ok = { week: [{ day: 'mon', slots: [{ open: '09:00', close: '24:00' }] }] };
    expect(blockSchemas.businessHours.safeParse(ok).success).toBe(true);
    expect(blockSchemas.businessHours.safeParse({ week: [{ day: 'mon', slots: [{ open: '25:00', close: '26:00' }] }] }).success).toBe(false);
    expect(blockSchemas.businessHours.safeParse({ week: [ok.week[0], ok.week[0]] }).success).toBe(false);
    expect(blockSchemas.businessHours.safeParse({ ...ok, timeZone: 'Nowhere/Special' }).success).toBe(false);
  });
});

describe('reviews, contents, breadcrumbs, text on a path and search', () => {
  it('takes star ratings in halves only', () => {
    const review = (rating: number) => ({ items: [{ name: 'A', text: 'Good', rating }] });
    expect(blockSchemas.reviews.safeParse(review(4.5)).success).toBe(true);
    expect(blockSchemas.reviews.safeParse(review(4.3)).success).toBe(false);
    expect(blockSchemas.reviews.safeParse(review(6)).success).toBe(false);
  });

  it('builds a boxed contents list from the whole page by default', () => {
    expect(blockSchemas.toc.parse({})).toMatchObject({ style: 'boxed', scope: 'page', levels: 'h2h3', highlight: true });
  });

  it('follows the page trail unless given links, and keeps those links safe', () => {
    expect(blockSchemas.breadcrumbs.parse({}).source).toBe('page');
    expect(blockSchemas.breadcrumbs.safeParse({ source: 'custom', items: [{ label: 'A', href: 'javascript:alert(1)' }] }).success).toBe(false);
  });

  it('needs words for a text path and a closed shape', () => {
    expect(blockSchemas.textPath.safeParse({ text: '' }).success).toBe(false);
    expect(blockSchemas.textPath.safeParse({ text: 'Hi', shape: 'spiral' }).success).toBe(false);
    expect(blockSchemas.textPath.parse({ text: 'Hi' })).toMatchObject({ shape: 'circle', spin: 'slow' });
  });

  it('offers at most eight suggested searches', () => {
    expect(blockSchemas.search.safeParse({ suggestions: Array.from({ length: 9 }, (_, i) => `term ${i}`) }).success).toBe(false);
  });
});

describe('hotspots, flip cards and share buttons', () => {
  it('keeps pins inside the picture', () => {
    expect(blockSchemas.hotspots.safeParse({ points: [{ x: 50, y: 50, title: 'A' }] }).success).toBe(true);
    expect(blockSchemas.hotspots.safeParse({ points: [{ x: 120, y: 50, title: 'A' }] }).success).toBe(false);
  });

  it('turns cards over by default', () => {
    expect(blockSchemas.flipBox.parse({ cards: [{ title: 'A' }] })).toMatchObject({ effect: 'flip', columns: 3 });
  });

  it('shares to known networks only, each once', () => {
    expect(blockSchemas.share.parse({}).networks).toContain('copy');
    expect(blockSchemas.share.safeParse({ networks: ['x', 'x'] }).success).toBe(false);
    expect(blockSchemas.share.safeParse({ networks: ['myspace'] }).success).toBe(false);
  });

  it('builds share links that carry the page address and nothing else', () => {
    expect(shareHref('x', 'https://example.com/a b', 'Hi')).toBe('https://x.com/intent/tweet?url=https%3A%2F%2Fexample.com%2Fa%20b&text=Hi');
    expect(shareHref('email', 'https://example.com/', 'Read this')).toBe('mailto:?subject=Read%20this&body=https%3A%2F%2Fexample.com%2F');
    expect(shareHref('copy', 'https://example.com/')).toBeNull();
  });
});
