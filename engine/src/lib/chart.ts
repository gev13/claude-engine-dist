/* ═══════════════════════════════════════════════════════════════════════════
   Chart arithmetic (P3-A1)
   ───────────────────────────────────────────────────────────────────────────
   Pure, so it can be tested: the chart block draws with it on the server.
   Values are never negative — the block is for everyday figures (sales,
   visitors, shares of a whole), and a zero baseline keeps every chart honest.
   ═══════════════════════════════════════════════════════════════════════════ */

const tidy = (n: number) => Number(n.toPrecision(12));

/**
 * A round top for the axis and the ticks up to it: 0, 25, 50, 75, 100
 * rather than 0, 23.5, 47… Aims for about `count` steps.
 */
export function niceScale(max: number, count = 4): { max: number; step: number; ticks: number[] } {
  if (!(max > 0) || !Number.isFinite(max)) return { max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / magnitude;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = tidy(nice * magnitude);
  const steps = Math.max(1, Math.ceil(tidy(max / step)));
  return { max: tidy(steps * step), step, ticks: Array.from({ length: steps + 1 }, (_, i) => tidy(i * step)) };
}

/** A value as the chart prints it: grouped thousands, at most two decimals. */
export function formatChartValue(value: number, prefix = '', suffix = ''): string {
  return `${prefix}${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}${suffix}`;
}

/** Percent of `max`, clamped to the plot. */
export const percentOf = (value: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

/**
 * Points of one line series in a 100×100 box. Each point sits in the middle
 * of its category's slot, so it lines up with the label under it.
 */
export function linePoints(values: number[], max: number): { x: number; y: number }[] {
  const n = values.length;
  return values.map((v, i) => ({ x: tidy(((i + 0.5) / n) * 100), y: tidy(100 - percentOf(v, max)) }));
}

export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}

/** The same line closed down to the baseline, for an area chart. */
export function areaPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${last.x} 100 L${first.x} 100 Z`;
}

/**
 * Pie and doughnut slices as shares of 100, with where each one starts.
 * Drawn as dashes on a circle whose circumference is 100, so a slice's dash
 * length is its percentage.
 */
export function pieSlices(values: number[]): { share: number; start: number }[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  let start = 0;
  return values.map((v) => {
    const share = total > 0 ? tidy((Math.max(0, v) / total) * 100) : 0;
    const slice = { share, start: tidy(start) };
    start += share;
    return slice;
  });
}
