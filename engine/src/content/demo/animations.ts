/* ═══════════════════════════════════════════════════════════════════════════
   Demo Lottie animations
   ───────────────────────────────────────────────────────────────────────────
   Four original animations for the Lottie block's demo, built here in code
   from a few shape helpers, one for each way the block can play. The demo
   seed writes them to the media library as `demo/<name>.json`, beside the
   demo images, so an editor can reuse or replace them from the Media screen.
   ═══════════════════════════════════════════════════════════════════════════ */

type Vec = number[];
type RGB = [number, number, number];

const FLARE: RGB = [0.925, 0.188, 0.075];
const GOLD: RGB = [0.96, 0.7, 0.28];
const SKY: RGB = [0.45, 0.6, 1];
const BONE: RGB = [0.93, 0.91, 0.87];
const WHITE: RGB = [1, 1, 1];

const EASES = {
  inOut: { o: { x: [0.45], y: [0] }, i: { x: [0.55], y: [1] } },
  out: { o: { x: [0.2], y: [0.7] }, i: { x: [0.2], y: [1] } },
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
};

type Key = { t: number; s: number | Vec; ease?: keyof typeof EASES };

const fixed = (k: number | Vec) => ({ a: 0, k });

/** An animated property: each key eases into the next, the last one holds. */
function keys(list: Key[]) {
  return {
    a: 1,
    k: list.map((key, i) => {
      const s = Array.isArray(key.s) ? key.s : [key.s];
      if (i === list.length - 1) return { t: key.t, s };
      const ease = EASES[key.ease ?? 'inOut'];
      return { t: key.t, s, o: ease.o, i: ease.i };
    }),
  };
}

type Prop = ReturnType<typeof fixed> | ReturnType<typeof keys>;

const ellipse = (size: number | Prop, at: Vec = [0, 0]) => ({
  ty: 'el',
  d: 1,
  p: fixed(at),
  s: typeof size === 'number' ? fixed([size, size]) : size,
});
const rect = (w: number, h: number, radius: number, at: Vec = [0, 0]) => ({ ty: 'rc', d: 1, p: fixed(at), s: fixed([w, h]), r: fixed(radius) });

/** A path through points; `bend` gives each point level handles of that length, for a smooth S-curve. */
function path(points: Vec[], bend = 0, closed = false) {
  return {
    ty: 'sh',
    d: 1,
    ks: fixed({ i: points.map(() => [-bend, 0]), o: points.map(() => [bend, 0]), v: points, c: closed } as unknown as Vec),
  };
}

const fill = (c: RGB, opacity: number | Prop = 100) => ({ ty: 'fl', c: fixed([...c, 1]), o: typeof opacity === 'number' ? fixed(opacity) : opacity, r: 1 });
const stroke = (c: RGB, width: number, opacity: number | Prop = 100, dash?: [number, number]) => ({
  ty: 'st',
  c: fixed([...c, 1]),
  o: typeof opacity === 'number' ? fixed(opacity) : opacity,
  w: fixed(width),
  lc: 2,
  lj: 2,
  ml: 4,
  ...(dash ? { d: [{ n: 'd', nm: 'dash', v: fixed(dash[0]) }, { n: 'g', nm: 'gap', v: fixed(dash[1]) }] } : {}),
});
const trim = (start: number | Prop, end: number | Prop) => ({
  ty: 'tm',
  s: typeof start === 'number' ? fixed(start) : start,
  e: typeof end === 'number' ? fixed(end) : end,
  o: fixed(0),
  m: 1,
});

type Transform = { p?: Prop; a?: Prop; s?: Prop; r?: Prop; o?: Prop };

function group(items: unknown[], tr: Transform = {}) {
  return { ty: 'gr', it: [...items, { ty: 'tr', p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0), ...tr }] };
}

