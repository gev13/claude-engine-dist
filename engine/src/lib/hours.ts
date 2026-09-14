/* ═══════════════════════════════════════════════════════════════════════════
   Opening hours (P3-A5)
   ───────────────────────────────────────────────────────────────────────────
   The week as data, and the arithmetic behind "Open now · closes at 17:00".
   Pure, so it can be tested. A slot whose closing time is not after its
   opening time runs past midnight (a bar open 18:00–02:00), and back-to-back
   slots — or a day open until 24:00 followed by one open from 00:00 — join
   into one stretch, so the status never says "closes at midnight" when the
   doors stay open.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: 'Mon', long: 'Monday' },
  tue: { short: 'Tue', long: 'Tuesday' },
  wed: { short: 'Wed', long: 'Wednesday' },
  thu: { short: 'Thu', long: 'Thursday' },
  fri: { short: 'Fri', long: 'Friday' },
  sat: { short: 'Sat', long: 'Saturday' },
  sun: { short: 'Sun', long: 'Sunday' },
};

/** 00:00 to 23:59, plus 24:00 as a closing time. */
export const TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Whether this runtime knows the IANA zone name ("Europe/London"). */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export type Slot = { open: string; close: string };
export type DayHours = { day: Weekday; slots: Slot[] };

const DAY = 1440;
const WEEK = 7 * DAY;

export const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Where `now` falls in the week, in `zone`: the day (0 = Monday) and the minute. */
export function zonedMoment(now: Date, zone: string): { day: number; minute: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    // An unknown zone name should never take the block down: fall back to UTC.
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = WEEKDAYS.findIndex((d) => WEEKDAY_LABELS[d].short === get('weekday'));
  return { day: Math.max(0, day), minute: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}

/** Every opening as [start, end) minutes from Monday 00:00, joined where they touch. */
function stretches(week: DayHours[]): [number, number][] {
  const raw: [number, number][] = [];
  for (const { day, slots } of week) {
    const base = WEEKDAYS.indexOf(day) * DAY;
    for (const slot of slots) {
      const open = toMinutes(slot.open);
      let close = toMinutes(slot.close);
      if (close <= open) close += DAY;
      raw.push([base + open, base + close]);
    }
  }
  raw.sort((a, b) => a[0] - b[0]);
  const joined: [number, number][] = [];
  for (const [s, e] of raw) {
    const last = joined[joined.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else joined.push([s, e]);
  }
  // Sunday night into Monday morning: the first stretch may carry on from the last.
  if (joined.length > 1) {
    const first = joined[0]!;
    const last = joined[joined.length - 1]!;
    if (last[1] >= first[0] + WEEK) {
      last[1] = Math.max(last[1], first[1] + WEEK);
      joined.shift();
    }
  }
  return joined;
}

export type Moment = { day: number; minute: number };
export type OpenStatus =
  | { open: true; always: boolean; closes?: Moment }
  | { open: false; opens?: Moment };

const moment = (t: number): Moment => {
  const m = ((t % WEEK) + WEEK) % WEEK;
  return { day: Math.floor(m / DAY), minute: m % DAY };
};

/** Whether the place is open at `at`, and when that changes. */
export function openStatus(week: DayHours[], at: Moment): OpenStatus {
  const list = stretches(week);
  if (list.length === 0) return { open: false };
  const t = at.day * DAY + at.minute;

  for (const [s, e] of list) {
    if (e - s >= WEEK) return { open: true, always: true };
    for (const shift of [0, -WEEK, WEEK]) {
      if (t >= s + shift && t < e + shift) return { open: true, always: false, closes: moment(e) };
    }
  }

  let next = Infinity;
  for (const [s] of list) {
    const ahead = s >= t ? s : s + WEEK;
    next = Math.min(next, ahead);
  }
  return { open: false, opens: moment(next) };
}

/** "09:00" or "9:00 am". */
export function formatClock(minute: number, clock: '24h' | '12h'): string {
  const h = Math.floor(minute / 60) % 24;
  const m = String(minute % 60).padStart(2, '0');
  if (clock === '24h') return `${String(h).padStart(2, '0')}:${m}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** A stored time ("24:00" included) in the chosen clock. */
export const formatTime = (time: string, clock: '24h' | '12h') => (time === '24:00' && clock === '24h' ? '24:00' : formatClock(toMinutes(time), clock));

/**
 * Days in week order, with consecutive days that keep the same hours merged
 * into one row ("Mon – Fri") when `merge` is on.
 */
export function groupDays(week: DayHours[], firstDay: 'mon' | 'sun', merge: boolean): { days: Weekday[]; slots: Slot[] }[] {
  const order = firstDay === 'sun' ? (['sun', ...WEEKDAYS.slice(0, 6)] as Weekday[]) : [...WEEKDAYS];
  const byDay = new Map(week.map((d) => [d.day, d.slots]));
  const rows: { days: Weekday[]; slots: Slot[] }[] = [];
  for (const day of order) {
    const slots = byDay.get(day) ?? [];
    const last = rows[rows.length - 1];
    if (merge && last && JSON.stringify(last.slots) === JSON.stringify(slots)) last.days.push(day);
    else rows.push({ days: [day], slots });
  }
  return rows;
}
