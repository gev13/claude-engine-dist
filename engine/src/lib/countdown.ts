export const COUNTDOWN_UNIT_ORDER = ['months', 'days', 'hours', 'minutes', 'seconds'] as const;
export type CountdownUnit = (typeof COUNTDOWN_UNIT_ORDER)[number];

const DAY = 86_400_000;
const UNIT_MS: Record<CountdownUnit, number> = {
  // Calendar months vary; a countdown only needs a stable, honest average.
  months: 30.44 * DAY,
  days: DAY,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1000,
};

/**
 * Splits a duration across the chosen units, largest first, so whatever is
 * not shown rolls into the next unit down. Negative durations count as zero.
 */
export function splitDuration(ms: number, units: readonly CountdownUnit[]): Partial<Record<CountdownUnit, number>> {
  let rest = Math.max(0, ms);
  const out: Partial<Record<CountdownUnit, number>> = {};
  for (const unit of COUNTDOWN_UNIT_ORDER) {
    if (!units.includes(unit)) continue;
    out[unit] = Math.floor(rest / UNIT_MS[unit]);
    rest -= (out[unit] ?? 0) * UNIT_MS[unit];
  }
  return out;
}