function layer(ind: number, nm: string, op: number, at: Vec, shapes: unknown[], ks: Transform = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: { o: fixed(100), r: fixed(0), p: fixed([...at, 0]), a: fixed([0, 0, 0]), s: fixed([100, 100, 100]), ...ks },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

function file(nm: string, w: number, h: number, op: number, layers: unknown[]) {
  // The first layer is drawn on top, so layers are listed front to back.
  return { v: '5.7.4', fr: 30, ip: 0, op, w, h, nm, ddd: 0, assets: [], layers };
}

/* ── The four animations ──────────────────────────────────────────────────── */

/** Three moons around a breathing core — made to loop without a seam. */
function orbit() {
  const op = 90;
  const moons: [Vec, RGB][] = [
    [[0, -118], FLARE],
    [[102, 59], GOLD],
    [[-102, 59], SKY],
  ];
  return file('Orbit', 400, 400, op, [
    layer(1, 'moons', op, [200, 200], [group(moons.map(([at, c]) => group([ellipse(26, at), fill(c)])))], {
      r: keys([{ t: 0, s: 0, ease: 'linear' }, { t: op, s: 360 }]),
    }),
    layer(2, 'core', op, [200, 200], [
      group([ellipse(keys([{ t: 0, s: [78, 78] }, { t: op / 2, s: [100, 100] }, { t: op, s: [78, 78] }])), fill(FLARE)]),
    ]),
    layer(3, 'pulse', op, [200, 200], [
      group([
        ellipse(keys([{ t: 0, s: [90, 90], ease: 'out' }, { t: op, s: [210, 210] }])),
        fill(FLARE, keys([{ t: 0, s: 40, ease: 'out' }, { t: op, s: 0 }])),
      ]),
    ]),
    layer(4, 'track', op, [200, 200], [group([ellipse(236), stroke(BONE, 3, 30, [6, 14])])]),
  ]);
}

/** A ring draws itself, fills, and a tick flicks in with a small burst — ends complete. */
function tick() {
  const op = 60;
  const burst = Array.from({ length: 8 }, (_, i) =>
    group(
      [
        path([
          [0, -150],
          [0, -178],
        ]),
        trim(keys([{ t: 40, s: 0, ease: 'out' }, { t: 52, s: 100 }]), keys([{ t: 34, s: 0, ease: 'out' }, { t: 44, s: 100 }])),
        stroke(GOLD, 8),
      ],
      { r: fixed(i * 45 + 22.5) },
    ),
  );
  return file('Done', 400, 400, op, [
    layer(1, 'tick', op, [200, 200], [
      group([
        path([
          [-44, 4],
          [-14, 34],
          [46, -30],
        ]),
        trim(0, keys([{ t: 30, s: 0, ease: 'out' }, { t: 46, s: 100 }])),
        stroke(WHITE, 18),
      ]),
    ]),
    layer(2, 'disc', op, [200, 200], [group([ellipse(keys([{ t: 18, s: [0, 0], ease: 'out' }, { t: 34, s: [232, 232] }])), fill(FLARE)])]),
    layer(3, 'ring', op, [200, 200], [group([ellipse(260), trim(0, keys([{ t: 0, s: 0, ease: 'out' }, { t: 26, s: 100 }])), stroke(FLARE, 12)], { r: fixed(-90) })]),
    layer(4, 'burst', op, [200, 200], burst),
  ]);
}

/** Bars rise into a chart and a trend line draws over them — the hover state. */
function growth() {
  const op = 40;
  const heights = [70, 120, 96, 170, 214];
  const base = 262;
  const bars = heights.map((h, i) =>
    group([rect(40, h, 8, [0, -h / 2]), fill(i === heights.length - 1 ? FLARE : BONE, i === heights.length - 1 ? 100 : 30)], {
      p: fixed([80 + i * 60, base]),
      s: keys([{ t: i * 3, s: [100, 14], ease: 'out' }, { t: 16 + i * 3, s: [100, 100] }]),
    }),
  );
  const tops = heights.map((h, i) => [80 + i * 60, base - h - 26]);
  return file('Growth', 400, 300, op, [
    layer(1, 'arrow', op, [0, 0], [
      group([path([[-14, -2], [0, 0], [-4, 14]]), stroke(FLARE, 6)], {
        p: fixed(tops[tops.length - 1]!),
        r: fixed(-40),
        s: keys([{ t: 30, s: [0, 0], ease: 'out' }, { t: 38, s: [100, 100] }]),
      }),
    ]),
    layer(2, 'trend', op, [0, 0], [group([path(tops), trim(0, keys([{ t: 16, s: 0, ease: 'out' }, { t: 36, s: 100 }])), stroke(FLARE, 6)])]),
    layer(3, 'bars', op, [0, 0], bars),
    layer(4, 'floor', op, [0, 0], [group([path([[40, base + 1], [360, base + 1]]), stroke(BONE, 2, 40)])]),
  ]);
}

/** A winding route that draws itself as the page scrolls, with a pin at the end. */
function route() {
  const op = 100;
  const points = [
    [50, 330],
    [150, 150],
    [250, 290],
    [350, 90],
  ];
  return file('Route', 400, 400, op, [
    layer(1, 'pin', op, [350, 90], [
      group([ellipse(14), fill(WHITE)]),
      group([ellipse(36), fill(FLARE)]),
    ], { s: keys([{ t: 86, s: [0, 0, 100], ease: 'out' }, { t: 96, s: [100, 100, 100] }]) }),
    layer(2, 'start', op, [50, 330], [group([ellipse(20), fill(FLARE)])]),
    layer(3, 'drawn', op, [0, 0], [group([path(points, 70), trim(0, keys([{ t: 0, s: 0, ease: 'linear' }, { t: 90, s: 100 }])), stroke(FLARE, 8)])]),
    layer(4, 'faint', op, [0, 0], [group([path(points, 70), stroke(BONE, 4, 30, [2, 12])])]),
  ]);
}

export type DemoAnimation = { name: string; alt: string; data: ReturnType<typeof file> };

export const DEMO_ANIMATIONS: DemoAnimation[] = [
  { name: 'lottie-orbit', alt: 'Three dots circling a pulsing centre', data: orbit() },
  { name: 'lottie-done', alt: 'A tick drawn inside a red circle', data: tick() },
  { name: 'lottie-growth', alt: 'A bar chart rising, with an upward trend line', data: growth() },
  { name: 'lottie-route', alt: 'A winding route drawn to a map pin', data: route() },
];

const BY_NAME = new Map(DEMO_ANIMATIONS.map((a) => [a.name, a]));

/** The public URL a demo animation is served from once the demo seed has run. */
export function demoAnimationUrl(name: string): string {
  if (!BY_NAME.has(name)) throw new Error(`Unknown demo animation: ${name}`);
  return `/media/demo/${name}.json`;
}

/** The stored path inside the media directory. */
export const demoAnimationFile = (animation: DemoAnimation) => `demo/${animation.name}.json`;
